-- LAST-RESORT SERVICE ROLLBACK ONLY. Restores the known insecure behavior and
-- broad execution grants. Prefer containment and a corrected forward patch.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE v_oid oid:=pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)');
BEGIN
 IF v_oid IS NULL OR pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound fixed Seeker initializer; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Expected hardened Seeker initializer marker is absent';
 END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.create_default_seeker_subscription(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO user_subscriptions_new (
    user_id,
    tier,
    status,
    subscription_display_name,
    playbooks_limit,
    devotionals_limit,
    smart_journaling_enabled,
    playbooks_used,
    devotionals_used,
    last_usage_reset,
    created_at,
    updated_at
  )
  VALUES (
    target_user_id,
    'seeker',
    'active',
    'siFia Seeker',
    2,
    1,
    true,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

ALTER FUNCTION public.create_default_seeker_subscription(uuid) RESET search_path;
GRANT EXECUTE ON FUNCTION public.create_default_seeker_subscription(uuid)
 TO PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.create_default_seeker_subscription(uuid) IS NULL;
COMMIT;

SELECT pg_catalog.jsonb_build_object(
 'audited_baseline_restored',true,
 'security_findings_reopened',pg_catalog.jsonb_build_array('AJ-01','AJ-02'),
 'required_next_action','Deploy a corrected owner-bound forward fix'
) AS emergency_seeker_rollback_result;
