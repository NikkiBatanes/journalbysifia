# RevenueCat setup for Journal Cloud

Status: operator checklist, November 17, 2026. The client SDK foundation is
installed but safely disabled. Completing this checklist configures test
commerce; it does not by itself authorize Journal Cloud server access.

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

Working Apple product identifiers are
`app.journal.sifia.cloud.monthly` and
`app.journal.sifia.cloud.annual`. Confirm them before creation because store
identifiers are difficult or impossible to rename after use. Google uses the
single subscription ID `journal_cloud` with `monthly` and `annual` base plans.
Monthly and annual must provide the same storage/features; annual is only a
billing-period discount.

## Keep these values private

Upload App Store Connect private keys, Google service-account JSON, RevenueCat
secret API keys, and future webhook authorization secrets directly to their
provider dashboards or approved secret manager. Never paste them into chat,
commit them, add them to `.env.example`, or ship them inside the mobile app.

RevenueCat's platform mobile SDK keys (`appl_...` and `goog_...`) are public
application identifiers, not server secrets. Enter them only in the untracked
local `.env.mobile` while testing. Never use a RevenueCat Test Store key in a
release build.

## Deliberately not enabled yet

- No purchase button or provider paywall is connected.
- No client entitlement enables cloud storage.
- No RevenueCat webhook endpoint or Supabase entitlement tables exist.
- No SQL should be run for this checklist.
- No pricing, storage quota, recovery window, or post-expiry retention promise
  is final until cost and policy approval.

After the dashboard checklist is complete, the next engineering increment is a
sandbox offering/paywall read path followed by the authenticated webhook and
server-owned entitlement mirror. The webhook/server design must pass manual SQL
preflight/apply/verify gates before any cloud write relies on it.
