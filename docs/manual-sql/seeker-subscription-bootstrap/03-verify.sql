-- USER RUNS MANUALLY immediately after 02. Read-only metadata only.
WITH target AS (
 SELECT pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)') AS oid
)
SELECT pg_catalog.jsonb_build_object(
 'function_exists',p.oid IS NOT NULL,
 'identity',p.oid::regprocedure::text,
 'owner',pg_catalog.pg_get_userbyid(p.proowner),
 'security_definer',p.prosecdef,
 'result_type',pg_catalog.pg_get_function_result(p.oid),
 'search_path',(SELECT s FROM pg_catalog.unnest(p.proconfig) s WHERE s LIKE 'search_path=%' LIMIT 1),
 'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),
 'comment',pg_catalog.obj_description(p.oid,'pg_proc'),
 'public_can_execute',COALESCE((SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
  FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a),false),
 'anon_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END,
 'authenticated_can_execute',CASE WHEN p.oid IS NOT NULL THEN pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END
) AS seeker_subscription_bootstrap_verification
FROM target t LEFT JOIN pg_catalog.pg_proc p ON p.oid=t.oid;
