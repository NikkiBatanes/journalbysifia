# Shared Journal inventory and implementation plan

Status: Finalized implementation baseline, 2026-11-03. Planning and repository inspection are underway; production shared sync, encrypted file backup, and Journal Cloud are not delivered.

This plan supersedes the earlier proposal to migrate all siFia content immediately into one paid encrypted vault. Its product model is **two independent apps, one optional account identity, free compatible-record sync, and optional paid Journal Cloud**.

## Product rules already agreed

1. Every record saved by siFia should be visible in Journal by siFia when the same account is connected and Journal has a compatible renderer.
2. Records supported by both apps have one logical identity. Create, base-field edit, and deletion synchronize in both directions.
3. A siFia artifact that Journal cannot safely edit is display-only in Journal, with an `Open in siFia` fallback for unsupported interactions.
4. Dedicated Journal-only documents (Bible Study, Scripture Notes, Session Notes, reviews) remain in Journal. A later phase may let siFia display Journal extensions on shared records read-only; that does not enable creating or editing those extensions in siFia.
5. Journal-only extensions on a shared record do not expand the siFia schema. For example, note text syncs to siFia while a Journal photo remains a child extension.
6. Free siFia account sync and paid Journal Cloud are different capabilities. Existing siFia-supported data stays free. Journal Cloud covers automatic remote persistence for Journal-only records, extensions, and media.
7. A free encrypted manual export remains available. Data that only remains inside the app is not described as backed up.
8. Reviews and routine state orchestrate or reference canonical records. They do not replace or copy the canonical authored content they point to.
9. Either app can be used without installing the other. Journal works locally without an account. A Journal-only customer can create an account and purchase Journal Cloud directly inside Journal.
10. Installing both apps does not connect them. Signing in must not silently upload a pre-existing local journal; combining local records with an account requires a preview and explicit confirmation.
11. Compatible records created in Journal qualify for free shared sync regardless of their app of origin. For example, 80 locally created Heart Journals can be combined with a siFia account without buying Journal Cloud.
12. Existing siFia shared fields are server-readable unless a separate encryption migration is completed. Journal Cloud is designed for client-side encryption with user-controlled recovery. Neither shared-account authentication nor disk encryption alone is end-to-end encryption.
13. Journal Cloud expiry stops paid remote writes after applicable billing grace. Local writing, free shared sync, and free export remain available. Cancellation does not immediately delete content.

The machine-readable contract is `src/compatibility/sharedJournalCapabilityContract.ts` (version 2). It now represents future extension read permissions and paid persistence of review/routine state. Shared packaging, per-field adapters, and runtime/server enforcement remain Phase 1/2 work; passing pure contract tests does not establish those features.

## Current architecture discovered in source

### siFia

siFia Moments currently queries several Supabase sources directly:

| Source | Representative content | Current behavior |
| --- | --- | --- |
| `journal_entries` | Gratitude, to-dos, wins, looking forward, today's focus, devotional markers | Cloud CRUD and Moments presentation |
| `reflection_entries` | Heart/reflection journals, guided, devotional, and playbook reflections | Cloud CRUD and Moments presentation |
| `prayers` | Journal prayers, people prayers, prayer requests, devotional and playbook prayers | Cloud CRUD and Moments presentation |
| `time_blocks` | Planner/time-block moments | Cloud CRUD and Moments presentation |
| `devotionals` | Generated/saved devotional artifact | siFia-owned artifact; full Journal display mapping still needs confirmation |
| `playbooks` and faithful actions | Generated/saved playbook artifact and actions | siFia-owned artifact; Journal has partial compatibility models |

The production database definitions and complete RLS policies for the legacy authored-content tables are not present in this repository. They must be exported and audited before a migration is approved.

### Journal by siFia

Journal is moving toward auth-independent local-first canonical repositories:

