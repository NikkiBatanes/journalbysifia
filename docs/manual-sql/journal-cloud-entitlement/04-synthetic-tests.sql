-- USER RUNS MANUALLY only after 03 verification is accepted.
-- Create two NEW temporary Auth users and do not open either app with them.
-- Replace the two UUIDs below. All synthetic rows are rolled back.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $fixtures$
DECLARE
 v_a_text text:='REPLACE_WITH_TEST_USER_A_UUID';
 v_b_text text:='REPLACE_WITH_TEST_USER_B_UUID';
 v_a uuid;
 v_b uuid;
BEGIN
 IF pg_catalog.strpos(v_a_text,'REPLACE_WITH_')=1
 OR pg_catalog.strpos(v_b_text,'REPLACE_WITH_')=1 THEN
  RAISE EXCEPTION 'Replace both temporary test-user UUID placeholders';
 END IF;
 v_a:=v_a_text::uuid;
 v_b:=v_b_text::uuid;
 IF v_a=v_b THEN RAISE EXCEPTION 'Two distinct users are required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=v_a)
 OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=v_b) THEN
  RAISE EXCEPTION 'Both temporary Auth users must exist';
 END IF;
 IF EXISTS (SELECT 1 FROM public.journal_cloud_entitlements e WHERE e.user_id IN (v_a,v_b)) THEN
  RAISE EXCEPTION 'Temporary users must have no Journal Cloud entitlement rows';
 END IF;
 PERFORM pg_catalog.set_config('sifia.test.user_a',v_a::text,true);
 PERFORM pg_catalog.set_config('sifia.test.user_b',v_b::text,true);
END;
$fixtures$;

SET LOCAL ROLE service_role;
DO $server_tests$
DECLARE
 v_a uuid:=pg_catalog.current_setting('sifia.test.user_a')::uuid;
 v_b uuid:=pg_catalog.current_setting('sifia.test.user_b')::uuid;
 v_result jsonb;
BEGIN
 v_result:=public.reconcile_journal_cloud_entitlement(
  'synthetic-active',pg_catalog.repeat('a',64),'INITIAL_PURCHASE','reconcile',
  'journal_cloud_event','PRODUCTION',v_a,v_a::text,
  'journal_cloud:monthly',pg_catalog.now(),true,pg_catalog.now()+interval '30 days',pg_catalog.now()
 );
 IF v_result->>'status' IS DISTINCT FROM 'reconciled'
 OR (v_result->>'active')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Active reconciliation failed';
 END IF;
 v_result:=public.reconcile_journal_cloud_entitlement(
  'synthetic-active',pg_catalog.repeat('a',64),'INITIAL_PURCHASE','reconcile',
  'journal_cloud_event','PRODUCTION',v_a,v_a::text,
  'journal_cloud:monthly',pg_catalog.now(),true,pg_catalog.now()+interval '30 days',pg_catalog.now()
 );
 IF v_result->>'status' IS DISTINCT FROM 'duplicate' THEN
  RAISE EXCEPTION 'Idempotent duplicate assertion failed';
 END IF;
 v_result:=public.reconcile_journal_cloud_entitlement(
  'synthetic-active',pg_catalog.repeat('b',64),'INITIAL_PURCHASE','reconcile',
  'journal_cloud_event','PRODUCTION',v_a,v_a::text,
  'journal_cloud:monthly',pg_catalog.now(),false,NULL,pg_catalog.now()
 );
 IF v_result->>'status' IS DISTINCT FROM 'payload_mismatch' THEN
  RAISE EXCEPTION 'Event-ID payload mismatch was not quarantined';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.journal_cloud_entitlements e
  WHERE e.user_id=v_a AND e.state='active') THEN
  RAISE EXCEPTION 'Payload mismatch changed the entitlement';
 END IF;
 v_result:=public.reconcile_journal_cloud_entitlement(
  'synthetic-sandbox',pg_catalog.repeat('d',64),'INITIAL_PURCHASE','reconcile',
  'journal_cloud_event','SANDBOX',v_b,v_b::text,
  'journal_cloud:annual',pg_catalog.now(),true,pg_catalog.now()+interval '30 days',pg_catalog.now()
 );
 IF v_result->>'status' IS DISTINCT FROM 'reconciled'
 OR EXISTS (SELECT 1 FROM public.journal_cloud_entitlements e WHERE e.user_id=v_b)
 OR NOT EXISTS (SELECT 1 FROM public.journal_cloud_entitlement_sources s
  WHERE s.owner_user_id=v_b AND s.environment='SANDBOX' AND s.authoritative_active) THEN
  RAISE EXCEPTION 'Sandbox isolation assertion failed';
 END IF;
