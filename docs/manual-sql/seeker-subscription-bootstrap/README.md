# Manual security fix 2: owner-bound Seeker subscription bootstrap

Status: **client consolidation implemented locally; guarded server function
committed; integrated assertions and independent metadata verification passed;
iOS A/B app smoke testing, exact-row verification, and temporary-account cleanup
passed; this narrow increment is complete**. No subscription policy or table
grant has been changed.

This is the next narrow part of audit findings AJ-01/AJ-02. It addresses only
`create_default_seeker_subscription(uuid)`, which initializes a fixed free
Seeker row for a newly authenticated siFia user. It does not make the broader
subscription table server-owned and does not authorize Journal Cloud.

## Client change

siFia previously had two direct RPC callers and two client-side paths that could
rewrite a subscription to Seeker. The local change:

- consolidates initialization behind
  `NewSubscriptionService.createDefaultSeekerSubscription`;
- verifies the current Supabase Auth identity before requesting the RPC;
- reads the initialized row back exactly once, avoiding recursive initialization;
- rejects a mismatched owner response and sanitizes backend errors;
- preserves an existing trial/paid row created by a trusted concurrent path;
- removes AuthContext's direct tier/limit correction write.

Static inventory now finds one direct RPC caller and 30 remaining siFia mobile
subscription-table writes across five services, down from 32 writes across six
services. Those remaining purchase, trial, usage, expiry, discount, and webhook
paths must be replaced before table-level client writes are revoked.

## Accepted preflight

The user manually ran `01-preflight.sql` on 2026-11-16. The definition hash,
owner, return type, columns, RLS, unique Auth-linked owner constraint, and enum
labels match the audit. No Auth trigger or textual database-function caller was
reported. PUBLIC/anonymous execution remains, and authenticated clients retain
CRUD plus excessive table privileges under permissive owner-management policies.
See `01-preflight-reviewed.md`.

## Before running the guarded apply

1. Create two new temporary Supabase Auth users A and B. Do not open either app
   with them. Neither may already have a subscription row.
2. Retain their UUIDs privately; do not share them or save them in Git.
3. Copy `02-apply.sql` into Supabase SQL Editor and replace its two UUID values
   in the editor only.
4. Run the whole script once. Any error is a failure: run `ROLLBACK;` in a new
   query and stop. Never remove a guard to make it pass.

The script repeats the accepted baseline checks, applies the owner-bound helper,
tests own/cross/null/missing/anonymous identities, proves repeated calls are
idempotent, simulates and preserves an existing paid row, rolls all synthetic
subscription changes back to a savepoint, verifies function/grants, and commits.

The user manually ran `02-apply.sql` on 2026-11-16 and supplied its expected
success result: deployment committed, synthetic assertions passed, the simulated
existing paid row was preserved, and no synthetic subscription rows persisted.
This confirms the transaction reached its post-commit marker.

The user then manually ran the read-only `03-verify.sql`. It confirmed the
expected postgres owner, `SECURITY DEFINER`, `void` result, empty search path,
authenticated-only execution, and deployment marker. The deployed definition
MD5 is `066542bb60eee673b2f3298e150e95ee`. The real app and row checks described
below subsequently passed.

## Run order

| Step | File/action | Expected result |
| ---: | --- | --- |
| 1 | `01-preflight.sql` | Completed and accepted |
| 2 | `02-apply.sql` | Deployment committed; assertions and paid-row preservation passed; no synthetic subscriptions persisted |
| 3 | `03-verify.sql` | Completed and accepted; deployed MD5 `066542bb60eee673b2f3298e150e95ee` |
| 4 | `04-app-smoke-test.md` | Completed on iOS: all seven A/B initialization, restart, and isolation checks passed; Journal-only boundary not part of this run |
| 5 | `04-app-smoke-verify.sql` | Completed and accepted: A/B are active Seeker; Journal-only C was not tested |
| 6 | Delete temporary Auth users | Completed; A/B no longer exist in Auth |
| 7 | `07-cleanup-test-accounts.sql` | Completed and accepted; no listed Auth/subscription/profile rows remain |

`05-containment.sql` disables the hardened initializer without restoring the
vulnerability. `06-restore-audited-baseline.sql` is a last-resort service
rollback that deliberately reopens the finding. Do not run either without
review.

Do not reuse the profile-bootstrap apply script. Do not revoke subscription-table
writes yet: doing so would break 30 legitimate current app paths. This guarded
live change is a narrow budget-driven exception, not a substitute for staging
the remaining entitlement redesign.

## Expected audited baseline

- Function: `public.create_default_seeker_subscription(uuid)`
- Owner: `postgres`
- Mode: `SECURITY DEFINER`
- Return: `void`
- Audited definition MD5: `1375a3a42b6e82c8bee176040ddca33a`
- Current risk: supplied `target_user_id` is not compared with `auth.uid()`;
  PUBLIC/anonymous execution was present in the 2026-11-04 audit.

The prepared replacement keeps the signature and fixed Seeker defaults, requires
the authenticated owner, qualifies relations, pins the search path, preserves
existing rows with `ON CONFLICT DO NOTHING`, and removes PUBLIC/anonymous
execution. The guarded manual deployment completed successfully; independent
metadata verification and the iOS A/B app smoke test also passed; final
read-only row verification confirmed both accounts are independently active on
the Seeker tier.

## Local verification

The new focused test covers verified-owner initialization, missing/mismatched/
rejected identity, server denial, one-time readback, cross-owner response,
sanitized diagnostics, and preservation of an existing paid row. Lint passes
for the changed service, AuthContext, and test. Full siFia TypeScript checking
reports only the same six pre-existing `OnboardingSalesOfferScreen.tsx` errors;
the new service/AuthContext/test add no compiler errors. Database/runtime
metadata evidence passed. The user subsequently passed all seven prescribed A/B
app checks on iOS, including restart persistence and switching back to A without
cross-account leakage. The exact-row SQL verification then confirmed A and B each had
`tier=seeker` and `status=active`; the optional Journal-only boundary was not
tested in this run. The user then deleted temporary Auth users A/B and manually
ran the exact cleanup script. It reported
`temporary_account_cleanup=passed`, no Auth users present, and zero residual
subscription/profile rows to delete because the Auth deletion cascade had
already removed them. No synthetic test data remains.
