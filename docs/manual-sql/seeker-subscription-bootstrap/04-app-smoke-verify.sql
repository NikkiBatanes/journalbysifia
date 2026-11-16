-- USER RUNS MANUALLY after the app smoke test and before deleting test users.
-- Read-only exact synthetic IDs only. Replace A/B; replace C only if the
-- Journal-only boundary was tested, otherwise leave the optional marker.
WITH fixture AS (
 SELECT
  'REPLACE_WITH_TEST_USER_A_UUID'::uuid AS a,
  'REPLACE_WITH_TEST_USER_B_UUID'::uuid AS b,
  NULLIF(
   'OPTIONAL_REPLACE_WITH_JOURNAL_ONLY_USER_C_UUID_OR_LEAVE',
   'OPTIONAL_REPLACE_WITH_' || 'JOURNAL_ONLY_USER_C_UUID_OR_LEAVE'
  )::uuid AS c
), rows AS (
 SELECT s.user_id,s.tier::text AS tier,s.status::text AS status
 FROM public.user_subscriptions_new s,fixture f
 WHERE s.user_id IN (f.a,f.b) OR (f.c IS NOT NULL AND s.user_id=f.c)
)
SELECT pg_catalog.jsonb_build_object(
 'user_a',(SELECT pg_catalog.to_jsonb(r.*)-'user_id' FROM rows r,fixture f WHERE r.user_id=f.a),
 'user_b',(SELECT pg_catalog.to_jsonb(r.*)-'user_id' FROM rows r,fixture f WHERE r.user_id=f.b),
 'journal_only_user_tested',(SELECT c IS NOT NULL FROM fixture),
 'journal_only_user_has_sifia_subscription',(SELECT CASE WHEN c IS NULL THEN NULL ELSE EXISTS (
  SELECT 1 FROM rows r WHERE r.user_id=c
 ) END FROM fixture)
) AS seeker_app_smoke_verification;
