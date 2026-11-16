-- USER RUNS MANUALLY ONLY if the hardened helper needs temporary containment.
-- Disables mobile/default-public execution; does not restore vulnerable code.
-- Effect: missing-profile repair can fail gracefully until corrected. Existing
-- direct owner-scoped profile operations are outside this helper and unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $containment_guard$
DECLARE
 v_oid oid:=pg_catalog.to_regprocedure('public.create_default_user_profile(uuid,text)');
BEGIN
 IF v_oid IS NULL OR pg_catalog.obj_description(v_oid,'pg_proc') IS DISTINCT FROM
  'Owner-bound profile bootstrap; caller email ignored; guarded manual security patch 2026-11-16' THEN
  RAISE EXCEPTION 'Expected hardened deployment marker is absent; stop and review';
 END IF;
END;
$containment_guard$;
REVOKE EXECUTE ON FUNCTION public.create_default_user_profile(uuid,text)
 FROM PUBLIC,anon,authenticated;
COMMIT;
