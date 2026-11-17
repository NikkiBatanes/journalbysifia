-- EMERGENCY MANUAL CONTAINMENT ONLY. Do not run during normal deployment.
-- This preserves all rows while disabling webhook reconciliation and client
-- entitlement reads. It does not delete Journal Cloud or legacy siFia data.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.reconcile_journal_cloud_entitlement(
 text,text,text,text,text,text,uuid,text,text,timestamptz,boolean,timestamptz,timestamptz
) FROM service_role;
REVOKE SELECT ON TABLE public.journal_cloud_entitlements FROM authenticated;
COMMIT;
SELECT pg_catalog.jsonb_build_object(
 'journal_cloud_containment','enabled',
 'data_deleted',false
) AS journal_cloud_containment_result;