| Local source | Representative content | Notes |
| --- | --- | --- |
| `LocalJournalEntry` | Morning/evening moments, gratitude, focus, plans, wins | AsyncStorage, versions, tombstones, sync status, optional account link |
| `LocalReflectionEntry` | Heart Journal, guided reflections, Scripture and session notes | AsyncStorage, versions, tombstones, flexible metadata |
| `LocalPrayerEntry` | Prayer journal, people, needs, answer lifecycle | AsyncStorage, versions, tombstones |
| `BibleStudySession` | Bible Study workflow and canonical reflection/prayer references | Journal-only |
| `RoutineState` | Morning/evening progress and canonical content references | Orchestration, not authored content |
| `LocalReviewEntry` | Weekly/monthly/quarterly/year-end/begin-year answers and references | Orchestration plus review-authored answers |
| `PrayerDraft` | Incomplete prayer writing | Journal-only draft |
| Journal blocks | Text, tables, columns, Scripture, photos, voice, and other advanced blocks | Media still uses URI-based persistence and needs a durable media vault |

Journal also contains a read-only siFia compatibility boundary for reflections, prayers, devotional/playbook origins, and faithful actions. It does not yet provide a canonical two-way sync engine.

## Compatibility inventory v1

This is a source-backed starting inventory. Each row still requires a fixture from real persisted data before migration code is written.

| Family | siFia | Journal | Intended behavior | Remote persistence |
| --- | --- | --- | --- | --- |
| Daily journal/planning | Create/read/edit/delete | Create/read/edit/delete | Shared base record, bidirectional | Free siFia account |
| Heart Journal/reflections | Create/read/edit/delete | Read adapter plus local CRUD | Shared base record, bidirectional | Free siFia account |
| Prayers/needs/responses | Create/read/edit/delete | Read adapter plus local CRUD | Shared base record, bidirectional | Free siFia account |
| Time blocks | Create/read/edit/delete | Local and legacy implementations | Shared after recurrence contract is consolidated | Free siFia account |
| Saved devotional artifact | Full siFia experience | Partial derived-record compatibility | Display-only in Journal initially | Free siFia account |
| Saved playbook artifact/actions | Full siFia experience | Partial derived-record/action compatibility | Display-only in Journal initially | Free siFia account |
| Bible Study | Unsupported | Full local feature | Journal-only | Local export or paid Journal Cloud |
| Scripture Note | Unsupported | Full local feature | Journal-only | Local export or paid Journal Cloud |
| Session Notes | Unsupported as a dedicated document family | Full local feature | Journal-only | Local export or paid Journal Cloud |
| Reviews | Unsupported | Full local feature | Journal-only orchestration | Local export or paid Journal Cloud |
| Routine state | Unsupported as a shared record | Local references | Journal-only orchestration | Own state: local export or paid Journal Cloud; referenced records follow their own persistence rules |
| Prayer drafts | Unsupported | Local draft | Journal-only | Local export or paid Journal Cloud |
| Advanced blocks | Unsupported | Partial/full editor support | Journal-only child extension | Local export or paid Journal Cloud |
| Photos and voice | Unsupported in shared note schema | URI-based blocks | Journal-only child extension | Local export or paid Journal Cloud |

## Hybrid shared-record rule

One screen may compose a free shared base and a Journal-only extension:

```text
shared record: note-123
  title, text, selected date, shared metadata, version

journal extension: extension-456
  parent_record_id: note-123
  blocks: [photo]
```

- Editing the shared title or text in Journal updates `note-123` and becomes visible in siFia.
- Adding or removing the photo only mutates `extension-456`.
- Without Journal Cloud, the extension is local and included in manual export.
- With Journal Cloud, the extension and encrypted media synchronize between Journal clients.
- Future siFia display requires the same account, an authorized device with decryption access, and remotely available extension bytes. Local-only extensions remain accessible inside Journal; same-device installation does not grant access across app sandboxes.
- siFia may edit shared fields while its extension renderer stays read-only. Read-only UI is a product capability, not cryptographic proof of which binary made a request; stronger app-specific restrictions require server-enforced authorization.
- A plain-text rendering of an advanced block is display-only unless a reversible editing contract exists. Never overwrite the structured source from a flattened preview. Text explicitly included in shared base fields is server-readable; private block text must not silently enter that projection.
- Shared edits use base-revision checks and allowlisted patches. Hidden and unknown extensions survive edits made by old clients.
- Deleting the shared record creates a tombstone and moves its extensions to recoverable trash before retention cleanup.

