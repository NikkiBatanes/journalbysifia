-- USER RUNS MANUALLY in the existing siFia Supabase SQL Editor.
-- Read-only metadata only: no customer rows, function invocation, or mutation.
-- Share the single JSON result for review before any apply script is prepared.
WITH target AS (
 SELECT pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)') AS oid
), required(name) AS (VALUES
 ('user_id'),('tier'),('status'),('subscription_display_name'),
 ('playbooks_limit'),('devotionals_limit'),('smart_journaling_enabled'),
 ('playbooks_used'),('devotionals_used'),('last_usage_reset'),
 ('created_at'),('updated_at')
)
SELECT pg_catalog.jsonb_build_object(
 'function_exists',p.oid IS NOT NULL,
 'identity',p.oid::regprocedure::text,
 'owner',pg_catalog.pg_get_userbyid(p.proowner),
 'security_definer',p.prosecdef,
 'result_type',pg_catalog.pg_get_function_result(p.oid),
 'search_path',(SELECT s FROM pg_catalog.unnest(p.proconfig) s WHERE s LIKE 'search_path=%' LIMIT 1),
 'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),
 'matches_2026_11_04_audit',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid))='1375a3a42b6e82c8bee176040ddca33a',
 'subscription_rls_enabled',(SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('public.user_subscriptions_new')),
 'missing_required_columns',(SELECT COALESCE(pg_catalog.jsonb_agg(r.name),'[]'::jsonb) FROM required r WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='user_subscriptions_new' AND c.column_name=r.name)),
 'identity_columns',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',c.column_name,'type',c.udt_name,'nullable',c.is_nullable,'default',c.column_default
 ) ORDER BY c.column_name),'[]'::jsonb) FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='user_subscriptions_new' AND c.column_name IN ('id','user_id')),
 'user_id_constraints',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',c.conname,'type',c.contype,'definition',pg_catalog.pg_get_constraintdef(c.oid)
 ) ORDER BY c.conname),'[]'::jsonb) FROM pg_catalog.pg_constraint c
  WHERE c.conrelid=pg_catalog.to_regclass('public.user_subscriptions_new')
   AND pg_catalog.strpos(pg_catalog.pg_get_constraintdef(c.oid),'user_id')>0),
 'tier_labels',(SELECT COALESCE(pg_catalog.jsonb_agg(e.enumlabel ORDER BY e.enumsortorder),'[]'::jsonb)
  FROM pg_catalog.pg_enum e WHERE e.enumtypid=pg_catalog.to_regtype('public.subscription_tier_new')),
 'status_labels',(SELECT COALESCE(pg_catalog.jsonb_agg(e.enumlabel ORDER BY e.enumsortorder),'[]'::jsonb)
  FROM pg_catalog.pg_enum e WHERE e.enumtypid=pg_catalog.to_regtype('public.subscription_status')),
 'execute_grantees',(SELECT COALESCE(pg_catalog.jsonb_agg(
  CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END ORDER BY a.grantee
 ),'[]'::jsonb) FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  WHERE a.privilege_type='EXECUTE'),
 'anon_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END,
 'authenticated_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END,
 'authenticated_table_privileges',(SELECT COALESCE(pg_catalog.jsonb_agg(g.privilege_type ORDER BY g.privilege_type),'[]'::jsonb)
  FROM information_schema.role_table_grants g WHERE g.table_schema='public'
   AND g.table_name='user_subscriptions_new' AND g.grantee='authenticated'),
 'subscription_policies',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',x.policyname,'command',x.cmd,'roles',x.roles,'permissive',x.permissive
 ) ORDER BY x.policyname),'[]'::jsonb) FROM pg_catalog.pg_policies x
  WHERE x.schemaname='public' AND x.tablename='user_subscriptions_new'),
 'auth_user_triggers',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',t.tgname,'enabled',t.tgenabled,'function_schema',n.nspname,'function',f.proname,
  'mentions_seeker_helper',pg_catalog.strpos(pg_catalog.lower(f.prosrc),'create_default_seeker_subscription')>0
 ) ORDER BY t.tgname),'[]'::jsonb) FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_proc f ON f.oid=t.tgfoid
  JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
  WHERE t.tgrelid=pg_catalog.to_regclass('auth.users') AND NOT t.tgisinternal),
 'referencing_function_candidates',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'schema',n.nspname,'function',f.proname,'identity',f.oid::regprocedure::text
 ) ORDER BY n.nspname,f.proname),'[]'::jsonb) FROM pg_catalog.pg_proc f
  JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
  WHERE n.nspname IN ('public','auth') AND f.prokind='f' AND f.oid<>p.oid
   AND pg_catalog.strpos(pg_catalog.lower(f.prosrc),'create_default_seeker_subscription')>0)
) AS seeker_subscription_bootstrap_preflight
FROM target t LEFT JOIN pg_catalog.pg_proc p ON p.oid=t.oid;
