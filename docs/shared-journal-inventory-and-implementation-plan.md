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
14. Paid recovery snapshots cover the complete Journal-owned inventory, including locally stored shared-capable base records when free shared sync is disconnected. Canonical sync routing and snapshot coverage are distinct. A snapshot preserves IDs/provenance; restoring it must reconcile existing account records rather than create a second canonical copy. Snapshot eligibility never substitutes for account adoption/backup consent or key enrollment.

The shared core is `packages/journal-contract/src` (`@sifia/journal-contract` package 0.1.2, capability contract version 3). Existing `src/compatibility` entry points delegate to the installed package. Both repositories pin the same vendored archive and lockfile integrity; only Journal owns the package source. It represents future extension read permissions, paid persistence of review/routine state, and Journal-specific check-in/weekly Moments that have no current siFia renderer. Remaining structured field mappings and runtime/server enforcement are still Phase 1/2 work; passing pure contract tests does not establish those features.

## Current architecture discovered in source

Execution rule: **you run all SQL manually in Supabase**, including read-only
audits, migrations, verification, and staging SQL tests. The agent prepares and
reviews files and reviews your results; it does not execute SQL through CLI,
API, a database connection, browser SQL Editor, or automated tests. The earlier
audit executions predate this rule. Non-SQL local code/tests can continue.

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

The live catalog confirms `playbooks.action_steps` alongside related tables such as `playbook_action_steps`, `playbook_sub_tasks`, and `playbook_screens`. Generic tables named `action_steps` and `faithful_actions` do not exist in the audited project. `reflection_entries` also lacks several advanced fields declared by the Journal DTO; use the reviewed per-family projection rather than inserting that DTO directly.

Deployed schema/RLS/grant metadata was collected read-only on 2026-11-04. The [first deployed security audit](shared-journal-security-audit-2026-11-04.md) records the evidence, authorization findings, schema differences, and remaining checks. Raw definitions stay in private local evidence storage; no customer content was read. Remediate the privileged RPC and entitlement-write findings before enabling new Journal network paths.

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

This is a source-backed starting inventory supplemented by deployed column/policy metadata. Each family still needs synthetic fixtures matching its proven persisted shapes before migration code is written; no customer-authored content is required for those fixtures.

| Family | siFia | Journal | Intended behavior | Remote persistence |
| --- | --- | --- | --- | --- |
| Daily gratitude/to-do/focus/win/looking-forward | Create/read/edit/delete | Create/read/edit/delete | Shared base record, bidirectional for validated payloads | Free siFia account |
| Morning check-in / weekly gratitude / weekly looking forward | No matching source types/renderers found | Local canonical Moments | Journal-only; never coerce into a different shared daily type | Local export or paid Journal Cloud |
| Heart Journal/reflections | Create/read/edit/delete | Read adapter plus local CRUD | Shared base record, bidirectional | Free siFia account |
| Prayers/needs/responses | Create/read/edit/delete | Read adapter plus local CRUD | Simple supported base fields mapped; rich Journal lifecycle/history requires an explicit mapping | Free siFia account for compatible base; Journal-specific extensions remain separate |
| Time blocks | Create/read/edit/delete | Local and legacy implementations | Explicit-zone one-off parent mapping implemented; recurring/virtual/exception records held for consolidation | Free siFia account for compatible base |
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

### First field mapping: Heart Journal and plain reflections

Implemented preparation boundary: `src/compatibility/sharedReflectionFieldContract.ts`. These mappings are verified against the two repositories' reflection types/editors, not against the deployed schema. No network write or account-screen integration is enabled.

