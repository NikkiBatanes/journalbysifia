# Journal Cloud billing lifecycle and test matrix

Status: client foundation in progress, November 17, 2026. RevenueCat 11.0.2 is
installed in Journal by siFia and verified by focused tests plus native iOS and
Android builds. No store, RevenueCat project, product catalog, paywall, purchase,
webhook, SQL, server entitlement, or live siFia backend change is enabled yet.

This document implements the product boundary in
[Journal Cloud entitlement and free-sync boundary](journal-cloud-entitlement-boundary.md):
free compatible-record sync remains available to every signed-in account, while
only Journal-owned documents, extensions, media, and recovery snapshots require
the optional Journal Cloud entitlement.

## Recommended billing path

Use Apple In-App Purchase and Google Play Billing for purchases made inside the
mobile apps. For the first release, use RevenueCat to normalize store purchase
verification and lifecycle events, then mirror only the resulting access state
into a dedicated server-owned Supabase entitlement.

RevenueCat is recommended for this small-team release because it removes much
of the duplicated StoreKit/Play lifecycle plumbing while leaving Supabase as the
authority for Journal Cloud storage operations. Its current public pricing is
free through USD 2,500 in monthly tracked revenue, then 1% of tracked revenue;
this is a commercial dependency and must be rechecked before adoption.

Important boundary: RevenueCat customer data may help the client render honest
UI, but neither RevenueCat client state nor a mobile boolean authorizes a cloud
write. Journal Cloud upload/download endpoints read the dedicated Supabase
projection written by a trusted webhook/reconciliation path.

### Compatibility gate — passed for the client foundation

Journal now uses React Native 0.88.1. Exact `react-native-purchases` and
`react-native-purchases-ui` 11.0.2 dependencies are installed. CocoaPods
resolved and an unsigned iOS simulator build succeeded; the app then launched
and rendered normally with RevenueCat keys absent. A full four-architecture
Android Play debug APK also built successfully using Android Studio's bundled
Java runtime. This passes the SDK/runtime compile gate, not the store lifecycle
or launch gate.

The SDK configuration is intentionally inert when a platform public SDK key is
missing. No private provider key belongs in the mobile application. Store
sandbox purchases, restores, account switching, webhook reconciliation, and
server-side authorization remain mandatory before sale.

### Direct-store fallback

If the ongoing vendor fee or data-processing terms are unacceptable, integrate
StoreKit 2/App Store Server API and Google Play Billing/Developer API directly.
That avoids a billing aggregator but adds two verification stacks, App Store
Server Notifications V2, Google Cloud Pub/Sub RTDN, reconciliation jobs, key
rotation, and more on-call responsibility. It does not change the Supabase
entitlement or cloud-access contract below.

## Product catalog

Recommended v1 catalog:

| Store | Product structure | Maps to |
| --- | --- | --- |
| Apple | One `Journal Cloud` subscription group with monthly and annual auto-renewable products | `journal_cloud` |
| Google Play | One `journal_cloud` subscription with monthly and annual base plans | `journal_cloud` |

Working identifiers may be `app.journal.sifia.cloud.monthly` and
`app.journal.sifia.cloud.annual` on Apple, and `journal_cloud` with `monthly`
and `annual` base plans on Google. Final identifiers must be checked in both
consoles before any code freezes them; store product identifiers are difficult
or impossible to rename after use.

V1 recommendations:

- no free trial, offer code, discount, upgrade tier, lifetime purchase, or
  family sharing until the base lifecycle passes production-like sandbox tests;
- monthly and annual provide the same capability and storage allowance; annual
  is a billing discount, not a different entitlement;
- display localized store price/period from the store SDK, never a hard-coded
  price;
- require a Journal/siFia account before purchase because the capability is
  cross-device and account-owned;
- allow a signed-out user to keep journaling locally and to view the paywall,
  but require sign-in or account creation before opening the store purchase
  sheet.

## Identity and ownership

1. `auth.users.id` is the internal owner of the Journal vault.
2. A server-created random billing subject maps one-to-one to that user. Send
   the opaque subject—not email, name, journal data, or an admin identifier—to
   the billing provider.
3. Never silently merge an anonymous billing identity into a signed-in user.
   V1 starts purchase only after account connection, avoiding ambiguous aliases.