## Inventory work still required

Before schema implementation, capture sanitized fixtures for every production discriminator and answer these questions:

1. Which `journal_entries.content_type` values exist in production, including legacy spellings?
2. Which reflection `type`, `source`, and metadata combinations exist?
3. Which prayer origins and lifecycle formats exist, including requests and answer history?
4. Is a saved devotional itself expected in Moments, or only authored prayers/reflections produced from it?
5. Which playbook fields/actions must Journal display, and which interactions must open siFia?
6. Which records use a stable UUID today and which rely on natural keys or duplicated IDs?
7. What are the live RLS policies, foreign keys, triggers, uniqueness constraints, and deletion cascades?
8. Which current siFia subscription tiers, if any, should include `journal_cloud` as a bundle entitlement?

No record bodies should be placed in tickets, analytics, logs, or committed fixtures. Fixtures must be synthetic but structurally faithful.

## Progress accounting

Percentages below are conservative planning estimates against the deliverables and exit gates in this version, not a security certification or a shipped-feature percentage. A phase reaches 100% only when its exit gate has recorded evidence. Existing local editors, auth helpers, or IAP dependencies alone do not complete a new integration phase.

Weights total 100%. Overall delivery estimate is `sum(weight × phase completion / 100)`, currently 8%, reported as **approximately 8%**. The finalized baseline was 6.1%; the first implementation increment adds reconciled policy, legacy bundle adaptation, and metadata merge preflight. This replaces the earlier approximately 19% groundwork/readiness estimate, which measured a different scope. Future optional display work is excluded from the launch denominator.

| Phase | Deliverable | Weight | Completion estimate | Status / evidence |
| --- | --- | ---: | ---: | --- |
| 0 | Complete inventory and compatibility fixtures | 6% | 65% | Legacy bundle fixtures/read adapter and metadata audit script added; live schema/policies and full variant coverage remain |
| 1 | Shared field and capability contract | 6% | 40% | V2 product/persistence rules tested in Journal; shared packaging and per-field adapters remain |
| 2 | Secure backend and legacy compatibility | 12% | 0% | New ownership/revision/change-feed enforcement unverified |
| 3 | Transactional encrypted local storage | 12% | 0% | Existing AsyncStorage records are groundwork, not the target implementation |
| 4 | Durable media and extension storage | 8% | 0% | Current URI blocks need durable bytes and independent extension identity |
| 5 | Free encrypted export and safe restore | 10% | 10% | In-memory inventory/validation exists; file, encryption, media packaging, and restore remain |
| 6 | Account connection and device enrollment | 8% | 0% | Existing auth is groundwork; safe combining/enrollment flow remains |
| 7 | Free bidirectional sync and initial merge | 14% | 5% | Metadata-only merge preflight tested; storage adapters, confirmation UI, executor, outbox/cursor/conflict engine remain |
| 8 | Encrypted Journal Cloud and versioned recovery | 12% | 0% | Cloud protocol, key recovery, and verified snapshots remain |
| 9 | Monthly/annual billing and lifecycle UX | 6% | 0% | IAP dependency exists; Journal entitlement is not implemented |
| 10 | Security review, disaster recovery, staged release | 6% | 0% | Launch evidence and recovery drill remain |
| 11 | Future siFia read-only extension display | Excluded | 0% | Planned after the core launch |

## Phase-by-phase execution

### Phase 0 — Inventory and representative fixtures

1. Trace every siFia Moments source and Journal creation/edit/delete surface to its persistence owner, variants, identifiers, timestamps, links, and attachment fields.
2. Inspect the deployed schema, grants, RLS, functions, triggers, storage policies, OAuth configuration, and app identifiers through authorized read-only access. Repository code cannot establish deployed security.
3. Build synthetic fixtures covering legacy variants, empty/large bodies, repeat entries, deleted records, prayer answer history, time zones, DST, recurrence, and rich blocks. Inventory settings and authored drafts separately from disposable caches.

Exit gate: every supported variant has a documented field mapping and fixture; unknown types have a safe fallback. Missing production access is recorded as a dependency, not inferred away.

### Phase 1 — Shared contracts and product boundaries

