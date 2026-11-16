-- USER RUNS MANUALLY in the existing siFia Supabase SQL Editor.
-- GUARDED PRODUCTION APPLY + SYNTHETIC DATABASE TESTS.
-- DRAFT: never executed by the agent. Complete README prerequisites first.
--
-- Create two NEW temporary Auth users. Do not open either app with them.
-- Replace the two UUID values below in SQL Editor only. Neither user may have a
-- public.user_subscriptions_new row. Never use a customer/admin account.
-- Any error means failure: run ROLLBACK; in a new query and stop.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $pre_apply_guard$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)');
 v_a_text text:='REPLACE_WITH_TEST_USER_A_UUID';
 v_b_text text:='REPLACE_WITH_TEST_USER_B_UUID';
 v_a uuid;
 v_b uuid;
BEGIN
 IF pg_catalog.strpos(v_a_text,'REPLACE_WITH_')=1 OR pg_catalog.strpos(v_b_text,'REPLACE_WITH_')=1 THEN
  RAISE EXCEPTION 'Replace both temporary test-user UUID placeholders';
 END IF;
 v_a:=v_a_text::uuid;
 v_b:=v_b_text::uuid;
 IF v_a=v_b THEN RAISE EXCEPTION 'Two distinct test users are required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=v_a)
 OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=v_b) THEN
  RAISE EXCEPTION 'Both temporary Auth users must exist';
 END IF;
 IF EXISTS (SELECT 1 FROM public.user_subscriptions_new s WHERE s.user_id IN (v_a,v_b)) THEN
  RAISE EXCEPTION 'Both test users must have no subscription row';
 END IF;
 IF v_oid IS NULL THEN RAISE EXCEPTION 'Expected Seeker initializer is missing'; END IF;
 IF pg_catalog.md5(pg_catalog.pg_get_functiondef(v_oid)) IS DISTINCT FROM '1375a3a42b6e82c8bee176040ddca33a' THEN
  RAISE EXCEPTION 'Seeker initializer differs from the accepted baseline or is already patched';
 END IF;
 IF (SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid=v_oid) IS DISTINCT FROM 'postgres'
 OR (SELECT pg_catalog.pg_get_function_result(v_oid)) IS DISTINCT FROM 'void' THEN
  RAISE EXCEPTION 'Initializer owner or return type differs from the accepted baseline';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','auth') AND p.prokind='f' AND p.oid<>v_oid
   AND pg_catalog.strpos(pg_catalog.lower(p.prosrc),'create_default_seeker_subscription')>0
 ) THEN RAISE EXCEPTION 'Database function callers require review'; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc f ON f.oid=t.tgfoid
  WHERE t.tgrelid=pg_catalog.to_regclass('auth.users') AND NOT t.tgisinternal
   AND pg_catalog.strpos(pg_catalog.lower(f.prosrc),'create_default_seeker_subscription')>0
 ) THEN RAISE EXCEPTION 'Auth trigger callers require review'; END IF;
 IF NOT COALESCE((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('public.user_subscriptions_new')),false) THEN
  RAISE EXCEPTION 'Subscription RLS is not enabled';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_constraint c
  WHERE c.conrelid=pg_catalog.to_regclass('public.user_subscriptions_new') AND c.contype='u'
   AND pg_catalog.pg_get_constraintdef(c.oid)='UNIQUE (user_id)'
 ) THEN RAISE EXCEPTION 'Expected unique user_id constraint is missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_enum e WHERE e.enumtypid=pg_catalog.to_regtype('public.subscription_tier_new') AND e.enumlabel='seeker')
 OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_enum e WHERE e.enumtypid=pg_catalog.to_regtype('public.subscription_status') AND e.enumlabel='active') THEN
  RAISE EXCEPTION 'Required Seeker/active enum values are missing';
 END IF;
 PERFORM pg_catalog.set_config('sifia.test.user_a',v_a::text,true);
 PERFORM pg_catalog.set_config('sifia.test.user_b',v_b::text,true);
END;
$pre_apply_guard$;