4. A store transaction/source may be claimed by only one billing subject. If a
   restore finds it attached to another account, stop and use an account-recovery
   flow; never transfer it automatically.
5. Multiple valid store sources may grant one account entitlement. For example,
   if a user accidentally has an active Apple and Google subscription, cancelling
   one must not revoke access granted by the other. The UI should warn them how
   to manage both.
6. Cross-platform access follows the Journal account: an Apple purchase can
   unlock Journal Cloud on the user's Android device after server verification,
   without requiring a second Google purchase.

If direct store integration is selected, send Apple's `appAccountToken` and
Google's obfuscated account identifier during purchase. They improve account
attribution but do not replace server verification.

## Logical server records

These are design names, not SQL:

| Record | Access | Purpose |
| --- | --- | --- |
| `journal_cloud_billing_subjects` | Owner can request its opaque public value; trusted server manages mapping | Maps Auth owner to billing identity without exposing email |
| `journal_cloud_entitlement_sources` | Trusted server only | One normalized Apple/Google/provider source, environment, product, period, renewal and verification state |
| `journal_cloud_entitlements` | Owner reads a minimal projection; trusted server writes | Effective account-level state derived from all valid sources |
| `journal_cloud_billing_events` | Trusted server/support only | Idempotent normalized event ledger with provider event ID, event time, receipt time and payload hash |
| `journal_cloud_webhook_inbox` | Trusted server only | Short-lived processing/retry/dead-letter state; no client access |

Raw signed store/provider payloads must never be returned through the Data API.
Keep only the minimum evidence needed for verification, disputes, replay
defense, and audit; encrypt sensitive evidence and define deletion periods.

The entitlement projection needs at least:

- owner, effective state, reason, and monotonic revision;
- remote-write allowed through and retrieval allowed through timestamps;
- effective product and source summary;
- latest provider verification time;
- deletion scheduled time, when applicable.

## Effective lifecycle

`pending` is a purchase-processing condition, not an entitlement state. It never
grants cloud access. The durable access states remain `none`, `active`, `grace`,
`expired`, and `revoked`.

| Store/provider condition | Effective state | Remote write | Retrieve/export existing cloud data | Required behavior |
| --- | --- | ---: | ---: | --- |
| Never purchased | `none` | No | No remote inventory | Local journal, manual export, and free compatible sync continue |
| Purchase pending or unverified | unchanged/`none` | No | Existing access only if another source grants it | Show processing; never grant from client success alone |
| Verified initial purchase | `active` | Yes | Yes | Record source, advance revision, start first encrypted upload only after account/key enrollment |
| Verified renewal | `active` | Yes | Yes | Extend period idempotently; do not create a second entitlement |
| Auto-renew turned off | `active` until paid-through date | Yes | Yes | Show cancellation date and Manage Subscription; do not revoke early |
| Store-defined billing grace | `grace` | Yes through grace end | Yes | Show billing issue without blocking local work |
| Billing retry/account hold without service grace | `expired` | No | Yes during disclosed recovery window | Keep local outbox; direct user to store billing management |
| Paid period ends | `expired` | No | Yes during disclosed recovery window | Free sync/local/export continue; schedule vault retention workflow |
| Refund/revocation | `revoked` unless another source remains valid | No | Recommended read/export-only recovery, except account-security hold | Stop paid writes immediately; preserve local content and audit reason |
| Resubscribe/billing recovery | `active` | Yes | Yes | Cancel pending deletion and resume the same vault; never create duplicates |
| Provider/webhook temporarily unavailable | last verified state, bounded by server dates | Based on last verified dates | Yes if previously authorized | Fail closed for new paid access, fail safe to local outbox, reconcile later |
| Account deleted | separate deletion workflow | No | No after verified deletion request | Revoke sessions, remove mapping, delete vault under disclosed retention policy |

Recommended policy for product/legal review: after expiry or refund, offer 90
days of read/export-only recovery, then delete primary encrypted cloud objects;
expire disaster-recovery copies within 30 additional days (120 days total from
expiry/refund). This is not approved policy yet. The app's privacy notice and
paywall must state the final periods before launch.

## Event processing rules