1. Publish one versioned internal contract dependency consumed by both apps: IDs, origin/provenance, supported operations, schema versions, revisions, tombstones, references, and extension ownership.
2. Define each shared field and its editing behavior. Keep Journal extensions independently identified and independently versioned. Preserve unsupported/unknown fields without interpreting them. Review answers and routine state receive their own backup coverage while canonical references stay references.
3. Encode local-only, connected/free-sync, and subscribed modes; explicit account-combine consent; read-only saved artifacts; future extension display; sign-out/deletion scopes; and retention/expiry states.

Exit gate: both apps pass round-trip fixture tests; editing a shared note in either app preserves its structured Journal blocks. Exact pricing, quotas, and retention policy values are documented before related features launch.

### Phase 2 — Backend authorization and compatibility

1. Add owner-scoped schema changes using an expand-and-contract migration. Keep current siFia shared tables authoritative initially; do not create a second canonical copy of every legacy record. Add stable mapping IDs where needed, revisions, a resumable change feed, idempotency keys, and a merge ledger.
2. Enforce ownership, field allowlists, version checks, deletion rules, quotas, and entitlement-sensitive writes on the server. Audit table/storage RLS and RPC grants. Keep service-role credentials on trusted servers. Validate input sizes and rate-limit abuse.
3. Capture writes/deletes from older siFia clients using audited database triggers or a controlled compatibility path. Update siFia writers for conditional edits; gate Journal two-way launch on a safe supported version. Resolve unsafe deletion code that currently accepts a body-supplied user ID before using admin privileges; deployed exposure still needs verification.

Exit gate: account A cannot read/write account B's rows or files; clients cannot set their own entitlement; stale writes cannot silently overwrite newer text; rollback and old-client behavior pass in staging.

### Phase 3 — Reliable local persistence

1. Select and validate an encrypted transactional database for React Native on both platforms; migrate canonical AsyncStorage records through a restartable, count-verified process with a rollback snapshot.
2. Introduce separate guest and account namespaces, a durable outbox saved in the same transaction as each edit, cryptographically generated IDs, explicit indexes, and migration versions. Scope caches, queries, media, and background jobs to the same namespace.
3. Store secrets through iOS Keychain / Android Keystore-backed facilities. Lock keys on sign-out and ensure pending uploads cannot run under a different account. Explain local-only data before destructive cache removal. Review OS backup exclusions and reinstall behavior on real devices.

Exit gate: app termination during save/migration, disk-full failure, account switching, logout/login, and OS restart cause no cross-account disclosure or loss of acknowledged local edits.

### Phase 4 — Extensions and durable media

1. Copy chosen media bytes out of temporary picker locations into managed app storage; encrypt them, record type/size/integrity metadata, and atomically link assets to stable block and parent IDs.
2. Extract Journal blocks into extensions without dropping existing writing. Define safe text projections and shared-field edits. Use two-stage attachment commits and recoverable cleanup so failed uploads cannot create broken references or delete live files.
3. Handle permission denial, missing legacy URIs, storage limits, very large attachments, and interrupted copies. Offer recovery/reselection for already-missing media rather than claiming those bytes are protected.

Exit gate: a Heart Journal with text, note blocks, photos, and voice survives edits, restart, export, and restore; siFia base edits preserve every extension.

### Phase 5 — Free encrypted export and restore

1. Build a versioned portable archive containing canonical records, Journal-only records, review answers/references, routine state, authored drafts, relevant settings, tombstones, and actual media bytes. Take a consistent snapshot. Exclude auth tokens, private device keys, and recreatable caches.
2. Use a vetted authenticated-encryption library and a suitable password/recovery-key scheme with explicit recovery instructions. Validate schema, integrity, resource limits, and archive paths before any restore writes; checksums alone do not authenticate a backup.
3. Save through the system file picker/share flow outside the app container. Mark success only after a successful file-write/hand-off, and explain that the user must retain that file. Provide restore preview, staged import, account-remapping confirmation, conflict handling, and rollback. Never start cloud sync from restored outbox data without reconciliation.

