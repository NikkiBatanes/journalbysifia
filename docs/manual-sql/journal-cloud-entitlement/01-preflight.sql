-- USER RUNS MANUALLY in the existing siFia Supabase SQL Editor.
-- READ-ONLY CATALOG METADATA ONLY: no customer rows, function invocation,
-- transaction, DDL, DML, locks, secrets, or storage objects are accessed.
-- Share the single JSON result before any apply SQL is prepared.
WITH intended_relations(name) AS (
 VALUES
  ('journal_cloud_entitlements'),
  ('journal_cloud_entitlement_sources'),
  ('journal_cloud_billing_events'),
  ('journal_cloud_webhook_inbox')
), relation_matches AS (
 SELECT i.name,n.nspname AS schema_name,c.relkind,
  pg_catalog.pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced,c.oid
 FROM intended_relations i
 LEFT JOIN pg_catalog.pg_class c ON c.relname=i.name
 LEFT JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
), function_candidates AS (
 SELECT p.oid,n.nspname,p.proname,p.proowner,p.prosecdef,p.proconfig,p.proacl
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND (
  p.proname ILIKE '%journal_cloud%'
  OR p.proname ILIKE '%revenuecat%'
  OR pg_catalog.strpos(pg_catalog.lower(p.prosrc),'journal_cloud')>0
  OR pg_catalog.strpos(pg_catalog.lower(p.prosrc),'revenuecat')>0
 )
), intended_types(name) AS (
 VALUES ('journal_cloud_entitlement_state'),('journal_cloud_source_provider')
)
SELECT pg_catalog.jsonb_build_object(
 'database',pg_catalog.jsonb_build_object(
  'server_version',pg_catalog.current_setting('server_version'),
  'current_database',pg_catalog.current_database(),
  'current_user',CURRENT_USER
 ),
 'auth_identity_column',(SELECT pg_catalog.jsonb_build_object(
  'type',c.udt_name,'nullable',c.is_nullable,'default',c.column_default
 ) FROM information_schema.columns c
  WHERE c.table_schema='auth' AND c.table_name='users' AND c.column_name='id'),
 'required_roles',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'role',r.name,'exists',x.oid IS NOT NULL,'can_login',x.rolcanlogin,
  'bypass_rls',x.rolbypassrls
 ) ORDER BY r.name) FROM (VALUES ('anon'),('authenticated'),('service_role')) r(name)
 LEFT JOIN pg_catalog.pg_roles x ON x.rolname=r.name),
 'extensions',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',e.extname,'version',e.extversion,'schema',n.nspname
 ) ORDER BY e.extname),'[]'::jsonb) FROM pg_catalog.pg_extension e
 JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
 WHERE e.extname IN ('pgcrypto','uuid-ossp')),
 'intended_relation_matches',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',r.name,'schema',r.schema_name,'kind',r.relkind,'owner',r.owner,
  'rls_enabled',r.rls_enabled,'rls_forced',r.rls_forced
 ) ORDER BY r.name,r.schema_name) FROM relation_matches r),
 'existing_columns',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',c.table_name,'name',c.column_name,'type',c.udt_name,
  'nullable',c.is_nullable,'default',c.column_default
 ) ORDER BY c.table_name,c.ordinal_position),'[]'::jsonb)
 FROM information_schema.columns c JOIN intended_relations i ON i.name=c.table_name
 WHERE c.table_schema='public'),
 'existing_constraints',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',r.name,'name',c.conname,'type',c.contype,
  'definition',pg_catalog.pg_get_constraintdef(c.oid)
 ) ORDER BY r.name,c.conname),'[]'::jsonb)
 FROM relation_matches r JOIN pg_catalog.pg_constraint c ON c.conrelid=r.oid),
 'existing_policies',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',p.tablename,'name',p.policyname,'command',p.cmd,'roles',p.roles,
  'permissive',p.permissive,'using',p.qual,'with_check',p.with_check
 ) ORDER BY p.tablename,p.policyname),'[]'::jsonb)
 FROM pg_catalog.pg_policies p JOIN intended_relations i ON i.name=p.tablename
 WHERE p.schemaname='public'),
 'existing_client_grants',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',g.table_name,'grantee',g.grantee,'privilege',g.privilege_type
 ) ORDER BY g.table_name,g.grantee,g.privilege_type),'[]'::jsonb)
 FROM information_schema.role_table_grants g
 JOIN intended_relations i ON i.name=g.table_name
 WHERE g.table_schema='public' AND g.grantee IN ('anon','authenticated')),
 'existing_triggers',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'table',r.name,'name',t.tgname,'enabled',t.tgenabled,
  'function',f.oid::regprocedure::text,
  'definition',pg_catalog.pg_get_triggerdef(t.oid)
 ) ORDER BY r.name,t.tgname),'[]'::jsonb)
 FROM relation_matches r
 JOIN pg_catalog.pg_trigger t ON t.tgrelid=r.oid AND NOT t.tgisinternal
 JOIN pg_catalog.pg_proc f ON f.oid=t.tgfoid),
 'intended_type_matches',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',i.name,'schema',n.nspname,'kind',t.typtype
 ) ORDER BY i.name,n.nspname) FROM intended_types i
 LEFT JOIN pg_catalog.pg_type t ON t.typname=i.name
 LEFT JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace),
 'function_candidates',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'identity',f.oid::regprocedure::text,
  'owner',pg_catalog.pg_get_userbyid(f.proowner),
  'security_definer',f.prosecdef,
  'result_type',pg_catalog.pg_get_function_result(f.oid),
  'search_path',(SELECT x FROM pg_catalog.unnest(f.proconfig) x
   WHERE x LIKE 'search_path=%' LIMIT 1),
  'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(f.oid)),
  'public_can_execute',COALESCE((SELECT pg_catalog.bool_or(
   a.grantee=0 AND a.privilege_type='EXECUTE'
  ) FROM pg_catalog.aclexplode(COALESCE(
   f.proacl,pg_catalog.acldefault('f',f.proowner)
  )) a),false),
  'anon_can_execute',pg_catalog.has_function_privilege('anon',f.oid,'EXECUTE'),
  'authenticated_can_execute',pg_catalog.has_function_privilege('authenticated',f.oid,'EXECUTE')
 ) ORDER BY f.proname,f.oid::regprocedure::text),'[]'::jsonb)
 FROM function_candidates f),
 'legacy_objects_unchanged',pg_catalog.jsonb_build_object(
  'user_subscriptions_new_exists',pg_catalog.to_regclass('public.user_subscriptions_new') IS NOT NULL,
  'validated_receipts_exists',pg_catalog.to_regclass('public.validated_receipts') IS NOT NULL,
  'seeker_initializer_exists',pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)') IS NOT NULL
 )
) AS journal_cloud_entitlement_preflight;
