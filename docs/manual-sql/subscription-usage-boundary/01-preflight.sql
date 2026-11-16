-- USER RUNS MANUALLY in the existing siFia Supabase SQL Editor.
-- READ-ONLY METADATA ONLY: no customer rows, function invocation, or mutation.
-- Share the single JSON result before any usage-boundary apply is designed.
WITH target_tables(table_name) AS (
 VALUES
  ('user_subscriptions_new'),
  ('usage_tracking'),
  ('subscription_usage_tracking'),
  ('validated_receipts'),
  ('discount_codes')
), table_oids AS (
 SELECT t.table_name,pg_catalog.to_regclass('public.'||t.table_name) AS oid
 FROM target_tables t
), function_candidates AS (
 SELECT p.oid,n.nspname,p.proname,p.proowner,p.prosecdef,p.proconfig,p.proacl
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND (
  p.proname ILIKE '%subscription%'
  OR p.proname ILIKE '%usage%'
  OR p.proname ILIKE '%trial%'
  OR p.proname ILIKE '%receipt%'
  OR p.proname ILIKE '%discount%'
  OR pg_catalog.strpos(pg_catalog.lower(p.prosrc),'user_subscriptions_new')>0
 )
)
SELECT pg_catalog.jsonb_build_object(
 'tables',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',t.table_name,
  'exists',t.oid IS NOT NULL,
  'rls_enabled',c.relrowsecurity,
  'rls_forced',c.relforcerowsecurity,
  'owner',pg_catalog.pg_get_userbyid(c.relowner)
 ) ORDER BY t.table_name) FROM table_oids t LEFT JOIN pg_catalog.pg_class c ON c.oid=t.oid),
 'columns',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',c.table_name,'name',c.column_name,'type',c.udt_name,
  'nullable',c.is_nullable,'default',c.column_default
 ) ORDER BY c.table_name,c.ordinal_position),'[]'::jsonb)
 FROM information_schema.columns c JOIN target_tables t USING (table_name)
 WHERE c.table_schema='public'),
 'constraints',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',t.table_name,'name',c.conname,'type',c.contype,
  'definition',pg_catalog.pg_get_constraintdef(c.oid)
 ) ORDER BY t.table_name,c.conname),'[]'::jsonb)
 FROM table_oids t JOIN pg_catalog.pg_constraint c ON c.conrelid=t.oid),
 'policies',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',p.tablename,'name',p.policyname,'command',p.cmd,'roles',p.roles,
  'permissive',p.permissive,'using',p.qual,'with_check',p.with_check
 ) ORDER BY p.tablename,p.policyname),'[]'::jsonb)
 FROM pg_catalog.pg_policies p JOIN target_tables t ON t.table_name=p.tablename
 WHERE p.schemaname='public'),
 'client_table_privileges',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',g.table_name,'grantee',g.grantee,'privilege',g.privilege_type
 ) ORDER BY g.table_name,g.grantee,g.privilege_type),'[]'::jsonb)
 FROM information_schema.role_table_grants g JOIN target_tables t USING (table_name)
 WHERE g.table_schema='public' AND g.grantee IN ('anon','authenticated')),
 'effective_table_privileges',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',t.table_name,'role',r.role_name,'privilege',v.privilege,
  'allowed',CASE WHEN t.oid IS NULL THEN NULL ELSE pg_catalog.has_table_privilege(r.role_name,t.oid,v.privilege) END
 ) ORDER BY t.table_name,r.role_name,v.privilege),'[]'::jsonb)
 FROM table_oids t CROSS JOIN (VALUES ('anon'),('authenticated')) r(role_name)
 CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)),
 'enum_labels',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'type',y.typname,'label',e.enumlabel,'order',e.enumsortorder
 ) ORDER BY y.typname,e.enumsortorder),'[]'::jsonb)
 FROM pg_catalog.pg_enum e JOIN pg_catalog.pg_type y ON y.oid=e.enumtypid
 JOIN pg_catalog.pg_namespace n ON n.oid=y.typnamespace
 WHERE n.nspname='public' AND y.typname IN ('subscription_tier_new','subscription_status')),
 'triggers',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',t.table_name,'name',g.tgname,'enabled',g.tgenabled,
  'function',f.oid::regprocedure::text,
  'definition',pg_catalog.pg_get_triggerdef(g.oid)
 ) ORDER BY t.table_name,g.tgname),'[]'::jsonb)
 FROM table_oids t JOIN pg_catalog.pg_trigger g ON g.tgrelid=t.oid AND NOT g.tgisinternal
 JOIN pg_catalog.pg_proc f ON f.oid=g.tgfoid),
 'function_candidates',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'identity',f.oid::regprocedure::text,
  'owner',pg_catalog.pg_get_userbyid(f.proowner),
  'security_definer',f.prosecdef,
  'result_type',pg_catalog.pg_get_function_result(f.oid),
  'search_path',(SELECT x FROM pg_catalog.unnest(f.proconfig) x WHERE x LIKE 'search_path=%' LIMIT 1),
  'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(f.oid)),
  'public_can_execute',COALESCE((SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
   FROM pg_catalog.aclexplode(COALESCE(f.proacl,pg_catalog.acldefault('f',f.proowner))) a),false),
  'anon_can_execute',pg_catalog.has_function_privilege('anon',f.oid,'EXECUTE'),
  'authenticated_can_execute',pg_catalog.has_function_privilege('authenticated',f.oid,'EXECUTE')
 ) ORDER BY f.proname,f.oid::regprocedure::text),'[]'::jsonb) FROM function_candidates f)
) AS subscription_usage_boundary_preflight;