CREATE OR REPLACE FUNCTION public.create_default_seeker_subscription(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
 v_caller uuid:=auth.uid();
BEGIN
 IF v_caller IS NULL OR target_user_id IS DISTINCT FROM v_caller THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Subscription bootstrap requires the authenticated owner';
 END IF;

 INSERT INTO public.user_subscriptions_new (
  user_id,tier,status,subscription_display_name,playbooks_limit,
  devotionals_limit,smart_journaling_enabled,playbooks_used,
  devotionals_used,last_usage_reset,created_at,updated_at
 ) VALUES (
  v_caller,'seeker','active','siFia Seeker',2,1,true,0,0,
  pg_catalog.now(),pg_catalog.now(),pg_catalog.now()
 )
 ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_default_seeker_subscription(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_default_seeker_subscription(uuid) TO authenticated;
COMMENT ON FUNCTION public.create_default_seeker_subscription(uuid)
 IS 'Owner-bound fixed Seeker initializer; guarded manual security patch 2026-11-16';

SAVEPOINT synthetic_subscription_tests;

DO $prepare_claims$
BEGIN
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('sifia.test.user_a'),true);
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object(
  'sub',pg_catalog.current_setting('sifia.test.user_a'),'role','authenticated'
 )::text,true);
END;
$prepare_claims$;

SET LOCAL ROLE authenticated;
DO $owner_create_repeat_tests$
DECLARE
 v_a uuid:=pg_catalog.current_setting('sifia.test.user_a')::uuid;
 v_before jsonb;
 v_after jsonb;
BEGIN
 PERFORM public.create_default_seeker_subscription(v_a);
 SELECT pg_catalog.to_jsonb(s.*) INTO v_before FROM public.user_subscriptions_new s WHERE s.user_id=v_a;
 IF v_before IS NULL
 OR v_before->>'user_id' IS DISTINCT FROM v_a::text
 OR v_before->>'tier' IS DISTINCT FROM 'seeker'
 OR v_before->>'status' IS DISTINCT FROM 'active'
 OR v_before->>'subscription_display_name' IS DISTINCT FROM 'siFia Seeker'
 OR (v_before->>'playbooks_limit')::integer<>2
 OR (v_before->>'devotionals_limit')::integer<>1
 OR (v_before->>'playbooks_used')::integer<>0
 OR (v_before->>'devotionals_used')::integer<>0
 OR (v_before->>'smart_journaling_enabled')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Fixed Seeker row assertion failed';
 END IF;
 PERFORM public.create_default_seeker_subscription(v_a);
 SELECT pg_catalog.to_jsonb(s.*) INTO v_after FROM public.user_subscriptions_new s WHERE s.user_id=v_a;
 IF v_after IS DISTINCT FROM v_before THEN RAISE EXCEPTION 'Repeated initializer changed the existing row'; END IF;
END;
$owner_create_repeat_tests$;
RESET ROLE;

-- Simulate a trusted concurrent billing result, then prove the default
-- initializer preserves the existing row instead of downgrading it.
UPDATE public.user_subscriptions_new
SET tier='growth'
WHERE user_id=pg_catalog.current_setting('sifia.test.user_a')::uuid;
DO $capture_paid_row$
DECLARE v_paid jsonb;
BEGIN
 SELECT pg_catalog.to_jsonb(s.*) INTO v_paid FROM public.user_subscriptions_new s
 WHERE s.user_id=pg_catalog.current_setting('sifia.test.user_a')::uuid;
 IF v_paid IS NULL OR v_paid->>'tier' IS DISTINCT FROM 'growth' THEN
  RAISE EXCEPTION 'Synthetic paid-row setup failed';
 END IF;
 PERFORM pg_catalog.set_config('sifia.test.paid_before',v_paid::text,true);
END;
$capture_paid_row$;

SET LOCAL ROLE authenticated;
DO $preserve_and_denial_tests$
DECLARE
 v_a uuid:=pg_catalog.current_setting('sifia.test.user_a')::uuid;
 v_b uuid:=pg_catalog.current_setting('sifia.test.user_b')::uuid;
