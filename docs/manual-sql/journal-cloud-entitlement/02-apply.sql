-- USER RUNS MANUALLY in the existing siFia Supabase SQL Editor.
-- ADDITIVE JOURNAL CLOUD ENTITLEMENT BOUNDARY ONLY.
--
-- This script creates new, unused objects. It does not read or change customer
-- journal content, existing siFia subscriptions, receipts, or storage.
-- Run only after reviewing README.md and the accepted 01 preflight evidence.
-- Any error means failure: run ROLLBACK; in a new SQL Editor query and stop.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $guard$
DECLARE
 v_name text;
BEGIN
 FOREACH v_name IN ARRAY ARRAY[
  'journal_cloud_entitlements',
  'journal_cloud_entitlement_sources',
  'journal_cloud_billing_events',
  'journal_cloud_webhook_inbox'
 ] LOOP
  IF pg_catalog.to_regclass('public.'||v_name) IS NOT NULL THEN
   RAISE EXCEPTION 'Unexpected existing relation public.%',v_name;
  END IF;
 END LOOP;
 IF pg_catalog.to_regtype('public.journal_cloud_entitlement_state') IS NOT NULL
 OR pg_catalog.to_regtype('public.journal_cloud_source_provider') IS NOT NULL THEN
  RAISE EXCEPTION 'Unexpected existing Journal Cloud enum';
 END IF;
 IF pg_catalog.to_regprocedure(
  'public.reconcile_journal_cloud_entitlement(text,text,text,text,text,text,uuid,text,text,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone)'
 ) IS NOT NULL THEN
  RAISE EXCEPTION 'Unexpected existing Journal Cloud reconciliation function';
 END IF;
 IF pg_catalog.to_regclass('auth.users') IS NULL THEN
  RAISE EXCEPTION 'auth.users is missing';
 END IF;
 IF pg_catalog.to_regrole('authenticated') IS NULL
 OR pg_catalog.to_regrole('anon') IS NULL
 OR pg_catalog.to_regrole('service_role') IS NULL THEN
  RAISE EXCEPTION 'Required Supabase roles are missing';
 END IF;
END;
$guard$;

CREATE TYPE public.journal_cloud_entitlement_state AS ENUM ('inactive','active');
CREATE TYPE public.journal_cloud_source_provider AS ENUM ('revenuecat');

CREATE TABLE public.journal_cloud_webhook_inbox (
 provider public.journal_cloud_source_provider NOT NULL,
 environment text NOT NULL CHECK (environment IN ('SANDBOX','PRODUCTION')),
 external_event_id text NOT NULL CHECK (pg_catalog.length(external_event_id) BETWEEN 1 AND 255),
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
 event_type text NOT NULL CHECK (pg_catalog.length(event_type) BETWEEN 1 AND 80),
 disposition text NOT NULL CHECK (disposition IN ('reconcile','ignore','quarantine')),
 reason text NOT NULL CHECK (pg_catalog.length(reason) BETWEEN 1 AND 120),
 attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count>0),
 first_received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 last_received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 processed_at timestamptz,
 PRIMARY KEY (provider,environment,external_event_id)
);

CREATE TABLE public.journal_cloud_entitlement_sources (
 provider public.journal_cloud_source_provider NOT NULL,
 environment text NOT NULL CHECK (environment IN ('SANDBOX','PRODUCTION')),
 external_customer_id text NOT NULL CHECK (pg_catalog.length(external_customer_id) BETWEEN 1 AND 1500),
 owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 entitlement_lookup_key text NOT NULL CHECK (pg_catalog.length(entitlement_lookup_key) BETWEEN 1 AND 200),
 authoritative_active boolean NOT NULL,
 authoritative_expires_at timestamptz,
 last_event_id text NOT NULL CHECK (pg_catalog.length(last_event_id) BETWEEN 1 AND 255),
 last_verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 PRIMARY KEY (provider,environment,external_customer_id),
 UNIQUE (provider,environment,owner_user_id),
 CHECK (external_customer_id=owner_user_id::text)
);