| Persisted local field | Prepared shared base | Journal retention / editing rule |
| --- | --- | --- |
| `title`, plain `content` | Copied explicitly | May receive a validated shared text patch |
| `selected_date`, `tags` | Valid calendar date; copied tag array | May receive a validated shared patch; date moves require the future transactional writer |
| `type`, `source` | Preserve known discriminators; unknown values require review | Incoming text patches cannot reclassify the record |
| `metadata.prompt` | Historical prompt | Incoming text patches cannot replace the original question |
| Known devotional/playbook IDs, titles, day/question context in metadata | Explicit historical-context allowlist only | Incoming text patches cannot reparent records or overwrite context |
| `metadata.journalBlocks` / legacy `journal_blocks` | Excluded | Photos, voice, rich blocks, and unknown block versions stay intact in Journal |
| `metadata.journalClassification`, `questionTopic`, unknown metadata | Excluded | Retained in Journal; no flattening or bulk metadata upload |
| Structured guided JSON / guided journey metadata | Entire record held for explicit mapping review | Private nested answers/notes never enter a plain-text sharing path accidentally |
| Bible Study, Scripture Note, Session Note | Classified as Journal-only | Remain eligible for local export / optional Journal Cloud |
| IDs, owner links, timestamps, sync status, local bookkeeping | Excluded from the base DTO | Used separately for routing, ownership, and conflict checks; never spread into an insert |

The local reflection adapter now feeds metadata into the merge preview. No body, media URI, or private block payload is put into preview results. Applying an incoming text patch requires a matching account, remote identity, and local version. Because the current store has one dirty flag, any unsynced local state is conservatively held for reconciliation rather than guessing that it is extension-only. The helper prepares an immutable next record; the future executor must persist it atomically, and must not send it through the current version-incrementing AsyncStorage update helper.

### Daily journal and prayer mappings

`sharedDailyJournalFieldContract.ts` validates the actual JSON shapes emitted by both apps for gratitude, Todo, focus, win, and looking-forward entries, including proven older variants. It checks nested item fields, preserves original supported JSON bytes and known playbook context, and excludes private metadata from the shared DTO. Unknown keys inside the JSON body require mapping review rather than being silently dropped or uploaded. Contradictory Todo completion flags require reconciliation. The canonical composer routes Time Blocks to their dedicated adapter rather than the daily adapter.

Source inventory found no `morning_check_in`, `weekly_gratitude`, or `weekly_looking_forward` types in the siFia client. Contract v3 assigns these to `journal_only_moment`; the broad daily-journal contract no longer implies that a Journal morning check-in can already round-trip through siFia.

`sharedPrayerFieldContract.ts` maps simple journal/ACTS, people/request, devotional, and guided-playbook prayers using explicit fields and known scalar origin context. Text patches cannot mutate prayer lifecycle state, reparent the record, or replace private metadata. Rich `prayer_needs`, answer/update/lifecycle histories, and tracking flags are held for an explicit lifecycle mapping; the existing siFia client does not model these structures, so flattening them into one answered flag would lose meaning. These cases remain intact locally and are surfaced with a reason in preflight. This is a temporary compatibility gate, not a paid restriction on otherwise compatible base writing.

`sharedJournalCanonicalPreflight.ts` now composes the daily, reflection, and prayer adapters for a caller-supplied, validated canonical snapshot. A 300-record fixture includes 80 Heart Journals, 20 daily gratitude records, 20 simple prayers, 100 Bible Studies, and 80 Session Notes: 120 shared bases and 180 Journal-only documents. The result contains IDs/classifications/counts/reasons, never bodies or attachment URIs. Both snapshot-completeness flags are required by the composer; incomplete snapshots and account mismatches return a blocked preview. This helper neither reads the live stores nor certifies the current AsyncStorage inventory as transactionally consistent. Reviews, routines, drafts, and legacy bundles are not included in this canonical-entry count; their cloud/export inventory remains separate.

### Time Blocks and shared package distribution

The package Time Block adapter reads persisted parent envelopes, preserves aware start/end instants and their named time zone, and checks the selected calendar date in that zone. It supports one-off timed/all-day records without forcing every all-day interval to be exactly 24 hours. Unknown/missing zones, naive timestamps, inconsistent dates, and malformed completion state require review. Text-only patches preserve local metadata and calendar linkage. Schedule changes require the future transactional/series protocol.

