-- USER RUNS MANUALLY in the Supabase SQL Editor. Read-only, no customer rows.
-- The existing siFia project result was reviewed on 2026-11-04. Re-run only
-- when asked to refresh drift evidence; 02 repeats the critical guards itself.
-- Share this metadata result for review before running any apply script.
WITH target AS (
 SELECT pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)') AS oid
), required(name) AS (VALUES
 ('id'),('email'),('first_name'),('last_name'),('bio'),('avatar_url'),
 ('faith_points'),('growth_level'),('total_faith_points_earned'),
 ('current_streak'),('longest_streak'),('last_activity_date'),
 ('email_verified'),('last_login_at'),('last_active_at'),('created_at'),('updated_at')
)
SELECT pg_catalog.jsonb_build_object(
 'function_exists',p.oid IS NOT NULL,
 'identity',p.oid::regprocedure::text,
 'owner',pg_catalog.pg_get_userbyid(p.proowner),
 'security_definer',p.prosecdef,
 'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),
 'matches_2026_11_04_audit',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid))='53e81822358e124a7b15a6b9153241e2',
 'profile_rls_enabled',(SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('public.user_profiles')),
 'missing_required_columns',(SELECT COALESCE(pg_catalog.jsonb_agg(r.name),'[]'::jsonb) FROM required r WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='user_profiles' AND c.column_name=r.name)),
 'identity_columns',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',c.column_name,'type',c.udt_name,'nullable',c.is_nullable) ORDER BY c.column_name),'[]'::jsonb)
  FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='user_profiles' AND c.column_name IN ('id','email')),
 'execute_grantees',(SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END ORDER BY a.grantee),'[]'::jsonb)
  FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.privilege_type='EXECUTE'),
 'anon_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END,
 'authenticated_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END,
 'auth_user_triggers',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name',t.tgname,'enabled',t.tgenabled,'function_schema',n.nspname,'function',f.proname,
  'mentions_profile_helper',pg_catalog.strpos(pg_catalog.lower(f.prosrc),'create_default_user_profile')>0) ORDER BY t.tgname),'[]'::jsonb)
  FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc f ON f.oid=t.tgfoid
  JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
  WHERE t.tgrelid=pg_catalog.to_regclass('auth.users') AND NOT t.tgisinternal),
 'referencing_function_candidates',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'schema',n.nspname,'function',f.proname,'identity',f.oid::regprocedure::text) ORDER BY n.nspname,f.proname),'[]'::jsonb)
  FROM pg_catalog.pg_proc f JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
  WHERE n.nspname IN ('public','auth') AND f.prokind='f' AND f.oid<>p.oid
   AND pg_catalog.strpos(pg_catalog.lower(f.prosrc),'create_default_user_profile')>0)
) AS profile_bootstrap_preflight
FROM target t LEFT JOIN pg_catalog.pg_proc p ON p.oid=t.oid;