CREATE TABLE public.journal_cloud_entitlements (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 state public.journal_cloud_entitlement_state NOT NULL,
 storage_limit_bytes bigint NOT NULL DEFAULT 5368709120
  CHECK (storage_limit_bytes=5368709120),
 source_provider public.journal_cloud_source_provider NOT NULL,
 source_environment text NOT NULL CHECK (source_environment IN ('SANDBOX','PRODUCTION')),
 expires_at timestamptz,
 last_verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.journal_cloud_billing_events (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 provider public.journal_cloud_source_provider NOT NULL,
 environment text NOT NULL CHECK (environment IN ('SANDBOX','PRODUCTION')),
 external_event_id text NOT NULL CHECK (pg_catalog.length(external_event_id) BETWEEN 1 AND 255),
 owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 event_type text NOT NULL CHECK (pg_catalog.length(event_type) BETWEEN 1 AND 80),
 product_id text CHECK (product_id IS NULL OR pg_catalog.length(product_id)<=255),
 disposition text NOT NULL CHECK (disposition IN ('reconcile','ignore','quarantine')),
 reason text NOT NULL CHECK (pg_catalog.length(reason) BETWEEN 1 AND 120),
 event_occurred_at timestamptz,
 authoritative_active boolean,
 authoritative_expires_at timestamptz,
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
 received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 processed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE (provider,environment,external_event_id),
 FOREIGN KEY (provider,environment,external_event_id)
  REFERENCES public.journal_cloud_webhook_inbox(provider,environment,external_event_id)
  ON DELETE RESTRICT
);

ALTER TABLE public.journal_cloud_webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_cloud_webhook_inbox FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journal_cloud_entitlement_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_cloud_entitlement_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journal_cloud_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_cloud_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journal_cloud_billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_cloud_billing_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.journal_cloud_webhook_inbox FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.journal_cloud_entitlement_sources FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.journal_cloud_billing_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.journal_cloud_entitlements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.journal_cloud_entitlements TO authenticated;

CREATE POLICY journal_cloud_entitlements_owner_read
 ON public.journal_cloud_entitlements
 FOR SELECT TO authenticated
 USING ((SELECT auth.uid())=user_id);

CREATE FUNCTION public.reconcile_journal_cloud_entitlement(
 p_event_id text,
 p_payload_sha256 text,
 p_event_type text,
 p_disposition text,
 p_reason text,
 p_environment text,
 p_owner_user_id uuid,
 p_external_customer_id text,
 p_product_id text,
 p_event_occurred_at timestamptz,
 p_authoritative_active boolean,
 p_authoritative_expires_at timestamptz,
 p_reconciled_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
 v_provider constant public.journal_cloud_source_provider:='revenuecat';
 v_existing_hash text;
 v_effective_disposition text:=p_disposition;
 v_effective_reason text:=p_reason;
 v_record_owner uuid;
 v_state public.journal_cloud_entitlement_state;
BEGIN
 IF p_event_id IS NULL OR pg_catalog.length(p_event_id) NOT BETWEEN 1 AND 255
 OR p_event_type IS NULL OR pg_catalog.length(p_event_type) NOT BETWEEN 1 AND 80
 OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$'
 OR p_disposition IS NULL OR p_disposition NOT IN ('reconcile','ignore','quarantine')
 OR p_reason IS NULL OR pg_catalog.length(p_reason) NOT BETWEEN 1 AND 120
 OR p_environment IS NULL OR p_environment NOT IN ('SANDBOX','PRODUCTION')
 OR p_reconciled_at IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid Journal Cloud reconciliation input';
 END IF;

 SELECT i.payload_sha256 INTO v_existing_hash
 FROM public.journal_cloud_webhook_inbox i
 WHERE i.provider=v_provider AND i.environment=p_environment
  AND i.external_event_id=p_event_id
 FOR UPDATE;

 IF FOUND THEN
  UPDATE public.journal_cloud_webhook_inbox i
  SET attempt_count=i.attempt_count+1,last_received_at=pg_catalog.now()
  WHERE i.provider=v_provider AND i.environment=p_environment
   AND i.external_event_id=p_event_id;
  IF v_existing_hash IS DISTINCT FROM p_payload_sha256 THEN
   UPDATE public.journal_cloud_webhook_inbox i
   SET disposition='quarantine',reason='event_id_payload_mismatch'
   WHERE i.provider=v_provider AND i.environment=p_environment
    AND i.external_event_id=p_event_id;
   RETURN pg_catalog.jsonb_build_object('status','payload_mismatch','processed',false);
  END IF;
  RETURN pg_catalog.jsonb_build_object('status','duplicate','processed',false);
 END IF;

 v_record_owner:=CASE WHEN p_owner_user_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id=p_owner_user_id
 ) THEN p_owner_user_id END;

 IF v_effective_disposition='reconcile' THEN
  IF p_owner_user_id IS NULL
  OR p_external_customer_id IS DISTINCT FROM p_owner_user_id::text
  OR p_authoritative_active IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Reconciliation requires one owner and authoritative state';
  END IF;
  IF v_record_owner IS NULL THEN
   v_effective_disposition:='quarantine';
   v_effective_reason:='owner_not_found';
  END IF;
 END IF;

 INSERT INTO public.journal_cloud_webhook_inbox (
  provider,environment,external_event_id,payload_sha256,event_type,
  disposition,reason,processed_at
 ) VALUES (
  v_provider,p_environment,p_event_id,p_payload_sha256,p_event_type,
  v_effective_disposition,v_effective_reason,p_reconciled_at
 );

 INSERT INTO public.journal_cloud_billing_events (
  provider,environment,external_event_id,owner_user_id,event_type,product_id,
  disposition,reason,event_occurred_at,authoritative_active,
  authoritative_expires_at,payload_sha256,processed_at
 ) VALUES (
  v_provider,p_environment,p_event_id,v_record_owner,p_event_type,p_product_id,
  v_effective_disposition,v_effective_reason,p_event_occurred_at,
  CASE WHEN v_effective_disposition='reconcile' THEN p_authoritative_active END,
  CASE WHEN v_effective_disposition='reconcile' THEN p_authoritative_expires_at END,
  p_payload_sha256,p_reconciled_at
 );

 IF v_effective_disposition<>'reconcile' THEN
  RETURN pg_catalog.jsonb_build_object(
   'status','recorded','processed',true,'disposition',v_effective_disposition
  );
 END IF;

 INSERT INTO public.journal_cloud_entitlement_sources (
  provider,environment,external_customer_id,owner_user_id,entitlement_lookup_key,
  authoritative_active,authoritative_expires_at,last_event_id,last_verified_at
 ) VALUES (
  v_provider,p_environment,p_external_customer_id,p_owner_user_id,
  'journal_cloud',p_authoritative_active,
  p_authoritative_expires_at,p_event_id,p_reconciled_at
 ) ON CONFLICT (provider,environment,external_customer_id) DO UPDATE SET
  owner_user_id=EXCLUDED.owner_user_id,
  entitlement_lookup_key=EXCLUDED.entitlement_lookup_key,
  authoritative_active=EXCLUDED.authoritative_active,
  authoritative_expires_at=EXCLUDED.authoritative_expires_at,
  last_event_id=EXCLUDED.last_event_id,
  last_verified_at=EXCLUDED.last_verified_at,
  updated_at=pg_catalog.now()
 WHERE EXCLUDED.last_verified_at>=journal_cloud_entitlement_sources.last_verified_at;

 -- Sandbox state is retained for test evidence, but only a production provider
 -- response may change the entitlement projection used by cloud authorization.
 IF p_environment='PRODUCTION' THEN
  v_state:=CASE WHEN p_authoritative_active THEN 'active' ELSE 'inactive' END;
  INSERT INTO public.journal_cloud_entitlements (
   user_id,state,source_provider,source_environment,expires_at,last_verified_at
  ) VALUES (
   p_owner_user_id,v_state,v_provider,p_environment,
   p_authoritative_expires_at,p_reconciled_at
  ) ON CONFLICT (user_id) DO UPDATE SET
   state=EXCLUDED.state,
   source_provider=EXCLUDED.source_provider,
   source_environment=EXCLUDED.source_environment,
   expires_at=EXCLUDED.expires_at,
   last_verified_at=EXCLUDED.last_verified_at,
   updated_at=pg_catalog.now()
  WHERE EXCLUDED.last_verified_at>=journal_cloud_entitlements.last_verified_at;
 END IF;

 RETURN pg_catalog.jsonb_build_object(
  'status','reconciled','processed',true,'active',p_authoritative_active
 );
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_journal_cloud_entitlement(
 text,text,text,text,text,text,uuid,text,text,timestamptz,boolean,timestamptz,timestamptz
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_journal_cloud_entitlement(
 text,text,text,text,text,text,uuid,text,text,timestamptz,boolean,timestamptz,timestamptz
) TO service_role;
COMMENT ON FUNCTION public.reconcile_journal_cloud_entitlement(
 text,text,text,text,text,text,uuid,text,text,timestamptz,boolean,timestamptz,timestamptz
) IS 'Server-only RevenueCat reconciliation; additive Journal Cloud boundary 2026-11-17';

DO $verify_before_commit$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure(
  'public.reconcile_journal_cloud_entitlement(text,text,text,text,text,text,uuid,text,text,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone)'
 );
BEGIN
 IF v_oid IS NULL
 OR NOT (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid=v_oid)
 OR NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=v_oid
   AND 'search_path=""'=ANY(p.proconfig)
 ) THEN
  RAISE EXCEPTION 'Reconciliation function security shape verification failed';
 END IF;
 IF pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role',v_oid,'EXECUTE') THEN
  RAISE EXCEPTION 'Reconciliation execute grants verification failed';
 END IF;
 IF NOT (SELECT c.relrowsecurity AND c.relforcerowsecurity FROM pg_catalog.pg_class c
  WHERE c.oid=pg_catalog.to_regclass('public.journal_cloud_entitlements')) THEN
  RAISE EXCEPTION 'Journal Cloud entitlement RLS verification failed';
 END IF;
END;
$verify_before_commit$;

COMMIT;

DO $post_commit_guard$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure(
  'public.reconcile_journal_cloud_entitlement(text,text,text,text,text,text,uuid,text,text,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone)'
 );
BEGIN
 IF v_oid IS NULL OR pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Server-only RevenueCat reconciliation; additive Journal Cloud boundary 2026-11-17' THEN
  RAISE EXCEPTION 'Journal Cloud entitlement deployment did not commit';
 END IF;
END;
$post_commit_guard$;

SELECT pg_catalog.jsonb_build_object(
 'journal_cloud_schema_apply','committed',
 'legacy_sifia_billing_changed',false,
 'customer_rows_read_or_changed',false,
 'next_step','Run 03-verify.sql and share its JSON result'
) AS journal_cloud_schema_apply_result;
