-- USER RUNS MANUALLY in the existing siFia Supabase SQL Editor.
-- GUARDED PRODUCTION APPLY + SYNTHETIC DATABASE TESTS.
-- DRAFT: prepared from the accepted 2026-11-04 preflight; never executed by
-- the agent. Do not run until README.md prerequisites are complete.
--
-- Before running, create two NEW temporary Auth test users through the normal
-- Supabase Auth/Dashboard flow. Neither test user may already have a row in
-- public.user_profiles. Replace all four REPLACE_WITH_* values below.
-- Use test accounts only. Never substitute a customer or owner/admin account.
--
-- Safety behavior:
--   * fixture/baseline guards run before the function is replaced;
--   * every change is inside one transaction;
--   * any unexpected result raises an error and prevents COMMIT;
--   * synthetic profile writes are rolled back to a savepoint before COMMIT;
--   * no journal, subscription, storage, or other content table is changed.
-- If the editor reports ANY error, treat the deployment as failed and run
-- ROLLBACK; in a new editor query before doing anything else.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $pre_apply_guard$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)');
 v_a_text text:='REPLACE_WITH_TEST_USER_A_UUID';
 v_b_text text:='REPLACE_WITH_TEST_USER_B_UUID';
 v_email_a text:='REPLACE_WITH_TEST_USER_A_EMAIL';
 v_email_b text:='REPLACE_WITH_TEST_USER_B_EMAIL';
 v_a uuid;
 v_b uuid;
 v_actual_email text;
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

 SELECT u.email INTO v_actual_email FROM auth.users u WHERE u.id=v_a;
 IF NOT FOUND OR v_actual_email IS DISTINCT FROM v_email_a THEN
  RAISE EXCEPTION 'Test user A UUID/email does not match auth.users';
 END IF;
 SELECT u.email INTO v_actual_email FROM auth.users u WHERE u.id=v_b;
 IF NOT FOUND OR v_actual_email IS DISTINCT FROM v_email_b THEN
  RAISE EXCEPTION 'Test user B UUID/email does not match auth.users';
 END IF;
 IF EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id IN (v_a,v_b)) THEN
  RAISE EXCEPTION 'Both test users must be new and have no user_profiles row';
 END IF;

 IF v_oid IS NULL THEN
  RAISE EXCEPTION 'Expected profile function is missing; stop and review preflight';
 END IF;
 IF pg_catalog.md5(pg_catalog.pg_get_functiondef(v_oid)) IS DISTINCT FROM '53e81822358e124a7b15a6b9153241e2' THEN
  RAISE EXCEPTION 'Profile function differs from the audited baseline or is already patched; stop and review';
 END IF;
 IF (SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid=v_oid) IS DISTINCT FROM 'postgres' THEN
  RAISE EXCEPTION 'Unexpected profile function owner; stop and review';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','auth') AND p.prokind='f' AND p.oid<>v_oid
   AND pg_catalog.strpos(pg_catalog.lower(p.prosrc),'create_default_user_profile')>0
 ) THEN
  RAISE EXCEPTION 'Database function callers require review, including Auth triggers; stop and review preflight';
 END IF;
 IF NOT COALESCE((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('public.user_profiles')),false) THEN
  RAISE EXCEPTION 'Profile RLS is not enabled; stop and review';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user_profiles'
   AND column_name='id' AND udt_name='uuid' AND is_nullable='NO'
 ) OR NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user_profiles'
   AND column_name='email' AND udt_name='text' AND is_nullable='NO'
 ) THEN
  RAISE EXCEPTION 'Profile identity columns differ from the audit; stop and review';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_catalog.unnest(ARRAY[
   'id','email','first_name','last_name','bio','avatar_url','faith_points',
   'growth_level','total_faith_points_earned','current_streak','longest_streak',
   'last_activity_date','email_verified','last_login_at','last_active_at',
   'created_at','updated_at'
  ]) r(name)
  WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='user_profiles'
    AND c.column_name=r.name
  )
 ) THEN
  RAISE EXCEPTION 'Required profile columns are missing; stop and review';
 END IF;

 PERFORM pg_catalog.set_config('sifia.test.user_a',v_a::text,true);
 PERFORM pg_catalog.set_config('sifia.test.user_b',v_b::text,true);
 PERFORM pg_catalog.set_config('sifia.test.email_a',v_email_a,true);
