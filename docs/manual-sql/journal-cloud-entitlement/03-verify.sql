-- USER RUNS MANUALLY immediately after 02-apply.sql.
-- Read-only metadata only. No customer rows or function invocation.
WITH expected(table_name) AS (VALUES
 ('journal_cloud_entitlements'),
 ('journal_cloud_entitlement_sources'),
 ('journal_cloud_billing_events'),
 ('journal_cloud_webhook_inbox')
), target AS (
 SELECT pg_catalog.to_regprocedure(
  'public.reconcile_journal_cloud_entitlement(text,text,text,text,text,text,uuid,text,text,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone)'
 ) AS oid
)
SELECT pg_catalog.jsonb_build_object(
 'tables',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',e.table_name,'exists',c.oid IS NOT NULL,'rls_enabled',c.relrowsecurity,
  'rls_forced',c.relforcerowsecurity,'owner',pg_catalog.pg_get_userbyid(c.relowner)
 ) ORDER BY e.table_name) FROM expected e
 LEFT JOIN pg_catalog.pg_class c ON c.oid=pg_catalog.to_regclass('public.'||e.table_name)),
 'entitlement_policies',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',p.policyname,'command',p.cmd,'roles',p.roles
 ) ORDER BY p.policyname),'[]'::jsonb) FROM pg_catalog.pg_policies p
 WHERE p.schemaname='public' AND p.tablename='journal_cloud_entitlements'),
 'authenticated_entitlement_privileges',(SELECT COALESCE(pg_catalog.jsonb_agg(g.privilege_type ORDER BY g.privilege_type),'[]'::jsonb)
  FROM information_schema.role_table_grants g WHERE g.table_schema='public'
   AND g.table_name='journal_cloud_entitlements' AND g.grantee='authenticated'),
 'authenticated_private_table_privileges',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',g.table_name,'privilege',g.privilege_type
 ) ORDER BY g.table_name,g.privilege_type),'[]'::jsonb)
  FROM information_schema.role_table_grants g WHERE g.table_schema='public'
   AND g.table_name IN ('journal_cloud_entitlement_sources','journal_cloud_billing_events','journal_cloud_webhook_inbox')
   AND g.grantee='authenticated'),
 'function',pg_catalog.jsonb_build_object(
  'exists',p.oid IS NOT NULL,
  'identity',p.oid::regprocedure::text,
  'owner',pg_catalog.pg_get_userbyid(p.proowner),
  'security_definer',p.prosecdef,
  'search_path',(SELECT x FROM pg_catalog.unnest(p.proconfig) x WHERE x LIKE 'search_path=%' LIMIT 1),
  'comment',pg_catalog.obj_description(p.oid,'pg_proc'),
  'public_can_execute',COALESCE((SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
   FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a),false),
  'anon_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END,
  'authenticated_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END,
  'service_role_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') END
 ),
 'legacy_objects_unchanged',pg_catalog.jsonb_build_object(
  'user_subscriptions_new_exists',pg_catalog.to_regclass('public.user_subscriptions_new') IS NOT NULL,
  'validated_receipts_exists',pg_catalog.to_regclass('public.validated_receipts') IS NOT NULL
 )
) AS journal_cloud_schema_verification
FROM target t LEFT JOIN pg_catalog.pg_proc p ON p.oid=t.oid;