Exit gate: restore onto a clean iOS and Android installation succeeds with media and references intact. Wrong password, corruption, unsafe archive paths, interrupted restore, newer schema, and disk-full tests leave existing data intact. No purchase or account is required.

### Phase 6 — Identity, connection, and key enrollment

1. Offer Continue without account, Sign in/Create account, and Connect existing account inside Journal. Verify Apple/Google configurations resolve the intended existing identity; do not deduplicate accounts solely by matching email. Authentication and consent to combine guest data are separate events.
2. Give Journal distinct app links and callback schemes, app-scoped push-token registration, and secure per-app sessions. Start with normal sign-in. Add convenient cross-app SSO only through an expiring, single-use, installation-bound authorization flow with validated callback/PKCE/state; never deep-link raw access/refresh tokens.
3. For encrypted cloud access, enroll each installation using a trusted-device or user-held recovery mechanism. Password reset or a restored store purchase must not silently grant decryption access. Add recovery-key confirmation and tested recovery before users depend on cloud.

Exit gate: either app works without the other installed; the same account resolves correctly; unexpected account switching cannot claim the guest journal or another account's keys.

### Phase 7 — Initial merge and free shared sync

1. Preview the guest/account combination: local compatible records to upload, remote records to download, Journal-only records to retain locally, and uncertain duplicates/conflicts requiring review. Take a recoverable local snapshot and confirm account ownership before committing.
2. Match stable IDs and source mappings first. Similar text/date fingerprints identify candidates only; two identical-looking prayers may be distinct. Never auto-delete uncertain matches. Preserve an alias map for any changed IDs so extensions, reviews, and routines keep their references. A batch ledger makes interruption/retry safe.
3. Implement bounded paging, transactional server mutations, outbox acknowledgments, ordered cursor catch-up, retry/backoff, and deletion tombstones. Realtime is a wake-up hint rather than the only source of changes. Retain conflicting authored versions instead of using silent last-write-wins. A stale device must resnapshot safely after tombstone/cursor expiry.

Exit gate: 300 guest records including 80 Heart Journals combine correctly with an existing account, with and without attachments and with no cloud subscription. Repeating or interrupting the merge creates no additional records. Test concurrent edits, delete-versus-edit, poor network, large histories, and both app versions on both OSes.

### Phase 8 — Encrypted Journal Cloud and recovery history

1. Create a logically separate private cloud area under the same identity system for encrypted Journal-only records, extensions, media, manifests, and wrapped device keys. Minimize readable metadata. Implement reviewed authenticated encryption and key wrapping using maintained libraries, not custom cryptography.
2. Implement resumable encrypted uploads/downloads, device authorization/revocation, quota accounting, and key recovery. Revocation blocks future access; it cannot erase plaintext already downloaded to a formerly authorized device. Shared base records continue using the free path and must be reconciled rather than duplicated by cloud restore.
3. Keep immutable recovery snapshots/versions with a declared trash and retention policy. Sync alone is not backup because it can propagate deletions. Record separately: local saved state, shared-sync state, encrypted-cloud upload state, and last verified recoverable snapshot. Schedule background work within OS limits and catch up on foreground; do not promise continuous background execution.

Exit gate: a new device recovers writing and media with the account plus a valid recovery method; the account password alone is insufficient. Version recovery survives accidental deletion. Partial uploads are never reported as a completed backup.

### Phase 9 — Subscriptions, costs, and backup UX

1. Offer one `journal_cloud` entitlement with monthly and annual products and the same feature/storage allowance. Use Apple IAP and Google Play Billing as the baseline mobile checkout. Recommend RevenueCat for lifecycle processing with a server-side entitlement mirror keyed to the stable account UUID; the existing billing stack must be assessed before adopting or replacing it.
2. Authenticate webhook ingestion, reject duplicate/replayed events, reconcile out-of-order changes against authoritative status, and enforce uploads server-side. Test pending purchases, renewal, grace, billing failure, refund/revocation, purchase restore, account switching, and cross-platform access. Avoid a second subscription when the account already has the entitlement. Subscription management remains with its purchase store.
3. Set price and allowance from measured storage, transfer, retained versions, processing, billing fees, and support costs. Publish upload limits and fair-use rules for free shared sync too; a text-only history is not costless. Do not promise unlimited storage.
4. Show backup coverage in Profile: free shared records versus local-only Journal items versus cloud-protected items. Offer reminders with Back up now and Get Journal Cloud as separate choices. Track export and cloud timestamps independently; never show a green global backed-up badge while attachments are unprotected. Explain uninstall risk during onboarding/settings/export; an app cannot reliably intercept its own uninstall.