Both app sources expand recurring series into UI occurrences that reuse the parent ID and attach `_virtualInstance`, `_originalDate`, and `_virtualDate` metadata. Those derived occurrences must never be uploaded as new parents. Custom/aliased repeat rules, series cutoffs, and exception dates remain held until their zone-aware semantics are reconciled and tested on devices.

| Time Block fields | Prepared behavior |
| --- | --- |
| Aware start/end, selected date, zone, all-day flag, title/category/location/plain description | Explicit supported base projection |
| Known `playbookId`, `stepId`, `subtaskId`, titles/source/action-step context | Retained using scalar allowlists; conflicting inner/outer parent context requires review |
| Private/unknown note metadata | Retained locally; excluded from the shared base |
| Native `calendar_event_id`, alert, alarm minutes | Device-local; never copied into a shared cloud row |
| Recurrence, exceptions, virtual occurrences | Held for dedicated mapping; no expansion or parent creation in the adapter |

The core package owns capability policy, merge preflight, common validation, and the Time Block boundary. Journal-specific daily/reflection/prayer adapters still use its core through compatibility facades; siFia imports the same installed package through `src/compatibility/journalContract.ts`. Vendored archives let independent checkouts resolve the package without a sibling repository or registry publication. `contract:check` rebuilds and compares archive bytes; it refuses a changed archive at the same version. Both lockfiles pin integrity. Package installation adds one dependency and no native modules, third-party runtime dependencies, or lifecycle install scripts.

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

Weights total 100%. Overall delivery estimate is `sum(weight × phase completion / 100)`, currently 13.3%, reported as **approximately 13%**. The deployed profile-helper fix raises Phase 2 from 0% to a conservative 5%; the many remaining authorization, entitlement, receipt, deletion, revision/change-feed, and compatibility deliverables keep this credit narrow. The earlier approximately 19% groundwork/readiness estimate measured a different scope. Future optional display work is excluded from the launch denominator.

| Phase | Deliverable | Weight | Completion estimate | Status / evidence |
| --- | --- | ---: | ---: | --- |
| 0 | Complete inventory and compatibility fixtures | 6% | 80% | Live schema/policies/grants, selected function bodies, and deployed receipt source reviewed; deletion-source verification, full variant fixtures, and remaining configuration review are open |
| 1 | Shared field and capability contract | 6% | 80% | Versioned core consumed by both apps; one-off Time Block/daily/reflection/simple prayer mappings tested; recurring/lifecycle/structured mappings and write-path adoption remain |
| 2 | Secure backend and legacy compatibility | 12% | 5% | Owner-bound profile bootstrap is deployed and passed synthetic, metadata, and A/B app tests; other privileged RPCs, entitlements, receipt/deletion authorization, and revision/change-feed enforcement remain |
| 3 | Transactional encrypted local storage | 12% | 0% | Existing AsyncStorage records are groundwork, not the target implementation |
| 4 | Durable media and extension storage | 8% | 0% | Current URI blocks need durable bytes and independent extension identity |
| 5 | Free encrypted export and safe restore | 10% | 10% | In-memory inventory/validation exists; file, encryption, media packaging, and restore remain |
| 6 | Account connection and device enrollment | 8% | 0% | Existing auth is groundwork; safe combining/enrollment flow remains |
| 7 | Free bidirectional sync and initial merge | 14% | 15% | Canonical preflight includes one-off Time Blocks through the shared core; consistent storage snapshots, remote adapters, confirmation UI, executor, outbox/cursor/conflict engine remain |
| 8 | Encrypted Journal Cloud and versioned recovery | 12% | 0% | Cloud protocol, key recovery, and verified snapshots remain |
| 9 | Monthly/annual billing and lifecycle UX | 6% | 0% | IAP dependency exists; Journal entitlement is not implemented |
| 10 | Security review, disaster recovery, staged release | 6% | 0% | Launch evidence and recovery drill remain |
| 11 | Future siFia read-only extension display | Excluded | 0% | Planned after the core launch |

## Required handoff after every increment

