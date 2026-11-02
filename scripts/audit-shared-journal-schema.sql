-- Phase 0 metadata audit, not a migration. One SELECT returns one report so
-- SQL editors/API clients do not discard intermediate result sets.
-- No authored records, object paths/bytes, function bodies, or secrets.
-- Usage: supabase db query --linked --file scripts/audit-shared-journal-schema.sql --output json
-- Review results privately before committing synthetic schema fixtures.

-- Confirm presence, relation kind, and RLS configuration. Missing relations
-- appear explicitly rather than being mistaken for a successfully audited table.
WITH targets(name) AS (VALUES
  ('journal_entries'), ('reflection_entries'), ('prayers'), ('time_blocks'),
  ('devotionals'), ('playbooks'), ('action_steps'), ('faithful_actions')
), relation_state AS (
SELECT t.name AS target, c.relkind, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM targets t
LEFT JOIN pg_class c ON c.oid = to_regclass(format('public.%I', t.name))
), column_shapes AS (

-- Column shapes, without reading values or evaluating defaults.
SELECT c.table_name, c.column_name, c.ordinal_position, c.data_type, c.udt_name,
       c.is_nullable, c.column_default IS NOT NULL AS has_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('journal_entries', 'reflection_entries', 'prayers',
      'time_blocks', 'devotionals', 'playbooks', 'action_steps', 'faithful_actions')
), policies AS (

-- Policy expressions must be checked together with grants and RPC execution
-- privileges. RLS enabled alone does not prove safe ownership enforcement.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN (
  'journal_entries', 'reflection_entries', 'prayers', 'time_blocks',
  'devotionals', 'playbooks', 'action_steps', 'faithful_actions'))
  OR (schemaname = 'storage' AND tablename IN ('objects', 'buckets'))
), bucket_settings AS (

-- Bucket configuration only; no object names, user paths, or stored file bytes.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
), table_grants AS (

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE (table_schema = 'public' AND table_name IN (
  'journal_entries', 'reflection_entries', 'prayers', 'time_blocks',
  'devotionals', 'playbooks', 'action_steps', 'faithful_actions'))
  OR (table_schema = 'storage' AND table_name IN ('objects', 'buckets'))
), table_constraints AS (

-- Inspect keys, uniqueness, checks, and referential delete/update behavior.
SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
       con.contype, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'journal_entries', 'reflection_entries', 'prayers', 'time_blocks',
  'devotionals', 'playbooks', 'action_steps', 'faithful_actions')
), table_indexes AS (

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN (
  'journal_entries', 'reflection_entries', 'prayers', 'time_blocks',
  'devotionals', 'playbooks', 'action_steps', 'faithful_actions')
), table_triggers AS (

-- Trigger wiring only. Function bodies are deliberately excluded from this
-- export; inspect relevant bodies separately through authorized access.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       t.tgname, t.tgenabled, pn.nspname AS function_schema,
       p.proname AS function_name, p.prosecdef AS security_definer,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname = 'public' AND c.relname IN (
  'journal_entries', 'reflection_entries', 'prayers', 'time_blocks',
  'devotionals', 'playbooks', 'action_steps', 'faithful_actions')
), public_rpc_grants AS (

-- Public RPC surface, including default PUBLIC execution grants. Identity args
-- distinguish overloads; no function bodies or runtime configuration is read.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.prosecdef AS security_definer,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
WHERE n.nspname = 'public'
), installed_extensions AS (

SELECT extname, extversion
FROM pg_extension
)
SELECT jsonb_build_object(
  'audit_version', 1,
  'captured_at', now(),
  'inspection_role', current_user,
  'relations', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.target), '[]'::jsonb) FROM relation_state r),
  'columns', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.table_name, r.ordinal_position), '[]'::jsonb) FROM column_shapes r),
  'policies', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.schemaname, r.tablename, r.policyname), '[]'::jsonb) FROM policies r),
  'bucket_settings', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) FROM bucket_settings r),
  'table_grants', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.table_schema, r.table_name, r.grantee, r.privilege_type), '[]'::jsonb) FROM table_grants r),
  'constraints', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.table_name, r.conname), '[]'::jsonb) FROM table_constraints r),
  'indexes', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.tablename, r.indexname), '[]'::jsonb) FROM table_indexes r),
  'triggers', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.table_name, r.tgname), '[]'::jsonb) FROM table_triggers r),
  'rpc_grants', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.function_name, r.identity_arguments, r.grantee), '[]'::jsonb) FROM public_rpc_grants r),
  'extensions', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.extname), '[]'::jsonb) FROM installed_extensions r)
) AS shared_journal_schema_audit;