Exit gate: both stores' sandbox purchase/lifecycle tests pass. Free export and local editing remain usable after expiry. Before sale, publish exact storage allowance, retained-version policy, and post-expiry retrieval/retention terms; recommended baseline is a clearly disclosed 90-day cloud retrieval window after expiry, subject to cost validation. Cancellation at renewal and immediate entitlement revocation are handled distinctly. No automatic immediate purge at cancellation.

### Phase 10 — Operational recovery and controlled launch

1. Back up database, encrypted object bytes, manifests, wrapped-key metadata, and infrastructure/configuration with independent/versioned copies and tightly scoped operator credentials. A database backup does not contain Supabase Storage object bytes. Keep deletion evidence so a disaster restore does not resurrect intentionally erased accounts.
2. Define and prove recovery objectives in an isolated restore: proposed launch targets are database RPO at most 15 minutes, encrypted media RPO at most 24 hours, and end-to-end service RTO at most 24 hours. These are engineering targets, not current guarantees. A stricter media target requires more frequent replication. Keep client-only edits outside server RPO claims. Run an initial complete drill and repeat at least quarterly, plus after material storage/key changes.
3. Review against applicable OWASP MASVS controls; test authorization, leaked logs, key recovery, dependency risks, signed media access, and malicious/oversized backups. Require an independent security assessment before marketing the vault as end-to-end encrypted. Operator recovery must work on ciphertext without a global user-content decryption key; legacy shared siFia content remains readable to authorized backend operators.
4. Implement distinct actions: sign out of this app; remove this device's cache; delete Journal Cloud data; delete a shared entry across connected apps; delete the ecosystem account. Each shows its actual scope. Account deletion must also explain subscription cancellation through the purchase store; deleting app/backend records does not by itself cancel store billing.
5. Roll out behind per-account/type flags: staff staging → private iOS/Android beta → small production cohort → wider rollout. Monitor redacted failure rates, sync lag, unresolved conflicts, backup integrity, restore success, storage cost, and crash rates. Stop rollout for unexplained record loss/duplication or cross-account exposure. A kill switch stops remote writes while retaining local work and outboxes.

Exit gate: recorded restore drill, published retention/recovery limitations, independent security findings resolved or explicitly accepted, full release matrix passed, and a rehearsed rollback. This evidence is what supports an industry-grade claim.

### Phase 11 — Future read-only display in siFia

1. Add renderers for supported extension versions and safe placeholders/Open in Journal for unknown ones.
2. Reuse device enrollment and authorized cloud access. Without uploaded extension bytes, siFia opens Journal instead of trying to reach into its sandbox. Expired subscriptions follow the disclosed retrieval window.
3. Permit reading only in siFia's product flow; add/edit/remove extension controls remain in Journal. Enforce any required stronger app-specific mutation restriction at the authorization boundary rather than trusting a client-supplied app label.

Exit gate: siFia can display an authorized photo/note block without changing its extension; editing supported base text preserves the extension and unknown versions.

## Release evidence matrix

| Scenario | Required result |
| --- | --- |
| Journal guest, siFia absent | Offline save and encrypted export/restore work without account or subscription |
| siFia user, Journal left disconnected | No automatic download, guest upload, or identity sharing |
| Journal-only subscriber | Account creation, billing, cloud recovery work without installing siFia |
| Combine 300 entries / 80 Heart Journals | Only compatible bases enter free shared sync; all extensions keep their parent links |
| Heart Journal with private photo and structured block | Text syncs as explicitly defined; unsupported content stays intact and clearly marked local/cloud |
| Two devices edit one body offline | Recoverable conflict; no silent loss |
| Retry, app crash, or connection loss mid-merge | Resume safely; no duplicate acknowledged mutation |
| Change from account A to B | No cached A content, keys, outbox work, or purchase state leaks into B |
| Delete versus stale offline edit | Recoverable conflict/tombstone handling; no silent resurrection |
| Cloud expires, is refunded, or payment fails | Correct entitlement policy; local work/export and free shared sync remain available |
| Reinstall / new iOS or Android device | Local-only loss disclosed; export or cloud recovery proven; same sign-in alone cannot unlock encrypted vault |
| Backend/object disaster | Measured restore meets declared objectives for rows, objects, and wrapped-key metadata together |