At each completion, report the delivered changes, verification and limitations,
phase/weighted progress, Git/GitHub checkpoint state, and **what the user must do
before the next step**. If nothing is required, say so explicitly. Identify which
work can continue independently, rather than treating an operational prerequisite
as a blocker for all development. Record required actions here as they change.

Current handoff:

| Next work | User action | Dependency / owner |
| --- | --- | --- |
| Remaining recurrence, lifecycle, and structured field contracts | None | Implementation can continue locally |
| Profile bootstrap security increment | None | Guarded deploy, metadata verification, A/B app smoke test, Auth-user deletion, and synthetic-profile cleanup all passed; this narrow increment is complete |
| Local entitlement replacement preparation | None | Source inventory found 32 siFia mobile subscription writes; prepare compatible server operations before changing policies |
| Follow-up deployed security verification | SQL checks will be handed to you for manual execution | Deletion source retrieval and Data API/configuration checks remain; do not infer them from metadata flags alone |
| Broader backend/schema changes | None yet | The guarded live exception applies only to the narrow profile helper. Entitlements, deletion, receipt binding, shared sync, storage, and billing still require isolated rehearsal/staged rollout before launch |

Existing siFia onboarding type errors and Journal peer-dependency/CI cleanup are
engineering release gates for us to address before launch, not instructions for
the user to change authentication or weaken database policies.

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

Immediate prerequisite from the 2026-11-04 deployed audit: trace legitimate callers and close AJ-01/AJ-02 privileged-RPC and entitlement-write gaps; bind receipt/deletion operations to verified identities. These affect the existing backend. Prepare narrow, compatible fixes and synthetic staging tests before adding the Journal sync/cloud surface. See the [audit and remediation order](shared-journal-security-audit-2026-11-04.md).

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
4. Treat calendar event IDs, notification IDs, and similar installation-owned links as device state. Never reuse another device/app's OS identifiers from a restored snapshot or legacy cloud row. Calendar reconnection and alarm scheduling require current permissions and explicit user opt-in; restore must not silently enable calendar writes or duplicate events.

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