END;
$server_tests$;
RESET ROLE;

DO $claims_a$
BEGIN
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('sifia.test.user_a'),true);
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object(
  'sub',pg_catalog.current_setting('sifia.test.user_a'),'role','authenticated'
 )::text,true);
END;
$claims_a$;
SET LOCAL ROLE authenticated;
DO $owner_read_write_denial$
DECLARE v_a uuid:=pg_catalog.current_setting('sifia.test.user_a')::uuid;
BEGIN
 IF (SELECT pg_catalog.count(*) FROM public.journal_cloud_entitlements e WHERE e.user_id=v_a)<>1 THEN
  RAISE EXCEPTION 'Owner could not read its projection';
 END IF;
 BEGIN
  UPDATE public.journal_cloud_entitlements SET state='active' WHERE user_id=v_a;
  RAISE EXCEPTION 'Authenticated owner unexpectedly updated entitlement';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM public.journal_cloud_entitlements WHERE user_id=v_a;
  RAISE EXCEPTION 'Authenticated owner unexpectedly deleted entitlement';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$owner_read_write_denial$;
RESET ROLE;

DO $claims_b$
BEGIN
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('sifia.test.user_b'),true);
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object(
  'sub',pg_catalog.current_setting('sifia.test.user_b'),'role','authenticated'
 )::text,true);
END;
$claims_b$;
SET LOCAL ROLE authenticated;
DO $cross_owner_denial$
BEGIN
 IF EXISTS (SELECT 1 FROM public.journal_cloud_entitlements) THEN
  RAISE EXCEPTION 'User B could see user A entitlement';
 END IF;
END;
$cross_owner_denial$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $inactive_reconciliation$
DECLARE
 v_a uuid:=pg_catalog.current_setting('sifia.test.user_a')::uuid;
 v_result jsonb;
BEGIN
 v_result:=public.reconcile_journal_cloud_entitlement(
  'synthetic-inactive',pg_catalog.repeat('c',64),'EXPIRATION','reconcile',
  'journal_cloud_event','PRODUCTION',v_a,v_a::text,
  'journal_cloud:monthly',pg_catalog.now(),false,pg_catalog.now()-interval '1 second',pg_catalog.now()+interval '1 second'
 );
 IF v_result->>'status' IS DISTINCT FROM 'reconciled'
 OR NOT EXISTS (SELECT 1 FROM public.journal_cloud_entitlements e
  WHERE e.user_id=v_a AND e.state='inactive') THEN
  RAISE EXCEPTION 'Inactive reconciliation failed';
 END IF;
END;
$inactive_reconciliation$;
RESET ROLE;

ROLLBACK;

SELECT pg_catalog.jsonb_build_object(
 'synthetic_entitlement_tests','passed',
 'synthetic_rows_persisted',false,
 'owner_read','passed',
 'owner_write_denied','passed',
 'cross_owner_read_denied','passed',
 'duplicate_and_mismatch','passed',
 'sandbox_does_not_grant_production_access','passed',
 'active_and_inactive_reconciliation','passed'
) AS journal_cloud_synthetic_test_result;