## Verified baseline and immediate next step

Baseline: on 2026-11-03, TypeScript checking passed and the three focused capability/backup test suites passed (14 tests).

First implementation increment, 2026-11-03:

| Implemented artifact | Evidence / limit |
| --- | --- |
| Capability contract v2 and persistence policy | Guest mode, deliberate shared-sync connection, Journal-only cloud accounts, subscription expiry, review/routine coverage, and planned read-only extension permissions tested; policy helper does not authorize server access |
| `sharedJournalMergePreview.ts` | 300 authored records / 80 Heart Journals scenario; account mismatches, incomplete snapshots, conflicts, duplicates, mapped IDs, tombstones, and unknown types covered; no storage/network writes or UI integration |
| `sifiaReflectionBundleCompatibility.ts` | Object/string legacy containers preserve row and child IDs; invalid siblings, duplicate IDs, invalid dates, and mixed ownership return review-required with no partial output; read-only, not migration |
| `scripts/audit-shared-journal-schema.sql` | Single-query metadata report for tables, columns, RLS/policies, grants, constraints, indexes, trigger wiring, RPC execution grants, storage bucket configuration, and extensions; no authored rows or media bytes queried |

Validation: **7 suites / 70 tests passed**, `npx tsc --noEmit` passed, and ESLint passed for the new/changed contract, planner, adapter, and associated tests/fixture. These are code-level checks, not a working encrypted file backup, a deployed authorization audit, or iOS/Android end-to-end sync.

Live audit attempt: `supabase db query --linked` failed before executing its metadata SELECT because the CLI has no access token. The audit SQL has therefore not been executed or validated against the linked database. Run `supabase login` locally (do not paste tokens into chat), then collect the read-only report and inspect relevant function bodies and Edge Function authorization separately. CLI binary/project-link cache presence alone is not proof of authenticated access.

Remaining inventory findings: legacy `reflection_log` is a day container alongside individual `ReflectionApiEntry` rows; mapping requires table/row/child provenance. Modern Journal `metadata.journalBlocks` is separate from the main text, while structured guided content needs an explicit safe projection. Do not classify all JSON/string payloads as free shared text without inspecting their family. Existing reflection API error logging also includes a full entry/raw error context; remove content-bearing diagnostics during Phase 2's privacy audit before enabling new remote paths.

Next implementation milestone: collect the deployed metadata audit, finish variant/field mappings, and package Phase 1 contracts for both apps. The merge preview takes normalized metadata prepared by future audited adapters; it is not yet wired to the live local inventory or account screen. Build and prove local media/export/restore before enabling first-time remote merges or charging for Journal Cloud. Remote changes start in staging with additive migrations; live access and store setup remain operational prerequisites.

## Primary references checked on 2026-11-03

- [Apple App Review Guidelines, payments/subscriptions](https://developer.apple.com/app-store/review/guidelines/): mobile subscription checkout baseline and subscription disclosures. Regional alternative-payment programs require separate review if later used.
- [Google Play Payments policy explanation](https://support.google.com/googleplay/android-developer/answer/10281818): digital cloud services billing baseline.
- [RevenueCat customer identity](https://www.revenuecat.com/docs/customers/identifying-customers): stable account IDs, cross-platform entitlement identity, and restore/transfer considerations.
- [RevenueCat webhook events](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields): lifecycle integration reference.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): object authorization and service-key bypass behavior.
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups): database recovery scope excludes stored object bytes.
- [OWASP MASVS source](https://github.com/OWASP/masvs/blob/master/OWASP_MASVS.yaml): applicable mobile security verification controls; using this reference is not certification.

