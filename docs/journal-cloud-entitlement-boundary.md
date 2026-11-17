# Journal Cloud entitlement and free-sync boundary

Status: approved product direction, November 16, 2026. This is a design
contract, not executable SQL. No live siFia behavior or database object is
changed by this document.

## Decision

Journal Cloud is a paid capability of **Journal by siFia only**. Both apps may
use the same Supabase Auth identity, but Journal Cloud does not reuse siFia's
playbook/devotional counters, onboarding flags, or subscription tier as its
authority.

Free compatible-record synchronization and paid Journal Cloud are independent:

| Journal mode | Compatible siFia records | Journal-only records/extensions |
| --- | --- | --- |
| Local, signed out | Local only | Local only; free manual export available |
| Signed in, no Journal Cloud | Free bidirectional sync | Local only; free manual export available |
| Signed in, active Journal Cloud | Free bidirectional sync | Encrypted remote persistence, recovery, and eligible device sync |
| Cloud expired | Free bidirectional sync continues | Local writing/export continue; new paid uploads stop after billing grace; disclosed retrieval window applies |

A user may create the shared account inside Journal without installing siFia.
A siFia user may sign into Journal and synchronize compatible records without
buying Journal Cloud.

## Authority rules

1. The authenticated account UUID owns the entitlement and vault.
2. Mobile clients may read a minimal derived access result but may never insert,
   update, delete, or select raw purchase-event records.
3. Only a trusted verifier may grant, renew, place in grace, revoke, or expire
   Journal Cloud after validating Apple/Google evidence.
4. Store transaction identifiers and purchase tokens are server inputs, not
   client authority. Do not store raw credentials in client-readable tables or
   logs.
5. Provider notification/event IDs are idempotent. Replays and out-of-order
   events cannot create duplicate access or move a newer state backward.
6. One account-level entitlement works across the user's authorized Journal
   devices, subject to store policy and documented device limits.
7. No current siFia tier automatically grants Journal Cloud. A future bundle
   must be an explicit server-issued entitlement source with its own product and
   migration decision.
8. V1 uses the opaque Supabase Auth UUID as RevenueCat's App User ID. Webhooks
   may reconcile only when the event identity and aliases resolve to exactly one
   such UUID. Anonymous-only or multiple-account aliases are quarantined.

## RevenueCat webhook contract

The Journal Cloud webhook is separate from the existing siFia Apple webhook.
It requires both the exact Authorization value configured in RevenueCat and
RevenueCat's HMAC-SHA256 signature over the raw request body. Signature
timestamps have a five-minute tolerance; provider retries retain the event ID,
which is the database idempotency key.

An authenticated event does not directly set `active`, `expired`, or another
state. Relevant lifecycle events trigger a trusted lookup of the customer's
current RevenueCat entitlement, followed by one server-owned database
transaction. Transfers, temporary outage grants, ambiguous owners, unknown
products, and environment mismatches fail closed into review/quarantine.

## Logical server model

The implementation will use new, separately named, server-owned objects rather
than adding cloud authority to `user_subscriptions_new`:

- a current Journal Cloud entitlement keyed by `auth.users.id`;
- an immutable/idempotent provider-event ledger;
- a minimal owner-readable access projection or fixed RPC;
- later, separately protected vault/device/object/snapshot tables.

The current entitlement needs at least: state, provider/source, product,
effective start, current period end, billing grace end, revocation/expiry time,
last verified time, and a monotonic revision. Exact identifiers and retention
are finalized only after Apple/Google lifecycle design and privacy review.

Recommended states are intentionally small: `none`, `active`, `grace`,
`expired`, and `revoked`. Store-specific events map into these server states;
clients do not reproduce store lifecycle logic.

## Access result

The Journal client consumes a minimal decision such as:

- whether remote Journal writes are allowed;
- whether existing cloud data is temporarily retrievable;
- the effective expiry/grace time needed for honest UI;
- the product/source needed for the correct Manage Subscription route.

It does not receive raw receipts, notification payloads, service credentials,
or another user's purchase identifiers. A cached decision may support a short,
bounded offline grace for UX, but the server remains authoritative for remote
writes.

## Rollout and siFia isolation

1. Add new objects only; do not rename, migrate, or replace live siFia tables.
2. Keep the feature disabled for ordinary accounts until synthetic and store
   sandbox tests pass.
3. The siFia app does not query or display Journal Cloud in the launch slice.
4. Free compatible sync never checks the Journal Cloud entitlement.
5. Journal Cloud remote writers check the entitlement server-side on every
   protected operation; hiding UI is not enforcement.
6. A kill switch stops Journal remote writes while preserving local edits and
   outbox state.
7. Existing siFia generation/onboarding/FaithPoints findings remain a separate
   security backlog unless a specific path becomes a dependency of shared sync.

## Non-goals of this boundary

- changing siFia AI quotas or subscription tiers;
- moving existing siFia records into the paid vault;
- charging siFia users merely for viewing/syncing compatible records;
- silently uploading a guest journal at sign-in;
- treating sync as a recovery snapshot;
- deleting cloud data immediately when recurring billing is cancelled.

## Exit gate before live entitlement SQL

- exact iOS and Android products and account-linking behavior are documented;
- verifier/webhook ownership and secrets are selected;
- lifecycle mapping covers purchase, restore, renewal, billing retry/grace,
  refund, revocation, expiry, account switch, and out-of-order events;
- owner/cross-owner, anonymous, replay, stale-event, and rollback tests are
  specified;
- the additive schema and grants have an independent verification and rollback
  package;
- no existing siFia client query or write is required to change.

Until those gates are met, prepare design and read-only evidence only. The user
runs all SQL manually.
