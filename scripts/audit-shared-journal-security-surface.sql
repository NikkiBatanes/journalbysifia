-- Read-only companion to audit-shared-journal-schema.sql.
-- User runs this manually in the Supabase SQL Editor; the agent must not execute it.
-- No customer rows, function/view bodies, secrets, or mutating RPC invocation.
-- Keep raw reports private; commit only reviewed summaries/synthetic fixtures.
WITH targets(name) AS (VALUES
 ('account_deletions'), ('user_profiles'), ('user_subscriptions'),
 ('user_subscriptions_new'), ('validated_receipts'),
 ('playbook_action_steps'), ('playbook_sub_tasks'), ('playbook_affirmations'),
 ('playbook_screens'), ('playbook_versions'), ('playbook_jobs'),
 ('family_subscription_groups'), ('family_invitations'), ('family_usage_analytics')
), relations AS (
 SELECT t.name, c.relkind, c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced, pg_get_userbyid(c.relowner) AS owner
 FROM targets t LEFT JOIN pg_class c ON c.oid=to_regclass(format('public.%I',t.name))
), shapes AS (
 SELECT table_name,column_name,data_type,udt_name,is_nullable
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN (SELECT name FROM targets)
), policies AS (
 SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
 FROM pg_policies WHERE schemaname='public' AND tablename IN (SELECT name FROM targets)
), grants AS (
 SELECT table_schema,table_name,grantee,privilege_type
 FROM information_schema.table_privileges
 WHERE table_schema='public' AND table_name IN (SELECT name FROM targets)
), views AS (
 SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,
   COALESCE('security_invoker=true'=ANY(c.reloptions),false) AS security_invoker,
   has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
   has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='v'
), functions AS (
 SELECT p.oid::regprocedure::text AS identity, p.proname,
   pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,
   (SELECT setting FROM unnest(p.proconfig) setting WHERE setting LIKE 'search_path=%' LIMIT 1) AS search_path,
   has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef
), roles AS (
 SELECT rolname,rolsuper,rolbypassrls,rolcanlogin,
   has_schema_privilege(rolname,'public','USAGE') AS public_usage,
   has_schema_privilege(rolname,'public','CREATE') AS public_create
 FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','service_role')
), default_grants AS (
 SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname AS schema_name,
   d.defaclobjtype AS object_type,
   CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
   a.privilege_type
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE n.nspname='public' OR d.defaclnamespace=0
)
SELECT jsonb_build_object(
 'audit_version',1,'captured_at',now(),'inspection_role',current_user,
 'data_api_schemas_setting',current_setting('pgrst.db_schemas',true),
 'relations',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.name),'[]'::jsonb) FROM relations r),
 'columns',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.table_name,r.column_name),'[]'::jsonb) FROM shapes r),
 'policies',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.tablename,r.policyname),'[]'::jsonb) FROM policies r),
 'grants',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.table_name,r.grantee,r.privilege_type),'[]'::jsonb) FROM grants r),
 'views',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.relname),'[]'::jsonb) FROM views r),
 'functions',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.identity),'[]'::jsonb) FROM functions r),
 'roles',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rolname),'[]'::jsonb) FROM roles r),
 'default_grants',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.owner,r.schema_name,r.object_type,r.grantee,r.privilege_type),'[]'::jsonb) FROM default_grants r)
) AS shared_journal_security_surface;