END;
$pre_apply_guard$;

CREATE OR REPLACE FUNCTION public.create_default_user_profile(p_user_id uuid,p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
 v_caller uuid:=auth.uid();
 v_email text;
 v_profile jsonb;
BEGIN
 IF v_caller IS NULL OR p_user_id IS DISTINCT FROM v_caller THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Profile bootstrap requires the authenticated owner';
 END IF;

 -- Keep p_email in the API signature for older clients, but never trust it.
 SELECT u.email INTO v_email FROM auth.users u WHERE u.id=v_caller;
 IF NOT FOUND OR v_email IS NULL OR pg_catalog.btrim(v_email)='' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Verified account email unavailable';
 END IF;

 INSERT INTO public.user_profiles (
  id,email,first_name,last_name,bio,avatar_url,faith_points,growth_level,
  total_faith_points_earned,current_streak,longest_streak,last_activity_date,
  email_verified,last_login_at,last_active_at,created_at,updated_at
 ) VALUES (
  v_caller,v_email,'User','','',NULL,0,'Seedling',0,0,0,CURRENT_DATE,
  FALSE,pg_catalog.now(),pg_catalog.now(),pg_catalog.now(),pg_catalog.now()
 )
 ON CONFLICT (id) DO UPDATE SET
  email=EXCLUDED.email,
  updated_at=pg_catalog.now()
 RETURNING pg_catalog.to_jsonb(user_profiles.*) INTO v_profile;

 RETURN v_profile;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_default_user_profile(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_default_user_profile(uuid,text) TO authenticated;
COMMENT ON FUNCTION public.create_default_user_profile(uuid,text)
 IS 'Owner-bound profile bootstrap; caller email ignored; guarded manual security patch 2026-11-16';

-- All writes below are synthetic and are discarded before the function change
-- is committed. The savepoint does not contain the function replacement above.
SAVEPOINT synthetic_profile_tests;

DO $prepare_test_claims$
BEGIN
 PERFORM pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('sifia.test.user_a'),
  true
 );
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 PERFORM pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
   'sub',pg_catalog.current_setting('sifia.test.user_a'),
   'role','authenticated'
  )::text,
  true
 );
END;
$prepare_test_claims$;

SET LOCAL ROLE authenticated;
DO $owner_tests$
DECLARE
 v_a uuid:=pg_catalog.current_setting('sifia.test.user_a')::uuid;
 v_b uuid:=pg_catalog.current_setting('sifia.test.user_b')::uuid;
 v_email_a text:=pg_catalog.current_setting('sifia.test.email_a');
 v_result jsonb;
 v_before jsonb;
BEGIN
 v_result:=public.create_default_user_profile(v_a,'spoofed-email@example.invalid');
 IF v_result IS NULL
 OR (v_result->>'id') IS DISTINCT FROM v_a::text
 OR (v_result->>'email') IS DISTINCT FROM v_email_a THEN
  RAISE EXCEPTION 'Owner creation or server-derived email assertion failed';
 END IF;

 SELECT pg_catalog.to_jsonb(p.*) INTO v_before
 FROM public.user_profiles p WHERE p.id=v_a;
 v_result:=public.create_default_user_profile(v_a,NULL);
 IF (v_before-'email'-'updated_at') IS DISTINCT FROM (v_result-'email'-'updated_at') THEN
  RAISE EXCEPTION 'Repeated bootstrap changed unrelated profile fields';
 END IF;

 BEGIN
  PERFORM public.create_default_user_profile(v_b,'spoofed-email@example.invalid');
  RAISE EXCEPTION 'Cross-owner bootstrap was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  NULL;
 END;

 BEGIN
  PERFORM public.create_default_user_profile(NULL,'spoofed-email@example.invalid');
  RAISE EXCEPTION 'Null owner was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  NULL;
 END;

 PERFORM pg_catalog.set_config('request.jwt.claim.sub','',true);
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 PERFORM pg_catalog.set_config('request.jwt.claims','{"role":"authenticated"}',true);
 BEGIN
  PERFORM public.create_default_user_profile(v_a,NULL);
  RAISE EXCEPTION 'Missing caller identity was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  NULL;
 END;
