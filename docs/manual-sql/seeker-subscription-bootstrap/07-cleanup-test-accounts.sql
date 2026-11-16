-- USER RUNS MANUALLY after deleting temporary Auth users in the dashboard.
-- Replace UUIDs in SQL Editor only. Deletes/verifies only exact synthetic rows.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';
DO $cleanup$
DECLARE
 v_a_text text:='REPLACE_WITH_TEST_USER_A_UUID';
 v_b_text text:='REPLACE_WITH_TEST_USER_B_UUID';
 v_c_text text:='OPTIONAL_REPLACE_WITH_JOURNAL_ONLY_USER_C_UUID_OR_LEAVE';
 v_ids uuid[];
 v_subscription_count integer;
 v_profile_count integer;
BEGIN
 IF pg_catalog.strpos(v_a_text,'REPLACE_WITH_')=1 OR pg_catalog.strpos(v_b_text,'REPLACE_WITH_')=1 THEN
  RAISE EXCEPTION 'Replace both required UUID placeholders';
 END IF;
 v_ids:=ARRAY[v_a_text::uuid,v_b_text::uuid];
 IF pg_catalog.strpos(v_c_text,'OPTIONAL_REPLACE_WITH_')<>1 THEN
  v_ids:=v_ids||v_c_text::uuid;
 END IF;
 IF pg_catalog.array_length(v_ids,1)<>cardinality(ARRAY(SELECT DISTINCT x FROM pg_catalog.unnest(v_ids) x)) THEN
  RAISE EXCEPTION 'Temporary UUIDs must be distinct';
 END IF;
 IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id=ANY(v_ids)) THEN
  RAISE EXCEPTION 'Delete all listed temporary Auth users before cleanup';
 END IF;
 DELETE FROM public.user_subscriptions_new s WHERE s.user_id=ANY(v_ids);
 GET DIAGNOSTICS v_subscription_count=ROW_COUNT;
 DELETE FROM public.user_profiles p WHERE p.id=ANY(v_ids);
 GET DIAGNOSTICS v_profile_count=ROW_COUNT;
 IF EXISTS (SELECT 1 FROM public.user_subscriptions_new s WHERE s.user_id=ANY(v_ids))
 OR EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=ANY(v_ids)) THEN
  RAISE EXCEPTION 'Synthetic rows remain; cleanup cancelled';
 END IF;
 PERFORM pg_catalog.set_config('sifia.cleanup.subscriptions',v_subscription_count::text,true);
 PERFORM pg_catalog.set_config('sifia.cleanup.profiles',v_profile_count::text,true);
END;
$cleanup$;
SELECT pg_catalog.jsonb_build_object(
 'temporary_account_cleanup','passed',
 'subscriptions_deleted',pg_catalog.current_setting('sifia.cleanup.subscriptions')::integer,
 'profiles_deleted',pg_catalog.current_setting('sifia.cleanup.profiles')::integer,
 'auth_users_present',false
) AS seeker_test_cleanup_result;
COMMIT;
