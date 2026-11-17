# Journal Cloud entitlement boundary

Status: **guarded additive schema applied manually on November 17, 2026**.
The additive schema, verification, synthetic-test, containment, and empty-only
rollback scripts are now drafted locally. `02-apply.sql` committed successfully:
legacy siFia billing was unchanged and no customer rows were read or changed.
The independent `03-verify.sql` result was accepted: all four tables have
forced RLS, authenticated clients have owner-scoped SELECT only on the minimal
entitlement projection, private billing tables expose no authenticated table
privileges, and only `service_role` can execute reconciliation. Synthetic
database tests also passed: owner read, denied owner writes, denied cross-owner
reads, replay/payload-mismatch handling, sandbox isolation, and active/inactive
reconciliation were verified, with all synthetic rows rolled back. The
separate production and sandbox Edge Functions have been deployed to the
existing siFia Supabase project with gateway JWT verification disabled; each
function instead requires its own exact webhook authorization value and HMAC
signature. Both production and sandbox webhooks now have distinct private
authorization and HMAC secrets, and both passed RevenueCat's signed end-to-end
tests. Their dashboard `TEST` events were recorded as ignored and granted no
access. Purchases and cloud storage authorization are not yet complete. See
`01-preflight-reviewed.md`.

This package starts the trusted Journal Cloud entitlement boundary without
reusing siFia's existing `user_subscriptions_new`, `validated_receipts`, Apple
webhook, or receipt-validation paths. Those paths belong to the existing siFia
subscription system and are not authority for Journal Cloud.

## Why this preflight comes first

The eventual schema is additive, but we must prove that its names do not
collide with deployed objects and confirm the live Auth identity shape before
writing an apply script. `01-preflight.sql` reads PostgreSQL catalog metadata
only. It does not read customer records, invoke application functions, or
change anything.

The intended v1 boundary is:

1. RevenueCat sends an external webhook to a new, isolated Edge Function.
2. The function requires the configured Authorization value and RevenueCat
   HMAC signature over the unmodified request body.
3. The function accepts exactly one Supabase Auth UUID from RevenueCat's App
   User ID/aliases. Anonymous, transferred, or multi-account identities are
   quarantined rather than granted access.
4. A webhook is only a reconciliation trigger. The trusted server checks
   RevenueCat's current customer entitlements and never derives access solely
   from event order.
5. One server-owned transaction records the idempotent event, source state,
   and minimal owner-readable entitlement projection.
6. Mobile clients can read their minimal projection but cannot write raw
   billing events, sources, state, dates, product, quota, or ownership.

## Manual run order

| Step | File/action | Effect |
| ---: | --- | --- |
| 1 | Run `01-preflight.sql` in the existing siFia Supabase SQL Editor | Completed; metadata read only |
| 2 | Share its single JSON result | Completed and accepted; no conflicts found |
| 3 | Configure the exact Google Play product/base-plan identifiers | Completed: `journal_cloud:monthly` and `journal_cloud:annual` |
| 4 | Review and locally test the additive package and Edge Function contract | Completed: 30 focused tests pass; no SQL execution |
| 5 | Run `02-apply.sql` manually in the existing siFia Supabase SQL Editor | Completed; guarded apply committed |
| 6 | Run `03-verify.sql` manually and share its single JSON result | Completed and accepted |
| 7 | Create two new temporary Auth users, then run `04-synthetic-tests.sql` manually | Completed; all assertions passed and rows rolled back |
| 8 | Deploy the two isolated Edge Functions and enter secrets privately | Completed; API/project and distinct webhook secrets saved privately |
| 9 | Configure separate RevenueCat sandbox and production webhooks | Completed; both signed end-to-end tests passed |

`05-contain.sql` is the emergency access-containment procedure. It revokes
the server reconciliation function and the mobile owner-read path without
deleting billing evidence. `06-rollback-empty-only.sql` is available only
while every new Journal Cloud table remains empty; it intentionally refuses
to remove a boundary that contains any rows.

Credentials are entered directly in RevenueCat and Supabase Edge Function
Secrets—never pasted into chat, committed, or placed in the mobile app. The
RevenueCat v2 key has subscription-read permission only.

## Current local evidence

The pure webhook contract is implemented in
`supabase/functions/_shared/revenueCatJournalCloud.ts`. The authoritative
RevenueCat v2 lookup is isolated in `revenueCatSubscriptionState.ts`, and the
shared server handler is in `revenueCatJournalCloudHandler.ts`. Separate
production and sandbox wrappers prevent one endpoint from silently accepting
the other environment. Focused tests cover
dual authentication, HMAC body tampering, timestamp replay, strict envelope
parsing, account ambiguity, anonymous identities, transfer/temporary-grant
quarantine, environment isolation, product allowlisting, and lifecycle events
as reconciliation triggers. The production authorization projection is
updated only from a production RevenueCat lookup; sandbox state is retained
for evidence but cannot activate production access.

## Remaining launch gates

The schema and webhook boundary are deployed and verified, but this does not
authorize charging ordinary users or storing their private journals. Remaining
gates are:

- real sandbox purchase and restore tests on both stores;
- renewal, grace, billing failure, expiry, refund/revocation, and account-switch
  lifecycle tests;
- client-side encrypted upload, download, recovery, quota, and deletion paths;
- an operational recovery drill and final security/release review.

The user continues to run every SQL script manually in Supabase. No further SQL
is required for the current app-side billing increment.
