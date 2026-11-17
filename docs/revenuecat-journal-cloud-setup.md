# RevenueCat setup for Journal Cloud

Status: iOS catalog and read-only preview checkpoints verified, November 17,
2026. The client SDK foundation is installed. The Apple public SDK key remains
local and untracked; the app successfully fetched the real `default` offering
from RevenueCat in an iOS simulator and displayed its localized prices on the
Journal Cloud screen. This test commerce configuration does not by itself
authorize Journal Cloud server access.

## Fixed product boundary

- RevenueCat is for **Journal by siFia** first. The siFia app is not receiving a
  RevenueCat integration in this release.
- `journal_cloud` protects Journal-only documents, extensions, media, and
  recoverable cloud versions.
- Compatible siFia records continue to sync for every signed-in siFia account,
  even without Journal Cloud.
- Signed-out Journal users keep local journaling and free manual export. They
  must sign in before buying or restoring account-owned cloud access.
- RevenueCat customer data can drive labels and purchase UI, but only a trusted
  server entitlement mirror may authorize cloud upload/download operations.

## Dashboard checklist

Complete these steps in test/sandbox mode first.

| Order | Where | Action | Done when |
| ---: | --- | --- | --- |
| 1 | RevenueCat | Create one project for Journal by siFia | The project exists with no production purchase traffic |
| 2 | RevenueCat | Add the Apple app with bundle ID `app.journal.sifia` | RevenueCat shows an Apple public SDK key beginning with `appl_` |
| 3 | RevenueCat | Add the Google app with package `app.journal.sifia` | RevenueCat shows an Android public SDK key beginning with `goog_` |
| 4 | App Store Connect | Create one Journal Cloud subscription group and monthly/annual auto-renewable subscriptions | Both products are available for sandbox configuration |
| 5 | Google Play Console | Create subscription `journal_cloud` with `monthly` and `annual` base plans | Both base plans are active for license testing |
| 6 | RevenueCat | Connect App Store Connect and Google Play credentials directly in the RevenueCat dashboard | Provider validation succeeds; credentials never enter source control or chat |
| 7 | RevenueCat | Import the Apple and Google products | All four store variants appear in the catalog |
| 8 | RevenueCat | Create entitlement `journal_cloud` and attach every monthly/annual product | Each product grants exactly the same entitlement |
| 9 | RevenueCat | Create offering `default` with monthly and annual packages | The offering returns both localized store products |
| 10 | Local `.env.mobile` | Add the two platform **public SDK keys** and retain `REVENUECAT_JOURNAL_CLOUD_ENTITLEMENT=journal_cloud` | A local sandbox build can fetch the `default` offering |

### Verified iOS checkpoint — November 17, 2026

- Apple subscription group: `Journal Cloud`.
- Apple products: `app.journal.sifia.cloud.monthly` and
  `app.journal.sifia.cloud.annual`.
- RevenueCat entitlement: `journal_cloud`; both products attached.
- RevenueCat current offering: `default`, containing `$rc_monthly` and
  `$rc_annual`.
- The local iOS SDK returned the monthly product as USD 1.99 / `P1M` and the
  annual product as USD 19.99 / `P1Y`; catalog validation reported no issues.
- Products were added to RevenueCat manually. The optional App Store Connect
  API key for automatic catalog/price synchronization remains a pre-release
  credential task; it is different from the already-valid In-App Purchase key.
- No purchase, restore, entitlement grant, webhook, or cloud write was invoked.

Working Apple product identifiers are
`app.journal.sifia.cloud.monthly` and
`app.journal.sifia.cloud.annual`. Confirm them before creation because store
identifiers are difficult or impossible to rename after use. Google uses the
single subscription ID `journal_cloud` with `monthly` and `annual` base plans.
Monthly and annual must provide the same storage/features; annual is only a
billing-period discount.

## Approved launch pricing and allowance

| Storefront | Monthly | Annual |
| --- | ---: | ---: |
| Philippines override | PHP 59 | PHP 349 |
| United States base | USD 1.99 | USD 19.99 |
| Other storefronts | Apple-equivalent localized price | Apple-equivalent localized price |

Both billing periods grant one account-level **5 GB total Journal Cloud
allowance**. The allowance is not renewed or multiplied each month. V1 includes
journal documents and compressed photos; it does not include video or promise
unlimited storage. The paywall, store metadata, settings usage meter, FAQ, and
subscription terms must disclose the 5 GB total before purchase.

## Keep these values private

Upload App Store Connect private keys, Google service-account JSON, RevenueCat
secret API keys, and future webhook authorization secrets directly to their
provider dashboards or approved secret manager. Never paste them into chat,
commit them, add them to `.env.example`, or ship them inside the mobile app.

RevenueCat's platform mobile SDK keys (`appl_...` and `goog_...`) are public
application identifiers, not server secrets. Enter them only in the untracked
local `.env.mobile` while testing. Never use a RevenueCat Test Store key in a
release build.

## Read-only preview now implemented

- Profile includes an Account & Data entry labeled `Get Journal Cloud`, with
  optional cloud backup/recovery/device-sync language and no storage allowance
  that could be mistaken for an active grant.
- The preview discloses 5 GB total storage, compressed-photo scope, and the
  separation between free compatible siFia sync and paid Journal-only cloud.
- Prices come from the validated current store offering. An incomplete or
  unavailable catalog shows a retry state and never a guessed price.
- The screen is explicitly labeled `Optional subscription`. Monthly and annual
  store plans are selectable, and the disabled Continue label follows the
  selection so the preview reads as an offer without initiating commerce.
- Account creation/sign-in is explained as a future checkout step; existing
  siFia users may use the same account. Purchase and restore controls remain
  unavailable.

## Deliberately not enabled yet

- No purchase button or provider purchase sheet is connected.
- No client entitlement enables cloud storage.
- No RevenueCat webhook endpoint or Supabase entitlement tables exist.
- No SQL should be run for this checklist.
- Pricing and the 5 GB total allowance are approved. The recovery window,
  post-expiry retention promise, image limits/compression policy, and support
  process are not final.

The pure authenticated-webhook contract and metadata-only entitlement preflight
are now prepared. The user runs
`docs/manual-sql/journal-cloud-entitlement/01-preflight.sql` manually and shares
its single JSON result before additive schema/apply SQL is designed. The future
webhook/server implementation must pass guarded apply/verify gates before
sandbox purchasing is enabled and before any cloud write relies on it. Android
catalog setup can proceed independently.
