-- DESTRUCTIVE MANUAL ROLLBACK FOR AN UNUSED/EMPTY DEPLOYMENT ONLY.
-- Never run after real Journal Cloud activity. Guards abort if any row exists.
BEGIN;
DO $empty_guard$
BEGIN
 IF EXISTS (SELECT 1 FROM public.journal_cloud_entitlements)
 OR EXISTS (SELECT 1 FROM public.journal_cloud_entitlement_sources)
 OR EXISTS (SELECT 1 FROM public.journal_cloud_billing_events)
 OR EXISTS (SELECT 1 FROM public.journal_cloud_webhook_inbox) THEN
  RAISE EXCEPTION 'Journal Cloud rows exist; empty-only rollback refused';
 END IF;
 IF pg_catalog.obj_description(pg_catalog.to_regprocedure(
  'public.reconcile_journal_cloud_entitlement(text,text,text,text,text,text,uuid,text,text,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone)'
 ),'pg_proc') IS DISTINCT FROM
 'Server-only RevenueCat reconciliation; additive Journal Cloud boundary 2026-11-17' THEN
  RAISE EXCEPTION 'Deployment marker differs; rollback refused';
 END IF;
END;
$empty_guard$;
DROP FUNCTION public.reconcile_journal_cloud_entitlement(
 text,text,text,text,text,text,uuid,text,text,timestamptz,boolean,timestamptz,timestamptz
);
DROP TABLE public.journal_cloud_billing_events;
DROP TABLE public.journal_cloud_entitlements;
DROP TABLE public.journal_cloud_entitlement_sources;
DROP TABLE public.journal_cloud_webhook_inbox;
DROP TYPE public.journal_cloud_entitlement_state;
DROP TYPE public.journal_cloud_source_provider;
COMMIT;
SELECT pg_catalog.jsonb_build_object(
 'journal_cloud_empty_rollback','completed',
 'rows_deleted',0
) AS journal_cloud_empty_rollback_result;
