-- USER RUNS MANUALLY in the existing siFia Supabase SQL Editor.
-- READ-ONLY CATALOG SOURCE REVIEW: no customer rows, function invocation, or
-- mutation. Share the single JSON result before guarded apply SQL is drafted.
WITH targets(requested_identity) AS (
 VALUES
  ('public.claim_next_playbook_job(character varying)'),
  ('public.create_devotional_from_playbook(uuid,uuid,text,text,text,integer)'),
  ('public.initialize_onboarding(uuid)'),
  ('public.record_devotional_creation(uuid,uuid,integer)'),
  ('public.record_playbook_creation(uuid,uuid,text)'),
  ('public.update_onboarding_progress(uuid,text,integer,onboarding_step_status,integer)')
), resolved AS (
 SELECT t.requested_identity,pg_catalog.to_regprocedure(t.requested_identity) AS oid
 FROM targets t
)
SELECT pg_catalog.jsonb_build_object(
 'functions',pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'requested_identity',r.requested_identity,
  'function_exists',p.oid IS NOT NULL,
  'identity',p.oid::regprocedure::text,
  'owner',pg_catalog.pg_get_userbyid(p.proowner),
  'security_definer',p.prosecdef,
  'result_type',CASE WHEN p.oid IS NULL THEN NULL
   ELSE pg_catalog.pg_get_function_result(p.oid) END,
  'search_path',(SELECT x FROM pg_catalog.unnest(p.proconfig) x
   WHERE x LIKE 'search_path=%' LIMIT 1),
  'definition_md5',CASE WHEN p.oid IS NULL THEN NULL
   ELSE pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) END,
  'public_can_execute',CASE WHEN p.oid IS NULL THEN NULL ELSE COALESCE((
   SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
   FROM pg_catalog.aclexplode(COALESCE(
    p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  ),false) END,
  'anon_can_execute',CASE WHEN p.oid IS NULL THEN NULL ELSE
   pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END,
  'authenticated_can_execute',CASE WHEN p.oid IS NULL THEN NULL ELSE
   pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END,
  'definition',CASE WHEN p.oid IS NULL THEN NULL
   ELSE pg_catalog.pg_get_functiondef(p.oid) END
 ) ORDER BY r.requested_identity)
) AS generation_function_source_review
FROM resolved r LEFT JOIN pg_catalog.pg_proc p ON p.oid=r.oid;
