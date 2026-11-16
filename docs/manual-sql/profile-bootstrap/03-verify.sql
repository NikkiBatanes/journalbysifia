-- USER RUNS MANUALLY immediately after 02. Metadata only; no customer rows and
-- no function invocation. Expected: owner postgres; definer true;
-- search_path=""; anon/PUBLIC execute false; authenticated execute true; the
-- guarded 2026-11-16 deployment marker. Share the single JSON result for review.
WITH target AS (
 SELECT pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)') AS oid
)
SELECT pg_catalog.jsonb_build_object(
 'function_exists',p.oid IS NOT NULL,
 'identity',p.oid::regprocedure::text,
 'owner',pg_catalog.pg_get_userbyid(p.proowner),
 'security_definer',p.prosecdef,
 'search_path',(SELECT s FROM pg_catalog.unnest(p.proconfig) s WHERE s LIKE 'search_path=%' LIMIT 1),
 'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),
 'comment',pg_catalog.obj_description(p.oid,'pg_proc'),
 'public_can_execute',COALESCE((SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a),false),
 'anon_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END,
 'authenticated_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END
) AS profile_bootstrap_verification
FROM target t LEFT JOIN pg_catalog.pg_proc p ON p.oid=t.oid;
