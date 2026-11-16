-- LAST-RESORT USER-RUN SERVICE ROLLBACK ONLY.
-- This restores the audited behavior and broad execute access that caused
-- AJ-01. It is NOT a security-safe steady state. Prefer 05-containment.sql and
-- a corrected forward patch. Run only after reviewing an actual production
-- failure and accepting the temporary cross-account/privacy exposure.
--
-- This script refuses to replace an unknown function. It may run only when the
-- 2026-11-16 hardened deployment marker is present.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $rollback_guard$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)');
BEGIN
 IF v_oid IS NULL OR pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound profile bootstrap; caller email ignored; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Expected hardened deployment marker is absent; stop and review';
 END IF;
END;
$rollback_guard$;

CREATE OR REPLACE FUNCTION public.create_default_user_profile(p_user_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_profile_data JSONB;
BEGIN
  -- Insert the default profile
  INSERT INTO user_profiles (
    id,
    email,
    first_name,
    last_name,
    bio,
    avatar_url,
    faith_points,
    growth_level,
    total_faith_points_earned,
    current_streak,
    longest_streak,
    last_activity_date,
    email_verified,
    last_login_at,
    last_active_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    'User',
    '',
    '',
    NULL,
    0,
    'Seedling',
    0,
    0,
    0,
    CURRENT_DATE,
    FALSE,
    NOW(),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING to_jsonb(user_profiles.*) INTO v_profile_data;

  RETURN v_profile_data;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating default profile for user %: %', p_user_id, SQLERRM;
    RETURN NULL;
END;
$function$;

ALTER FUNCTION public.create_default_user_profile(uuid,text) RESET search_path;
GRANT EXECUTE ON FUNCTION public.create_default_user_profile(uuid,text)
 TO PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.create_default_user_profile(uuid,text) IS NULL;

DO $baseline_check$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)');
BEGIN
 IF NOT (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid=v_oid)
 OR EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p
  WHERE p.oid=v_oid AND p.proconfig IS NOT NULL
   AND EXISTS (
    SELECT 1 FROM pg_catalog.unnest(p.proconfig) s WHERE s LIKE 'search_path=%'
   )
 ) THEN
  RAISE EXCEPTION 'Audited function security settings were not restored; rollback cancelled';
 END IF;
 IF NOT pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
  RAISE EXCEPTION 'Audited execute grants were not restored; rollback cancelled';
 END IF;
END;
$baseline_check$;

COMMIT;

SELECT pg_catalog.jsonb_build_object(
 'audited_baseline_restored',true,
 'security_finding_AJ_01_reopened',true,
 'required_next_action','Prepare and deploy a corrected owner-bound forward fix'
) AS emergency_profile_rollback_result;