1. Authenticate the webhook and reject invalid signatures/authorization.
2. Insert the provider event ID under a unique constraint before processing.
3. Acknowledge receipt quickly; process asynchronously and retry safely.
4. Fetch current customer/subscription state from the provider after an event
   instead of trusting event order as the whole truth.
5. Update the provider source and recompute the account projection in one
   transaction with a monotonic revision.
6. Ignore duplicate and stale events. An older event cannot shorten a newer
   verified period unless a current provider lookup confirms revocation.
7. Run periodic reconciliation so a missed webhook cannot leave access wrong.
8. Separate sandbox/test and production sources. Sandbox can never grant a
   production entitlement.
9. Log event IDs, state transitions and correlation IDs—not receipts, tokens,
   journal text, encryption keys, email, or full webhook bodies.
10. Alert on dead letters, verification failures, event lag, reconciliation
    drift, and unusual cross-account claim attempts.

For Google Play, verify using `purchases.subscriptionsv2.get`, grant only a
purchased/active result, and acknowledge the initial purchase through the
trusted backend within the store deadline. Do not use order ID as the unique
purchase key. For Apple, verify signed transaction information/App Store Server
API state; the deprecated `verifyReceipt` endpoint is not the new design.

## Client behavior

| Situation | Journal client behavior |
| --- | --- |
| Signed out | Local mode. No billing SDK customer is allowed to authorize cloud operations. |
| User signs in | Switch to the account namespace only after the existing combine preview/confirmation; obtain billing subject separately. |
| Paywall opens | Fetch provider offering and server projection; present localized products and clear renewal/cancellation terms. |
| Purchase succeeds on device | Send/refresh through provider, then poll/refetch the server projection. Keep local data safe until server says active. |
| Restore Purchases | Explicit user action; refresh provider state and server projection. Account conflicts go to support/recovery. |
| Entitlement active | Enroll keys/device, then enable protected cloud outbox processing. |
| Billing fails/expires | Continue all local editing and free compatible sync; pause only paid cloud uploads. Never discard the outbox. |
| User changes account | Stop jobs, clear cached entitlement UI, lock the old account key, and initialize the new billing identity. |
| Server unreachable | Keep local writes/outbox. A cached badge may be shown, but cached access cannot bypass server enforcement. |

Apple states that transaction information normally refreshes automatically;
force `AppStore.sync()` only after an explicit Restore Purchases action because
it can prompt for App Store credentials.

## Required test matrix

Every test uses synthetic accounts and store sandbox/test environments. SQL,
when later prepared, is run manually by the user.

### Identity and authorization

| ID | Test | Pass condition |
| --- | --- | --- |
| I-01 | Anonymous client calls entitlement/vault endpoints | No owner data or paid operation is returned |
| I-02 | Account A requests B's entitlement, event, object, or snapshot | Denied; no existence leak or mutation |
| I-03 | Client sets `active`, product, expiry, source, quota, or owner | Rejected; projection unchanged |
| I-04 | A restores a transaction already linked to B | No transfer; recovery path shown and both vaults unchanged |
| I-05 | Sign out A, sign in B with queued uploads | A jobs stop; no A bytes/keys/metadata enter B namespace |
| I-06 | Same account on iOS and Android | One effective entitlement and one vault; no duplicate canonical records |

### Store lifecycle

| ID | Test | Pass condition |
| --- | --- | --- |
| L-01 | Monthly and annual initial purchase | Server-verified active state; one source; upload begins only after key enrollment |
| L-02 | Pending, cancelled, or failed purchase | No paid entitlement; local content remains available |
| L-03 | Renewal | Period advances once; duplicate notification is a no-op |
| L-04 | User disables auto-renew | Access remains active through paid-through time |
| L-05 | Grace period | Cloud works only through verified grace end; honest billing UI shown |
| L-06 | Account hold/billing retry without grace | Upload pauses; local/outbox/export/free sync continue |
| L-07 | Expiry | Paid writes denied; retrieval policy and deletion schedule are correct |
| L-08 | Resubscribe before deletion | Same vault resumes; deletion cancelled; no duplicate objects |
| L-09 | Refund/revoke | Paid writes stop; reason and recovery policy apply; no local deletion |
| L-10 | Apple/Google subscription active simultaneously | Either source grants access; expiry of one does not override the other |
| L-11 | Sandbox event hits production endpoint | Cannot grant production access |
| L-12 | Reinstall/new device/explicit restore | Entitlement and decryptable vault recover only for the correct account/key flow |