END;
$owner_tests$;
RESET ROLE;

DO $denied_target_unchanged$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.user_profiles p
  WHERE p.id=pg_catalog.current_setting('sifia.test.user_b')::uuid
 ) THEN
  RAISE EXCEPTION 'Denied cross-owner call created or changed test user B';
 END IF;
 PERFORM pg_catalog.set_config('request.jwt.claim.sub','',true);
 PERFORM pg_catalog.set_config('request.jwt.claim.role','anon',true);
 PERFORM pg_catalog.set_config('request.jwt.claims','{"role":"anon"}',true);
END;
$denied_target_unchanged$;

SET LOCAL ROLE anon;
DO $anonymous_test$
BEGIN
 BEGIN
  PERFORM public.create_default_user_profile(
   pg_catalog.current_setting('sifia.test.user_a')::uuid,
   NULL
  );
  RAISE EXCEPTION 'Anonymous bootstrap was unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  NULL;
 END;
END;
$anonymous_test$;
RESET ROLE;

-- Remove the synthetic profile created for A and all test-session state set
-- after the savepoint. The hardened function and grants remain in the outer
-- transaction.
ROLLBACK TO SAVEPOINT synthetic_profile_tests;
RELEASE SAVEPOINT synthetic_profile_tests;

DO $pre_commit_verification$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)');
BEGIN
 IF v_oid IS NULL THEN
  RAISE EXCEPTION 'Hardened function is missing before commit';
 END IF;
 IF (SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid=v_oid) IS DISTINCT FROM 'postgres'
 OR NOT (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid=v_oid)
 OR NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p
  WHERE p.oid=v_oid AND 'search_path=""'=ANY(p.proconfig)
 ) THEN
  RAISE EXCEPTION 'Hardened function owner/security/search_path verification failed';
 END IF;
 IF pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE')
 OR COALESCE((
  SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
  FROM pg_catalog.aclexplode(
   COALESCE(
    (SELECT p.proacl FROM pg_catalog.pg_proc p WHERE p.oid=v_oid),
    pg_catalog.acldefault('f',(SELECT p.proowner FROM pg_catalog.pg_proc p WHERE p.oid=v_oid))
   )
  ) a
 ),false)
 OR NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
  RAISE EXCEPTION 'Hardened function execute grants verification failed';
 END IF;
 IF pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound profile bootstrap; caller email ignored; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Hardened function deployment marker is missing';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.user_profiles p
  WHERE p.id IN (
   pg_catalog.current_setting('sifia.test.user_a')::uuid,
   pg_catalog.current_setting('sifia.test.user_b')::uuid
  )
 ) THEN
  RAISE EXCEPTION 'Synthetic profile rows were not rolled back';
 END IF;
END;
$pre_commit_verification$;

COMMIT;

-- A successful script reaches this post-commit assertion. If the earlier
-- transaction rolled back, this marker check fails instead of reporting pass.
DO $post_commit_guard$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)');
BEGIN
 IF v_oid IS NULL OR pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound profile bootstrap; caller email ignored; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Guarded profile deployment did not commit';
 END IF;
END;
$post_commit_guard$;

SELECT pg_catalog.jsonb_build_object(
 'deployment_committed',true,
 'synthetic_database_assertions','passed',
 'synthetic_profile_rows_persisted',false,
 'next_step','Run 03-verify.sql and share its single JSON result'
) AS guarded_profile_deployment_result;