Reference commit: [`8b11f096`](https://github.com/NikkiBatanes/journalbysifia/commit/8b11f096a5b847ed789f482084abd23704e53a78), pushed to GitHub `main` before starting the per-field reflection implementation. This is the requested foundation checkpoint.

Next increment: `sharedReflectionFieldContract.ts` adds explicit base projection, local reflection metadata adaptation into merge preflight, and conditional incoming text-patch preparation. Tests exercise actual synthetic `LocalReflectionEntry` records with photos, private blocks, unknown fields, structured documents, stale revisions, and pending local changes. It remains a pure boundary awaiting the transactional store/sync executor, rather than an active sync path.

Next-increment validation: **8 suites / 131 tests passed**, TypeScript checking passed, and ESLint passed for the new field contract and its tests with zero warnings. Verification includes nested JSON encoding (private structured payloads stay out of the shared text DTO), account/revision checks, protected-field rejection, and retention of unknown local extension data. These changes are included in the second reference checkpoint below.

Following increment: added the daily journal and simple prayer field boundaries, shared validation helpers, composed canonical preflight, and synthetic persisted-shape fixtures. Corrected check-in/weekly Moment classification in contract v3 using the source evidence above. Verification covers nested private JSON, coupled Todo flags, rich prayer lifecycle holds, invalid calendar dates, incomplete snapshots, and cross-account previews. These field boundaries are included in the second reference checkpoint below.

Latest validation: **11 suites / 211 tests passed**, `npx tsc --noEmit` passed, and ESLint passed for all changed/new compatibility files with `--max-warnings=0`. A broader compatibility-folder lint run also found six existing `curly` style warnings in the unchanged `sifiaReadCompatibility.ts`; those are not new failures in this increment. No native-device sync, file export/restore, encryption, or deployed RLS validation is claimed.

Backup-coverage correction: `getJournalPersistencePolicy` now reports `journalCloudBackupEligible` independently from canonical `journalCloudSync` routing. Full-journal encrypted recovery snapshots must also cover locally held Heart Journal bases for subscribed Journal-only accounts that have not enabled free shared sync. This is an eligibility contract, not a scheduler or consent grant; cloud-only live multi-device editing of shared-capable bases still needs an explicit routing decision before Phase 8 launches.

Earlier live audit attempts: `supabase db query --linked` failed before executing its metadata SELECT because the CLI had no access token. Login was completed on 2026-11-04: the CLI reported success and exited with code 0; a separate authenticated read-only project-list request succeeded and confirmed access to the linked project. Three projects are accessible. No credential or verification code is recorded in this plan. The sandboxed authentication request initially failed with a transport error; the network-enabled retry succeeded. Both repository metadata SELECT scripts and supplementary private catalog queries subsequently executed successfully on 2026-11-04. The first audit report records the reviewed bodies, confirmed gaps, and unverified deletion source. Database-query access is now established; client A/B authorization tests and remediation are still outstanding. No further user action is currently required for local fix preparation.

Remaining inventory findings: legacy `reflection_log` is a day container alongside individual `ReflectionApiEntry` rows; mapping requires table/row/child provenance. Modern Journal `metadata.journalBlocks` is separate from the main text, while structured guided content needs an explicit safe projection. Do not classify all JSON/string payloads as free shared text without inspecting their family. The earlier audit found full-entry/raw-error logging in the reflection API; the reflection failure boundary below now removes these diagnostics from both reflection APIs. Other APIs, hooks, server logs, and telemetry still require the Phase 2 privacy audit before new remote paths are enabled.

Second reference checkpoint: [`431aae90`](https://github.com/NikkiBatanes/journalbysifia/commit/431aae903744c30d71a7bfa26e1d6fd4445289f2), pushed to GitHub `main` before the shared package/Time Block work. The subsequent shared package/Time Block work was checkpointed in both repositories as recorded below; unrelated user screen/native edits are preserved.

Package verification at the third checkpoint: both consumers pinned `vendor/sifia-journal-contract-0.1.1.tgz`, SHA-256 `dad04bcc22474cef60978ba6158d2a671b4c6494b8079cc620978d84fd83f5d2`. Journal's existing React 19/masonry-list/Expo peer conflict required `--legacy-peer-deps` during offline install. siFia installed with existing peer warnings. Each lockfile adds only the contract dependency; no other library was upgraded. Whole-app CI dependency cleanup is outside this increment.

Verification of this increment (2026-11-03):

| Check | Result / scope |
| --- | --- |
| Journal focused tests | 13 suites / 250 tests passed, including installed-package delegation, archive integrity, canonical preflight, Time Block zone/DST/relationship checks, and existing backup contracts |
| siFia consumer tests | 1 suite / 4 tests passed against the same installed package |
| TypeScript | Journal full check passed; siFia contract boundary's scoped check passed; existing siFia full-project errors remain as documented below |
| Lint | Changed/new Journal/package TypeScript and siFia consumer files passed with zero warnings; pack script syntax check passed |
| Source/archive reproducibility | `npm run contract:check` passed; both vendored archives are byte-identical and lockfile integrity matches |
| Independent consumer | Clean temporary project completed offline install, offline `npm ci`, and runtime conformance loading using only its copied archive; no sibling checkout required |
| Mobile bundle resolution | Contract-entry Metro bundles succeeded for Journal iOS/Android and siFia iOS/Android. Sandboxed attempts hit a watcher limit; authorized retries outside the sandbox succeeded |

These are focused package/bundle checks, not full app release builds, device-based DST verification, CI certification, encryption validation, or live synchronization tests. No new cross-app network write path was enabled.

siFia full-project type checking reports six existing errors in unchanged `OnboardingSalesOfferScreen.tsx` (lines 493, 504, 561, 2328, 2358, 2401). A compiler run excluding the new contract boundary reproduces those same six errors. The package boundary has an independent scoped type check; this is not a claim that siFia's full build is green.

Next implementation milestone: trace callers and prepare fixes for the deployed privileged-RPC, client-writable entitlement, receipt-ownership, and deletion findings. Verify fixes with synthetic staging identities before production changes. Finish recurrence, rich lifecycle, and structured guided-content mappings in parallel; then implement additive sync schema and transactional account-isolated storage behind the documented gates. The preview is not wired to storage reads or the account screen. Build and prove local media/export/restore before enabling first-time remote merges or charging for Journal Cloud. Remote changes start in staging with additive migrations; live access and store setup remain operational prerequisites.

Third reference checkpoint, pushed to both GitHub `main` branches on 2026-11-03:

| Repository | Commit | Included work |
| --- | --- | --- |
| Journal by siFia | [`3744a634`](https://github.com/NikkiBatanes/journalbysifia/commit/3744a634) | Shared package 0.1.1, consumer facades, safe one-off Time Block mapping, package/build evidence |
| siFia | [`7d1e01bf`](https://github.com/NikkiBatanes/siFia/commit/7d1e01bf) | Matching immutable package archive and consumer conformance tests |

Continuation after that checkpoint: both reflection APIs use the shared
`PrivateReflectionApiError` from package 0.1.2. All returned failure branches
stop logging raw messages, details, hints, input records, or original causes.
The request wrapper also sanitizes rejected promises and synchronous SDK/query
construction failures. Only fixed action/messages and allowlisted error codes or
numeric statuses reach the logger/tracker. Successful authored data and existing
missing-record/network-search fallback behavior are preserved. Search still has
its legacy empty-results fallback; it must not be used as a complete remote
snapshot for merge/sync.

The 0.1.2 archive has SHA-256
`597a6761564dd9113248d9961ae5290ab58c8797f925eba69ead49b991709d3b`.
Both apps pin identical bytes and lockfile integrity; previous checkpoint
archives remain unchanged. No other dependency version was changed.

Verification of the privacy continuation (2026-11-03):

| Check | Result / limit |
| --- | --- |
| Journal focused tests | 15 suites / 331 tests passed |
| siFia consumer/privacy tests | 2 suites / 71 tests passed |
| Diagnostic coverage | Every reflection API method tested for returned failures, rejected promises, synchronous query-construction failures, and successful calls; private marker absent from logger buffers/tracker errors and context |
| TypeScript | Journal full check passed; siFia full check reports only the same six existing onboarding errors documented above |
| Lint | All changed/new TypeScript files passed with zero warnings in both repositories |
| Package | Standalone build/source-archive check passed; consumer archives are byte-identical and each lockfile integrity test passed |

These are synthetic client-level checks. They do not establish live database
authorization, full native release-build success, or removal of content already
stored in historical logs. No deployed infrastructure was modified.

This continuation is local/uncommitted pending the next requested checkpoint.
It hardens one existing API family and does not establish privacy across all
hooks, other APIs, server logs, or telemetry. Deployed RLS/authorization and full
app release checks remain open; no cross-app write path was enabled. At that increment,
weighted progress remained **11.8% (approximately 12%)** because privacy
groundwork did not complete the backend delivery gate. The deployed audit below
subsequently raises inventory progress only.

## First deployed audit, 2026-11-04

The [read-only security audit](shared-journal-security-audit-2026-11-04.md) and
`scripts/audit-shared-journal-security-surface.sql` are new local artifacts.
Both metadata reports and supplementary catalog queries executed successfully
against the verified shared project. No authored rows were queried and no
application RPC, deployment, or database mutation was run. Private source/metadata
evidence has a hash manifest outside Git.

Confirmed foundations include RLS on the six existing content tables and
`security_invoker=true` on all six public views. Priority gaps are unguarded
privileged RPCs, owner-writable entitlement fields, and deployed receipt identity
binding. Deletion source verification, full client-role tests, private backup
storage, and recovery validation remain open. Preserve those distinctions when
reporting progress; this is a first audit pass, not a security certification.

Verification for this increment consists of successful execution of the read-only
SQL and source/metadata review. No app code changed, so the prior focused test
results are retained rather than represented as newly run tests. Phase 0 is now
80%; weighted implementation is **12.7% (approximately 13%)**. Phase 2 stays at
0% until security/backend deliverables have implementation evidence.

At the audit handoff, no user action was required for local fix preparation and
separate staging was the recommendation. The later guarded-live risk decision
for this one helper is recorded below; it does not change the audit's broader
staging requirement. Existing local code and these audit additions remain
uncommitted; GitHub reference heads remain Journal `3744a634` and siFia `7d1e01bf`.

## Manual security fix preparation, 2026-11-04

The [profile bootstrap package](manual-sql/profile-bootstrap/README.md) prepares
the first narrow AJ-01 fix. It contains a read-only preflight, baseline-guarded
replacement with integrated synthetic assertions/savepoint cleanup, metadata
verification, app smoke checklist, containment, and last-resort rollback. All
SQL remains **draft SQL pending your manual execution**;
none was executed by the agent after your manual-only instruction. Files live
outside automatic migration discovery.

Both apps' `AuthApiService` fallback now requires a verified matching identity,
does not invent a missing email, rejects a mismatched response, and avoids raw
profile/error logging in this helper. The server function remains vulnerable
until the manual SQL is applied and runtime-verified; the client guard cannot
enforce database authorization for other callers.

Source-only AST inventory (`scripts/inventory-journal-security-callers.cjs`)
found one direct profile RPC call per app, two default-seeker calls in siFia,
and 32 direct subscription-write sites in siFia mobile source versus zero in
Journal mobile source. Each repository has 18 additional subscription writes
in Edge Function source copies. Aliases, dynamic SQL, outside workers, and
deployed bundles remain separate review items; source counts are not runtime
authorization evidence. Entitlement replacement must cover existing purchase,
trial, usage, discount, and onboarding flows before permission changes.

Local validation: Journal's three focused suites passed **38 tests**, including
the legacy-auth and Journal subscription-boundary suites; siFia's two auth
suites passed **30 tests**. Changed TypeScript passed lint with zero warnings;
the inventory script syntax check passed. Database SQL and real-session/API
tests have not been run and are not counted as passing checks.

Journal's full TypeScript check passed. siFia's full check still reports only
the same six pre-existing onboarding errors documented above; no new errors
were reported in the changed profile helper or tests.

Backend phase completion remains **0%** and overall delivery remains **12.7%
(approximately 13%)**. This work and earlier continuations remain uncommitted;
no SQL, deployment, or database permission change was made in this increment.

The user subsequently ran [01-preflight.sql](manual-sql/profile-bootstrap/01-preflight.sql)
manually in the existing siFia project and shared the result. The
[review](manual-sql/profile-bootstrap/01-preflight-reviewed.md) accepts the audited
baseline, required columns/RLS, and absence of reported dependency candidates.
Anonymous execute access remains present; the server fix has not been applied.

**Current user dependency for this helper:** review the guarded runbook, then
create two new temporary Auth test users without opening either app. Their exact
UUID/email pairs are entered only in Supabase SQL Editor when running the
guarded script. No identifier, password, or token should be saved in Git or
shared in chat. Broader backend work still requires isolated rehearsal/staged
rollout. Local entitlement preparation can continue independently. Overall
implementation remains approximately 13%.

Budget steering: the user cannot take on paid staging. A local Supabase/Studio
environment remains available for later broader schema work without an
additional Supabase hosting charge. Docker availability was verified, but no
local environment was initialized and no SQL was executed. For this one narrow
existing profile helper, the user chose a guarded live transaction with two
new synthetic Auth identities, automatic database assertions, savepoint cleanup,
post-commit verification, real-app smoke testing, containment, and a last-resort
service rollback. This is a documented risk exception, not a replacement for
staging across the rest of Phase 2.

## Guarded profile deployment preparation, 2026-11-16

The profile package was restructured after the user's decision to avoid a paid
staging project and combine application with database tests. `02-apply.sql` now
requires two new temporary Auth users and validates their exact UUID/email pairs
and absence from `user_profiles` before changing anything. It applies the
owner-bound helper inside a transaction, simulates owner/cross-owner/missing/
anonymous calls, rolls all synthetic profile writes back to a savepoint, checks
the hardened function/grants and absence of fixture rows, then commits. A
post-commit marker prevents a rolled-back execution from being reported as a
pass. Real identifiers are entered only in Supabase SQL Editor, not saved in
Git or shared in chat.

`03-verify.sql` remains the read-only deployed metadata check.
`04-app-smoke-test.md` covers real-session A/B sign-in and account switching.
`05-containment.sql` now refuses to disable an unknown/unpatched function.
`06-restore-audited-baseline.sql` is a deliberately insecure last-resort service
rollback and reopens AJ-01; containment plus a corrected forward patch is
preferred. `07-cleanup-test-profiles.sql` requires Auth-user deletion first and
removes only exact matching synthetic profile rows. The older staging-test file
was removed because its assertions are now integrated into the guarded
transaction.

Official PostgreSQL savepoint documentation confirms that commands after a
savepoint can be discarded while earlier transaction changes remain. Supabase
guidance confirms that definer functions run with owner privileges, require an
explicit owner check, and should have PUBLIC/anonymous execution narrowed. The
files received static review only: the user still owns all SQL execution, and
no database/parser/runtime validation is claimed.

Preparation alone did not complete the backend exit gate. The accepted deploy,
verification, and app evidence recorded below subsequently raise Phase 2 to 5%
and overall implementation to **13.3% (approximately 13%)**.

The user manually ran the guarded `02-apply.sql` on 2026-11-16 and supplied its
expected final JSON: `deployment_committed=true`, synthetic database assertions
passed, and no synthetic profile rows persisted. This confirms the transaction
committed past its post-commit marker. Keep the two temporary Auth users for the
pending real-session A/B smoke test. Independent `03-verify.sql` metadata and
the app smoke test are still required before crediting Phase 2 progress or
declaring this helper closed.

The user subsequently ran `03-verify.sql`. The deployed helper exists under the
expected signature, is owned by `postgres`, remains `SECURITY DEFINER`, has an
empty pinned search path, denies PUBLIC/anonymous execution, allows authenticated
execution, and carries the guarded 2026-11-16 marker. Deployed definition MD5 is
`569bb4004827e98027690d98ea33af59`. At that handoff, the remaining gate was the
real-session A/B app smoke test, so the temporary users were retained.

The user then completed all eight siFia smoke-test steps and the Journal by
siFia account/profile checks successfully. Journal showed the temporary account
name while authenticated and returned to the independent device-local name on
logout, matching the local-only/optional-account model. No authored test content
was created; platform was not reported. This closes the runtime gate for this
narrow helper and raises Phase 2 to 5%. Overall weighted progress is now 13.3%,
still reported as approximately 13%. At that handoff, temporary Auth/profile
cleanup remained and was completed as recorded below.

The user deleted both temporary Auth identities and ran
`07-cleanup-test-profiles.sql`. It reported `auth_users_present=false`, zero
profiles deleted, and cleanup passed. This confirms Auth deletion had already
removed the synthetic profiles and no matching test profile remained. No further
Supabase action is required for this narrow increment.

## Primary references checked on 2026-11-03

- [Apple App Review Guidelines, payments/subscriptions](https://developer.apple.com/app-store/review/guidelines/): mobile subscription checkout baseline and subscription disclosures. Regional alternative-payment programs require separate review if later used.
- [Google Play Payments policy explanation](https://support.google.com/googleplay/android-developer/answer/10281818): digital cloud services billing baseline.
- [RevenueCat customer identity](https://www.revenuecat.com/docs/customers/identifying-customers): stable account IDs, cross-platform entitlement identity, and restore/transfer considerations.
- [RevenueCat webhook events](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields): lifecycle integration reference.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): object authorization and service-key bypass behavior.
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups): database recovery scope excludes stored object bytes.
- [OWASP MASVS source](https://github.com/OWASP/masvs/blob/master/OWASP_MASVS.yaml): applicable mobile security verification controls; using this reference is not certification.