### Reliability and adversarial delivery

| ID | Test | Pass condition |
| --- | --- | --- |
| R-01 | Same event delivered repeatedly/concurrently | One ledger entry and one effective transition |
| R-02 | Newer renewal arrives before older failure/expiry | Projection never moves backward without current provider confirmation |
| R-03 | Webhook signature/header invalid | Rejected, alerted, no state change |
| R-04 | Provider lookup times out | Event retries; no guessed access or premature revocation |
| R-05 | Database transaction fails mid-processing | Source/projection remain atomic and event can retry |
| R-06 | Webhook disabled or missed | Reconciliation repairs drift within the documented objective |
| R-07 | App/server offline during device purchase success | Store purchase can be recovered; no data loss or duplicate charge |
| R-08 | Google purchase remains unacknowledged | Alert/retry before deadline; entitlement is not silently left inconsistent |
| R-09 | Cloud kill switch activated | Remote writes stop while local edits/outbox remain intact |
| R-10 | Entitlement cache tampered with on device | Server denies unauthorized cloud operation |

### Data lifecycle and recovery

| ID | Test | Pass condition |
| --- | --- | --- |
| D-01 | Cancel with active paid period | Nothing deleted; active until store expiry |
| D-02 | Expire then export during recovery window | Complete decryptable export succeeds with no new cloud writes |
| D-03 | Retention deadline reached | Primary objects deleted once; audit proof remains minimal |
| D-04 | Disaster-recovery restore | Entitlement projection and encrypted object inventory restore to measured RPO/RTO without exposing plaintext |
| D-05 | Account deletion with active subscription | User is warned to manage store subscription; backend deletion does not claim store cancellation unless actually performed |
| D-06 | Key lost but billing active | Billing access does not bypass encryption; recovery flow is explicit and tested |

## Rollout gates

1. Approve billing provider, data-processing terms, product identifiers, pricing,
   storage allowance, recovery period, deletion period, and support process.
2. Resolve the React Native/billing SDK compatibility gate.
3. Prepare the additive Supabase schema and RLS/RPC/webhook design with rollback;
   user reviews and manually runs all SQL only after the design is accepted.
4. Implement provider test-store integration and synthetic webhook handling with
   the cloud feature disabled.
5. Pass the complete matrix in Apple sandbox/TestFlight and Google license-test
   tracks on physical devices.
6. Enable for internal accounts, then a small cohort, with a kill switch and
   monitored event/reconciliation objectives.
7. Charge ordinary users only after encrypted upload, restore/export, retention,
   operational recovery, and support runbooks pass—not merely when the paywall
   can complete a purchase.

## Primary current references

- Apple App Store Server API and signed transaction information:
  <https://developer.apple.com/documentation/appstoreserverapi>
- Apple App Store Server Notifications V2 event meanings:
  <https://developer.apple.com/documentation/appstoreservernotifications/notificationtype>
- Apple account association token:
  <https://developer.apple.com/documentation/storekit/transaction/appaccounttoken>
- Apple restore/synchronization behavior:
  <https://developer.apple.com/documentation/storekit/appstore/sync()>
- Apple receipt-validation migration guidance:
  <https://developer.apple.com/documentation/storekit/validating-receipts-with-the-app-store>
- Google subscription lifecycle and `subscriptionsv2.get` source of truth:
  <https://developer.android.com/google/play/billing/lifecycle/subscriptions>
- Google purchase security and backend acknowledgement:
  <https://developer.android.com/google/play/billing/security>
- Google account attribution:
  <https://developer.android.com/google/play/billing/developer-payload>
- RevenueCat pricing:
  <https://www.revenuecat.com/pricing>
- RevenueCat React Native prerequisite and installation guide:
  <https://www.revenuecat.com/docs/getting-started/installation/reactnative>
- RevenueCat entitlements and webhook behavior:
  <https://www.revenuecat.com/docs/getting-started/entitlements> and
  <https://www.revenuecat.com/docs/integrations/webhooks>