BEGIN
 PERFORM public.create_default_seeker_subscription(v_a);
 BEGIN
  PERFORM public.create_default_seeker_subscription(v_b);
  RAISE EXCEPTION 'Cross-owner initializer was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.create_default_seeker_subscription(NULL);
  RAISE EXCEPTION 'Null owner was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM pg_catalog.set_config('request.jwt.claim.sub','',true);
 PERFORM pg_catalog.set_config('request.jwt.claims','{"role":"authenticated"}',true);
 BEGIN
  PERFORM public.create_default_seeker_subscription(v_a);
  RAISE EXCEPTION 'Missing caller identity was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$preserve_and_denial_tests$;
RESET ROLE;

DO $preservation_check$
DECLARE v_current jsonb;
BEGIN
 SELECT pg_catalog.to_jsonb(s.*) INTO v_current FROM public.user_subscriptions_new s
 WHERE s.user_id=pg_catalog.current_setting('sifia.test.user_a')::uuid;
 IF v_current IS DISTINCT FROM pg_catalog.current_setting('sifia.test.paid_before')::jsonb THEN
  RAISE EXCEPTION 'Existing paid row changed during default initialization';
 END IF;
 IF EXISTS (SELECT 1 FROM public.user_subscriptions_new s WHERE s.user_id=pg_catalog.current_setting('sifia.test.user_b')::uuid) THEN
  RAISE EXCEPTION 'Denied cross-owner call created user B subscription';
 END IF;
 PERFORM pg_catalog.set_config('request.jwt.claim.role','anon',true);
 PERFORM pg_catalog.set_config('request.jwt.claims','{"role":"anon"}',true);
END;
$preservation_check$;

SET LOCAL ROLE anon;
DO $anonymous_test$
BEGIN
 BEGIN
  PERFORM public.create_default_seeker_subscription(pg_catalog.current_setting('sifia.test.user_a')::uuid);
  RAISE EXCEPTION 'Anonymous initializer was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$anonymous_test$;
RESET ROLE;

ROLLBACK TO SAVEPOINT synthetic_subscription_tests;
RELEASE SAVEPOINT synthetic_subscription_tests;

DO $pre_commit_verification$
DECLARE v_oid oid:=pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)');
BEGIN
 IF v_oid IS NULL
 OR (SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid=v_oid) IS DISTINCT FROM 'postgres'
 OR NOT (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid=v_oid)
 OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=v_oid AND 'search_path=""'=ANY(p.proconfig)) THEN
  RAISE EXCEPTION 'Hardened initializer shape verification failed';
 END IF;
 IF pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE')
 OR COALESCE((SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
  FROM pg_catalog.aclexplode(COALESCE(
   (SELECT p.proacl FROM pg_catalog.pg_proc p WHERE p.oid=v_oid),
   pg_catalog.acldefault('f',(SELECT p.proowner FROM pg_catalog.pg_proc p WHERE p.oid=v_oid))
  )) a),false)
 OR NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
  RAISE EXCEPTION 'Hardened initializer execute grants verification failed';
 END IF;
 IF pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound fixed Seeker initializer; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Hardened initializer deployment marker is missing';
 END IF;
 IF EXISTS (SELECT 1 FROM public.user_subscriptions_new s WHERE s.user_id IN (
  pg_catalog.current_setting('sifia.test.user_a')::uuid,
  pg_catalog.current_setting('sifia.test.user_b')::uuid
 )) THEN RAISE EXCEPTION 'Synthetic subscription rows were not rolled back'; END IF;
END;
$pre_commit_verification$;

COMMIT;

DO $post_commit_guard$
DECLARE v_oid oid:=pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)');
BEGIN
 IF v_oid IS NULL OR pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound fixed Seeker initializer; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Guarded Seeker initializer deployment did not commit';
 END IF;
END;
$post_commit_guard$;

SELECT pg_catalog.jsonb_build_object(
 'deployment_committed',true,
 'synthetic_database_assertions','passed',
 'existing_paid_row_preserved',true,
 'synthetic_subscription_rows_persisted',false,
 'next_step','Run 03-verify.sql and share its single JSON result'
) AS guarded_seeker_bootstrap_result;
