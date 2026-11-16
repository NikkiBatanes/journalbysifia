-- USER RUNS MANUALLY only AFTER the app smoke test and AFTER deleting both
-- temporary users through Supabase Authentication dashboard.
-- Replace the four values below in SQL Editor only; do not save real test
-- identifiers in Git. This deletes only matching synthetic profile rows.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';

DO $cleanup$
DECLARE
 v_a_text text:='REPLACE_WITH_TEST_USER_A_UUID';
 v_b_text text:='REPLACE_WITH_TEST_USER_B_UUID';
 v_email_a text:='REPLACE_WITH_TEST_USER_A_EMAIL';
 v_email_b text:='REPLACE_WITH_TEST_USER_B_EMAIL';
 v_a uuid;
 v_b uuid;
 v_deleted integer;
BEGIN
 IF pg_catalog.strpos(v_a_text,'REPLACE_WITH_')=1
 OR pg_catalog.strpos(v_b_text,'REPLACE_WITH_')=1
 OR pg_catalog.strpos(v_email_a,'REPLACE_WITH_')=1
 OR pg_catalog.strpos(v_email_b,'REPLACE_WITH_')=1 THEN
  RAISE EXCEPTION 'Replace all four test-user placeholders before running';
 END IF;
 v_a:=v_a_text::uuid;
 v_b:=v_b_text::uuid;
 IF v_a=v_b OR v_email_a=v_email_b THEN
  RAISE EXCEPTION 'Two distinct temporary test identities are required';
 END IF;

 IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id IN (v_a,v_b)) THEN
  RAISE EXCEPTION 'Delete both temporary Auth users in the dashboard before profile cleanup';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.user_profiles p
  WHERE (p.id=v_a AND p.email IS DISTINCT FROM v_email_a)
     OR (p.id=v_b AND p.email IS DISTINCT FROM v_email_b)
 ) THEN
  RAISE EXCEPTION 'A profile identifier no longer matches the expected test email; stop and review';
 END IF;

 DELETE FROM public.user_profiles p
 WHERE (p.id=v_a AND p.email=v_email_a)
    OR (p.id=v_b AND p.email=v_email_b);
 GET DIAGNOSTICS v_deleted=ROW_COUNT;

 IF EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id IN (v_a,v_b)) THEN
  RAISE EXCEPTION 'A temporary profile remains; cleanup cancelled';
 END IF;
 PERFORM pg_catalog.set_config('sifia.cleanup.deleted_profiles',v_deleted::text,true);
END;
$cleanup$;

SELECT pg_catalog.jsonb_build_object(
 'temporary_profile_cleanup','passed',
 'profiles_deleted',pg_catalog.current_setting('sifia.cleanup.deleted_profiles')::integer,
 'auth_users_present',false
) AS temporary_profile_cleanup_result;
COMMIT;
