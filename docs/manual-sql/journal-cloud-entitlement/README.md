# Journal Cloud entitlement — metadata preflight

Status: **read-only preflight run manually and accepted on November 17, 2026**.
No entitlement schema, webhook endpoint, secret, purchase, cloud access, or
live database change has been created. See `01-preflight-reviewed.md`.

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
| 3 | Configure the exact Google Play product/base-plan identifiers | Required before the cross-platform allowlist and live apply are finalized |
| 4 | Review the additive apply/verify/containment package after it is prepared | No execution until explicitly approved |

Do not create webhook secrets or a RevenueCat secret REST API key yet. Those
are created only when the receiving function and database transaction have
passed local/synthetic review. When needed, credentials must be entered
directly in RevenueCat and Supabase Edge Function Secrets—never pasted into
chat, committed, or placed in the mobile app.

## Current local evidence

The pure webhook contract is implemented in
`supabase/functions/_shared/revenueCatJournalCloud.ts`. Focused tests cover
dual authentication, HMAC body tampering, timestamp replay, strict envelope
parsing, account ambiguity, anonymous identities, transfer/temporary-grant
quarantine, environment isolation, product allowlisting, and lifecycle events
as reconciliation triggers. It performs no database or network work.

## Gate after the preflight

The preflight result can authorize design of the additive schema, but not a
live purchase. Before deployment we still need:

- exact Android product identifiers;
- separate sandbox and production webhook integrations;
- least-privilege RevenueCat server API credentials;
- guarded apply, independent verify, containment and rollback scripts;
- synthetic owner/cross-owner/replay/stale-event tests;
- the user to run all SQL manually;
- sandbox purchase, renewal, expiry, refund, restore and account-switch tests.
