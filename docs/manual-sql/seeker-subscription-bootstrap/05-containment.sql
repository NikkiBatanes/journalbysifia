-- USER RUNS MANUALLY ONLY if the hardened initializer must be disabled.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$
DECLARE v_oid oid:=pg_catalog.to_regprocedure('public.create_default_seeker_subscription(uuid)');
BEGIN
 IF v_oid IS NULL OR pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound fixed Seeker initializer; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Expected hardened Seeker initializer marker is absent';
 END IF;
END;
$guard$;
REVOKE EXECUTE ON FUNCTION public.create_default_seeker_subscription(uuid)
 FROM PUBLIC,anon,authenticated;
COMMIT;
