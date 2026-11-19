# Shared Journal inventory and implementation plan

Status: Finalized implementation baseline, 2026-11-03; Journal-only cloud
entitlement boundary clarified 2026-11-16. Planning and repository inspection
are underway; production shared sync, encrypted file backup, and Journal Cloud
are not delivered.

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
15. Journal Cloud uses a dedicated server-owned entitlement. No current siFia tier, playbook/devotional counter, onboarding flag, or client-writable subscription field grants it. siFia AI-generation hardening is tracked separately unless a path becomes a direct shared-sync dependency.

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
8. No current siFia subscription tier includes `journal_cloud`. Any future bundle requires an explicit product decision and server-issued entitlement source; it is not inferred from the siFia tier.

No record bodies should be placed in tickets, analytics, logs, or committed fixtures. Fixtures must be synthetic but structurally faithful.

## Progress accounting

Percentages below are conservative planning estimates against the deliverables and exit gates in this version, not a security certification or a shipped-feature percentage. A phase reaches 100% only when its exit gate has recorded evidence. Existing local editors, auth helpers, or IAP dependencies alone do not complete a new integration phase.

Weights total 100%. Overall delivery estimate is `sum(weight × phase completion / 100)`, currently **31.9%**. The deployed and verified profile and Seeker helper fixes each contribute a conservative five points to Phase 2. Phase 9 now includes RevenueCat client identity, both store catalogs, localized cross-platform offering reads, the non-purchasing preview, isolated signed webhooks, authoritative reconciliation, forced-RLS server entitlement projection, and guarded app-side purchase/owner-read foundations. Phase 3 now has an isolated, synthetic-only OP-SQLite/SQLCipher candidate with a device-only Keychain/Keystore key boundary, focused key tests, native Android/iOS dependency integration, and a fail-closed native dependency gate. Its development diagnostic passed activation, rollback, reopen, wrong-key, deterministic disk-full, and forced-process-interruption assertions on both platforms with SQLCipher 4.19.0. Raw-file inspection of both synthetic databases found neither the known probe text nor a readable SQLite header. The dependency review and automated gate reject the current native graph for customer data because its bundled OpenSSL 3.6 provider is end-of-life; a supported upgrade or replacement candidate is required before migration. Initial production dependency triage made two narrow fixes, resolving the `uuid` advisory and the invalid Expensify peer tree while reducing the audit from 21 to 18 findings; Markdown, navigation, build-tooling, and other transitive findings remain controlled release work. The local in-memory recovery contract enumerates unfinished session notes, guided reflections, routine drafts, Gospel-authored content, and a strict preference allowlist while excluding tokens, device secrets, analytics outboxes, offline queues, and caches. It now preserves exact source-key provenance and has a pure fail-closed restore planner that validates owned namespaces, reconstructs indexes, derives the latest Bible Study pointer, and excludes unmapped legacy records without writing storage. A storage-agnostic restore executor now requires the canonical ownership policy and a shared exclusive mutation lease, persists rollback evidence before mutation, verifies the final key/value set, automatically restores the exact prior state on failure, and retains recovery artifacts when rollback cannot be completed. A versioned portable-manifest preflight also bounds record/media/container sizes, nesting and string allocation, exact opaque asset paths, media allowlists, hashes, asset owners, and authenticated final-marker evidence. The archive-crypto provider work now pins and verifies the official libsodium 1.0.22 source, proves the selected Argon2id plus secretstream primitives in a synthetic native host harness, reproducibly builds/verifies four-ABI Android Prefab and iOS device/simulator XCFramework artifacts, defines a codegen-verified synthetic-only TurboModule boundary for both platforms, and integrates synthetic-only native providers that run off the JavaScript thread on Android and iOS. A canonical, digest-locked portable vector now proves that the host, Android, and iOS derive the same key, produce the same authenticated bytes, and reject the same invalid inputs. Synthetic-only native diagnostics now prove bounded encrypted file transport plus authenticated JPEG/M4A packaging. The media boundary enforces signature/MIME agreement, per-asset and aggregate limits, UUID ownership, opaque paths, unique IDs/paths, SHA-256 content binding, metadata-bound AAD, ordered chunks, and an authenticated final marker. ARM64 runtime diagnostics on both platforms passed the crypto, transport, and media assertions without writing plaintext or exposing customer-data methods. The production gate remains closed pending a reviewed production storage/coordination adapter, startup recovery integration, clean-device restore with customer-selected attachments, and a separately reviewed customer-data surface. Real sandbox purchase/restore and lifecycle evidence remain before Phase 9 can exit. The many remaining deletion, revision/change-feed, runtime, migration, recovery-drill, shared-sync, and release deliverables keep overall credit narrow. The earlier approximately 19% groundwork/readiness estimate measured a different scope. Future optional display work is excluded from the launch denominator.

| Phase | Deliverable | Weight | Completion estimate | Status / evidence |
| --- | --- | ---: | ---: | --- |
| 0 | Complete inventory and compatibility fixtures | 6% | 88% | Live schema/policies/grants, selected function bodies, deployed receipt source, and local recovery stores including authored drafts/Gospel/settings are classified; deletion-source verification, full variant fixtures, and remaining configuration review are open |
| 1 | Shared field and capability contract | 6% | 80% | Versioned core consumed by both apps; one-off Time Block/daily/reflection/simple prayer mappings tested; recurring/lifecycle/structured mappings and write-path adoption remain |
| 2 | Secure backend and legacy compatibility | 12% | 10% | Owner-bound profile and fixed-Seeker bootstraps are deployed and passed synthetic, metadata, and A/B app tests; other privileged RPCs, table entitlements, receipt/deletion authorization, and revision/change-feed enforcement remain |
| 3 | Transactional encrypted local storage | 12% | 28% | OP-SQLite 19.0.5 with SQLCipher is integrated as a synthetic-only candidate; iOS and Android passed activation, rollback, reopen, wrong-key, deterministic disk-full, forced-process-interruption, and raw-file checks. A tested fail-closed dependency gate rejects the bundled end-of-life OpenSSL 3.6 provider for customer data; supported replacement/upgrade, migration, and production adoption remain |
| 4 | Durable media and extension storage | 8% | 3% | Picker-URI and voice-manifest gaps plus target ingestion protocol are documented; durable encrypted assets remain |
| 5 | Free encrypted export and safe restore | 10% | 87% | Practice exports verify the captured photo bytes before saving. The development check reads local entries and reports which referenced picker JPEG and PNG files can still be opened. The development Files screen can export a practice journal with 0–300 entries. The native reader and restore preview handle practice backups with variable entry and image counts. The journal photo-block resolver now handles variable entry counts and shared photos. A revised practice entry can now add or replace a photo. The restore verifies the new image before recording the copy and reuses its encrypted file on retry. The practice restore now compares a revised backup against the current device entry. Automated tests cover preserving the device version, keeping both, a device edit during preview, and retry after interruption. Reopening the same backup after Keep both now checks the practice database for a completed import before copying photos. The Keep both walkthrough passed through Files on the Pixel 8 emulator and the dedicated iPhone simulator. Both reopened the sample database and verified four entries and two photos. Android Files and iOS Files both passed the sample preview, cancellation and confirmed restore checks. The development adapter can compare a restore with an existing journal and report key counts. The development restore flow previews the verified entry count, photo count and total photo size before confirmation. Both the Pixel 8 emulator and the dedicated iPhone simulator saved an encrypted sample through Files and restored both entries and both photos using the recovery code. Development startup verifies a pending synthetic restore before loading Journal. Inventory/validation preserves exact record-key provenance; a tested pure planner rejects namespace/key mismatches and emits no writes. The portable-manifest preflight enforces version, allocation, count, path, media, hash, ownership, total, and authenticated-final-marker boundaries. The provider gate remains closed, but the host harness and audited Android/iOS artifacts verify libsodium 1.0.22 packaging/symbols, React Native 0.88 codegen accepts the synthetic-only TurboModule contract, both native providers passed ARM64 runtime assertions off the JavaScript thread, and a digest-locked portable vector proves identical key/byte and rejection behavior across host, Android, and iOS. Synthetic-only native file transport proves bounded durable publication and cleanup; authenticated media packaging proves signature/MIME validation, content/owner/path/AAD binding, ordered chunks, and final-marker enforcement. The storage-agnostic restore executor now proves pre-mutation rollback staging, exact owned-key replacement, read-back verification, automatic rollback, interrupted recovery, and fail-closed evidence retention under an exclusive mutation lease. A development adapter recovered an interrupted fixture before the first read on reopening an encrypted database on the iOS simulator and Android emulator. Both platforms also retrieved their device-held test key and rolled back an interrupted restore in a fresh app process. A generated text entry and its index also survived file transfer and database reopen in both directions between iOS and Android. A clean Android installation restored an iOS photo fixture, and a clean iOS installation restored a host-generated photo fixture. An interrupted full-size file-backed photo restore recovered on the development Mac. The iOS simulator and Android emulator both recovered the original full-size photo and retried successfully after process death with the replacement database write pending. Both platforms also recovered and retried after the app closed midway through copying the encrypted photo and immediately after publishing it. Both targets recovered two entries with a shared photo and preserved the file until the last reference was removed. A fresh iPhone simulator restored a single encrypted backup from the Pixel 8 containing both entries and both photos. Production storage/startup integration, user-controlled recovery secrets, and customer export controls remain |
| 6 | Account connection and device enrollment | 8% | 0% | Existing auth is groundwork; safe combining/enrollment flow remains |
| 7 | Free bidirectional sync and initial merge | 14% | 15% | Canonical preflight includes one-off Time Blocks through the shared core; consistent storage snapshots, remote adapters, confirmation UI, executor, outbox/cursor/conflict engine remain |
| 8 | Encrypted Journal Cloud and versioned recovery | 12% | 3% | Key hierarchy, recovery, minimal-metadata, commit, version, and DR boundaries are designed; implementation and verified snapshots remain |
| 9 | Monthly/annual billing and lifecycle UX | 6% | 97% | Apple/Google catalogs, localized preview, SDK identity, isolated signed webhooks, authoritative reconciliation, forced-RLS server projection, guarded purchase method, and owner-only server-entitlement read are implemented/tested; real sandbox purchase/restore and complete lifecycle evidence remain |
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
| Seeker subscription bootstrap guarded deployment | None | Guarded deployment, metadata verification, iOS A/B smoke test, exact-row verification, Auth-user deletion, and cleanup all passed; this narrow increment is complete |
| Journal Cloud entitlement preflight | None; the manual metadata preflight passed and is recorded in `01-preflight-reviewed.md` | Intended relation/type names are unused, Auth ownership is UUID, required roles/extensions exist, and legacy siFia billing objects remain isolated |
| Journal Cloud billing foundation | None for the current code increment; do not enable ordinary-user checkout yet | Both stores, signed production/sandbox webhooks, authoritative reconciliation, and server entitlement projection are verified. Guarded purchase code and owner-only reads are present, but the UI remains disabled pending real sandbox lifecycle tests and encrypted cloud recovery |
| Encrypted local storage spike | None for monitoring and remaining audit triage; approve before any replacement native database dependency is installed. Never share a key or journal content | OP-SQLite/SQLCipher and device-only Keychain/Keystore handling remain isolated to a synthetic database. Both platforms passed activation, rollback, reopen, wrong-key, disk-full, forced-interruption, and raw-file checks. The tested dependency gate rejects the current OpenSSL graph. Exact `uuid`/Expensify patches reduced the production audit from 21 to 18 findings without an automatic audit rewrite. Expo SQLite would add Expo Modules to this bare React Native app, so the preferred next path is an eligible OP-SQLite graph; migration remains gated |
| Local recovery inventory correction | None | The read-only inventory and V1 validation contract now preserve unfinished authored drafts, Gospel data, and meaningful preferences while excluding credentials, device secrets, analytics/outbox state, offline operations, and caches; 9 focused tests pass and no export file or restore write is enabled |
| Authenticated encrypted archive transport and media | None | Synthetic native transport and JPEG/M4A packaging pass on iOS and Android with strict size limits, durable atomic publication, signature/MIME validation, hash/owner/path/AAD binding, chunk/final-marker enforcement, and no plaintext/customer-data API. Export/restore remains disabled; rollback-safe restore work can continue locally without SQL |
| Transactional restore executor | None | The storage-agnostic executor passes exact replacement, rollback, interrupted-recovery, namespace, policy, and retained-evidence tests under a required shared mutation lease. It is not connected to AsyncStorage or customer data; the text and photo fixtures passed on fresh app data, and production adapter and startup recovery review remain |
| siFia generation/onboarding hardening | None; do not prepare or apply further production changes in this track without separate approval | Read-only evidence is retained, but a generation ledger is not a Journal Cloud launch prerequisite |
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

Immediate prerequisite from the 2026-11-04 deployed audit: secure only the
existing boundaries that Journal directly depends on—shared account ownership,
compatible-record access, receipt/deletion authorization, and revision/change
enforcement. Journal Cloud uses the dedicated server-owned boundary in
[Journal Cloud entitlement and free-sync boundary](journal-cloud-entitlement-boundary.md),
not siFia AI counters or current tiers. Other discovered siFia generation,
onboarding, queue, and FaithPoints findings remain a separate security backlog
and must not expand the Journal launch path without a direct dependency.

1. Add owner-scoped schema changes using an expand-and-contract migration. Keep current siFia shared tables authoritative initially; do not create a second canonical copy of every legacy record. Add stable mapping IDs where needed, revisions, a resumable change feed, idempotency keys, and a merge ledger.
2. Enforce ownership, field allowlists, version checks, deletion rules, free-sync fair-use limits, and the dedicated Journal Cloud entitlement on the server. Audit only the table/storage/RPC surface used by Journal and shared sync for this launch slice. Keep service-role credentials on trusted servers. Validate input sizes and rate-limit abuse.
3. Capture writes/deletes from older siFia clients using audited database triggers or a controlled compatibility path. Update siFia writers for conditional edits; gate Journal two-way launch on a safe supported version. Resolve unsafe deletion code that currently accepts a body-supplied user ID before using admin privileges; deployed exposure still needs verification.

Exit gate: account A cannot read/write account B's rows or files; clients cannot set their own entitlement; stale writes cannot silently overwrite newer text; rollback and old-client behavior pass in staging.

### Phase 3 — Reliable local persistence

Detailed design: [Journal Cloud encrypted storage and recovery plan](journal-cloud-encrypted-storage-and-recovery-plan.md).

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

Detailed design: [Journal Cloud encrypted storage and recovery plan](journal-cloud-encrypted-storage-and-recovery-plan.md).

1. Create a logically separate private cloud area under the same identity system for encrypted Journal-only records, extensions, media, manifests, and wrapped device keys. Minimize readable metadata. Implement reviewed authenticated encryption and key wrapping using maintained libraries, not custom cryptography.
2. Implement resumable encrypted uploads/downloads, device authorization/revocation, quota accounting, and key recovery. Revocation blocks future access; it cannot erase plaintext already downloaded to a formerly authorized device. Shared base records continue using the free path and must be reconciled rather than duplicated by cloud restore.
3. Keep immutable recovery snapshots/versions with a declared trash and retention policy. Sync alone is not backup because it can propagate deletions. Record separately: local saved state, shared-sync state, encrypted-cloud upload state, and last verified recoverable snapshot. Schedule background work within OS limits and catch up on foreground; do not promise continuous background execution.

Exit gate: a new device recovers writing and media with the account plus a valid recovery method; the account password alone is insufficient. Version recovery survives accidental deletion. Partial uploads are never reported as a completed backup.

### Phase 9 — Subscriptions, costs, and backup UX

1. Offer one `journal_cloud` entitlement with monthly and annual products and the same feature/storage allowance. Use Apple IAP and Google Play Billing as the baseline mobile checkout. The [billing lifecycle and test matrix](journal-cloud-billing-lifecycle-and-test-matrix.md) recommends RevenueCat for the first release with a dedicated Supabase entitlement mirror. Journal is now on React Native 0.88.1 and the exact RevenueCat React Native SDK/UI packages at 11.0.2 compile on both platforms. The client remains safely disabled until each platform's public SDK key is supplied; no purchase UI or live catalog is enabled by this foundation.
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

Next implementation milestone: review the dedicated entitlement/lifecycle
contract, then trace only the receipt/deletion and shared-record authorization
paths Journal directly uses. Do not continue the siFia AI generation-ledger
work as a Journal prerequisite. In parallel, finish recurrence, rich lifecycle,
and structured guided-content mappings and resolve the React Native/billing SDK
compatibility gate. Only after those designs are accepted should we prepare an
additive sync/entitlement schema and transactional account-isolated storage
behind the documented gates. The preview is not wired to storage reads or the
account screen. Build and prove local media/export/restore before enabling
first-time remote merges or charging for Journal Cloud. Remote changes remain
additive and feature-gated; live access and store setup are operational
prerequisites.

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

Fourth reference checkpoint, pushed to both GitHub `main` branches on
2026-11-16:

| Repository | Commit | Included work |
| --- | --- | --- |
| Journal by siFia | `aa47e6b4` | Contract 0.1.2 diagnostics, reflection privacy boundary, deployed audit/runbook, owner-bound profile bootstrap evidence |
| siFia | `6359c919` | Matching contract consumer, reflection privacy guard, profile-bootstrap client guard and tests |

Both branches were verified at 0 ahead / 0 behind after push. Unrelated Journal
editor/session-note work and siFia Moments/native work remained unstaged.

## Seeker subscription bootstrap preparation, 2026-11-16

The next AJ-01/AJ-02 slice consolidates siFia's default free-subscription
initializer. `NewSubscriptionService.createDefaultSeekerSubscription` now
requires a verified current Auth identity, sends only that identity to the
legacy RPC, performs one non-recursive owner-checked readback, and uses fixed
sanitized failures. If a trusted billing race has already created a trial or
paid row, the client preserves it instead of downgrading it.

`IndustryStandardAuthContext` now delegates to that single service path. Its
duplicate RPC call, raw backend-error logging, and direct client rewrite of tier,
limits, and counters were removed. Static inventory therefore moves from two to
one direct `create_default_seeker_subscription` caller and from 32 to 30 direct
mobile subscription-table writes, now across five services instead of six. The
remaining writes still cover purchase, trial, usage, expiry, discount, and
webhook behavior; do not revoke table permissions until compatible trusted
operations replace them.

Focused verification: 9 new subscription-bootstrap tests pass, covering owner,
identity failure/mismatch, server denial, sanitized diagnostics, non-recursive
readback, cross-owner response, and preservation of an existing paid row. ESLint
passes with zero warnings for the changed service, AuthContext, and test.

The [manual Seeker bootstrap package](manual-sql/seeker-subscription-bootstrap/README.md)
began with a read-only metadata preflight. It expects the audited function
definition MD5 `1375a3a42b6e82c8bee176040ddca33a` and reports function grants/
callers plus the subscription table's columns, constraints, enum labels,
policies, and authenticated table privileges.

The user manually ran that preflight in the existing siFia project. It matched
the audited definition, owner, void result, required columns, RLS, unique
Auth-linked `user_id`, and Seeker/active enum labels. No Auth trigger or textual
database-function caller was reported. It also reconfirmed PUBLIC/anonymous
function execution and authenticated CRUD plus REFERENCES/TRIGGER/TRUNCATE on
the subscription table under permissive PUBLIC-role policies. The narrow
function baseline is accepted; AJ-02 remains open.

The package now includes a baseline-guarded owner-bound apply with integrated
synthetic assertions/savepoint cleanup, independent metadata verification,
siFia A/B and optional Journal-only smoke checks, containment, last-resort
rollback, and exact test-account cleanup. The user created two temporary Auth
users and manually executed the guarded apply. No SQL was executed by the
agent; subscription-table policies and grants were not changed.

The user then manually ran the guarded `02-apply.sql` on 2026-11-16. Its final
JSON reported `deployment_committed=true`, synthetic database assertions passed,
the simulated existing paid row was preserved, and no synthetic subscription
rows persisted. This confirms the hardened function committed past its
post-commit marker. The subsequent read-only `03-verify.sql` also passed: owner
postgres, definer true, void result, empty search path, PUBLIC/anonymous execute
false, authenticated execute true, and the expected deployment marker. The
deployed definition MD5 is `066542bb60eee673b2f3298e150e95ee`. Real app/session
testing then passed all seven prescribed checks on iOS: A initialized as Seeker,
survived sign-out/restart/sign-in, B initialized independently, and switching
back to A remained isolated. The final exact-row read-only SQL result confirmed
A and B independently had active Seeker rows; the optional Journal-only boundary
was not tested. The broader subscription-table policies and grants remain
unchanged and AJ-02 remains open.

This completes the Seeker helper's deployment evidence and raises Phase 2 from
5% to 10%. Overall weighted progress is now **13.9% (approximately 14%)**.
The user then deleted temporary Auth users A/B and the exact cleanup reported no
Auth users or residual subscription/profile rows. No synthetic test data remains.

## siFia subscription-usage audit continuation, 2026-11-16

After the GitHub checkpoint, the siFia caller inventory removed an unreachable
legacy mobile cluster: the client-side Apple webhook handler, its duplicate trial
service, and an unused discount service. Two additional uncalled mutations were
removed from `NewSubscriptionService`: a duplicate trial conversion path and a
client-wide expired-trial batch update. Static regression coverage now freezes
the remaining direct `user_subscriptions_new` mobile writes at 16: 13 in
`NewSubscriptionService` and three in `AppleStoreKitService`. This is local
surface reduction, not closure of AJ-02.

Five 2024 subscription documents that still described the retired services are
now explicitly archived and point to the current entitlement write-boundary
document. The real `supabase/functions/apple-webhook` handler remains; its only
change in this continuation is a non-executable comment correcting the stale
mobile-service reference. No Edge Function was deployed.

The user manually ran the first read-only subscription-usage preflight. It
confirmed that `user_subscriptions_new` and `validated_receipts` exist with RLS,
while repository-referenced `usage_tracking`, `subscription_usage_tracking`, and
`discount_codes` tables do not exist in the deployed project. Both anonymous and
authenticated roles retain effective SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, and TRIGGER privileges on both existing tables. The owner-scoped
subscription `ALL` policy restricts rows but not entitlement fields. Only the
paid-to-trial special-case trigger constrains entitlement transitions.

Four legacy usage helper overloads plus trial/expiry helpers remain broadly
executable, accept supplied identities in several signatures, and lack pinned
search paths. Their names/grants disqualify them from blind reuse, but exact
behavior required the prepared read-only function-source review. The user ran
that review manually. It confirmed arbitrary dynamic-column updates, definer
functions accepting supplied UUIDs, writes to missing/legacy tables, and a
PUBLIC/anonymous global expired-trial downgrade. The paid-to-trial trigger only
blocks one transition. None of the eight functions is accepted for reuse.

Repository tracing finds only the UUID `increment_usage_tracking` overload in a
current mobile caller. That analytics path does not inspect the returned
Supabase error, so the missing-table failure can be silent; it is not
authoritative entitlement accounting. No repository caller was found for the
other seven, but external cron/old-client use is still unknown. A replacement
would need a distinct owner-derived operation without immediately revoking
legacy functions.

Subsequent product clarification separated this siFia generation-usage issue
from Journal Cloud. The evidence remains valid security backlog input, but no
replacement operation or apply package will be prepared as a Journal launch
prerequisite without separate approval. Phase 2 remains 10% and overall
weighted progress remains **13.9% (approximately 14%)**; read-only caller
inventory and this scope correction do not receive deployment credit.

## RevenueCat client foundation, 2026-11-17

Journal by siFia was upgraded to React Native 0.88.1 before adding exact
`react-native-purchases` and `react-native-purchases-ui` 11.0.2 dependencies.
The new billing coordinator selects the platform public SDK key, remains inert
when that key is absent, serializes account identity changes, requires a signed-
in account for Restore Purchases, and recognizes only the named `journal_cloud`
entitlement. App authentication now synchronizes the RevenueCat customer
identity after bootstrap. Client `CustomerInfo` is explicitly presentation
state only; it cannot authorize a Journal Cloud upload or download.

Seven focused coordinator/helper tests passed, including missing-key disable,
signed-in initialization, anonymous-to-account transition, account switching,
sign-out, restore account enforcement, and exact entitlement selection. The
existing idle-scheduling and Today opening regression suites also passed. Jest
still retained a pre-existing open handle after reporting all suites `PASS`, so
the completed test process required manual interruption and this runner issue
remains open.

Native verification passed on both platforms. CocoaPods installed RNPurchases
and RNPaywalls 11.0.2, PurchasesHybridCommon 20.7.0, and RevenueCat/RevenueCatUI
5.102.2; the unsigned iOS simulator build reported `BUILD SUCCEEDED`, and the
app launched to its normal Today screen with no RevenueCat keys. Android's full
four-architecture `assemblePlayDebug` reported `BUILD SUCCESSFUL`; the resulting
APK is 348,623,031 bytes with SHA-256
`49fa33d2f77c594b9f777b212c3e9c37a2dda2f784bffd7144961c64349d0f22`.
The shared contract archive remains byte-identical at SHA-256
`597a6761564dd9113248d9961ae5290ab58c8797f925eba69ead49b991709d3b`.

This is a client compatibility and identity foundation only. No RevenueCat
project, public SDK key, store product, offering, paywall, purchase, webhook,
server entitlement mirror, SQL, cloud access, or live backend deployment was
created. It raises Phase 9 from 0% to 20% and the weighted roadmap from 13.9% to
**15.1% (approximately 15%)**. Store/provider setup and the trusted server
boundary are the next gates.

## RevenueCat iOS catalog checkpoint, 2026-11-17

The Apple `Journal Cloud` subscription group now contains monthly and annual
auto-renewable products with identifiers
`app.journal.sifia.cloud.monthly` and `app.journal.sifia.cloud.annual`.
RevenueCat maps both to the single `journal_cloud` entitlement and exposes them
as `$rc_monthly` and `$rc_annual` in the current `default` offering. The iOS
public SDK key is present only in the ignored local `.env.mobile` file.

An iPhone simulator build succeeded and launched. A real SDK offering read then
returned `default`, USD 1.99 / `P1M`, and USD 19.99 / `P1Y`; the exact catalog
validator passed with no issues. This was read-only: no purchase, restore,
entitlement grant, webhook, SQL, or cloud access occurred. Focused billing tests
now cover safe offering projection plus exact current-offering/product/period
validation.

Launch pricing is USD 1.99 monthly / USD 19.99 annual as the United States base,
with a Philippines override of PHP 59 monthly / PHP 349 annual. Both periods
provide one account-level 5 GB total allowance for documents and compressed
photos; video and unlimited storage are excluded from v1. This checkpoint raises
Phase 9 to 40% and weighted delivery to **16.3% (approximately 16%)**. Android
catalog setup, the customer-facing paywall and purchase/restore lifecycle, and
the trusted webhook/server entitlement mirror remain.

## Journal Cloud read-only preview checkpoint, 2026-11-17

Profile now exposes an Account & Data entry for Journal Cloud. Its dedicated
screen explains the 5 GB total allowance, compressed-photo scope, restore
benefit, and the boundary that compatible siFia records continue syncing for
free. Signed-out users may inspect the plans and continue into the existing
siFia sign-in flow. Signed-in users see a disabled secure-setup state.

The screen fetches the current RevenueCat offering and displays only validated
store-localized prices. It does not substitute hardcoded prices when the
catalog is unavailable or incomplete. Annual and monthly plan presentation is
derived from the exact product identifiers and periods. Purchase, restore,
entitlement grant, webhook, SQL, upload, and download paths remain disabled.

Focused billing tests pass 12/12 and targeted lint is clean. Live simulator
verification confirmed the screen, its free-sync disclosure, USD 19.99 annual
and USD 1.99 monthly store prices, signed-out sign-in action, and disabled
restore state. This checkpoint raises Phase 9 to 50% and weighted delivery to
**16.9% (approximately 17%)**. The trusted entitlement mirror and webhook are
the next authorization gate before a sandbox purchase button can be enabled.

## RevenueCat webhook security-contract checkpoint, 2026-11-17

A new pure server contract validates the exact Authorization value configured
in RevenueCat and its HMAC-SHA256 signature over the unchanged request body,
with a five-minute timestamp tolerance. It defensively parses the documented
event envelope, resolves only one Supabase Auth UUID, allowlists the current
Apple Journal Cloud products, separates sandbox/production, and quarantines
anonymous owners, transfers, temporary grants, ambiguous aliases, and unknown
products.

The contract never converts a webhook type directly into cloud access. Initial
purchase, renewal, cancellation, billing issue, and expiry events are only
triggers for a future authoritative RevenueCat customer reconciliation. Nine
focused tests pass, including invalid authorization, body tampering, replay,
identity ambiguity, environment isolation and lifecycle ordering boundaries.
No receiving endpoint, provider lookup, secret, database write, purchase, or
cloud authorization exists yet.

A read-only catalog preflight is prepared under
`docs/manual-sql/journal-cloud-entitlement`. The user must run it manually and
share its single JSON result before additive schema/apply SQL is designed. This
checkpoint raises Phase 9 to 55% and weighted delivery to **17.2%
(approximately 17%)**; Phase 2 remains 10% because no backend enforcement has
been deployed.

## Cross-platform entitlement deployment checkpoint, 2026-11-17

Apple and Google monthly/annual products are attached to the same RevenueCat
`journal_cloud` entitlement and current offering. Store credentials validate,
Google real-time developer notifications are connected, and distinct
production and sandbox Edge Function endpoints require separate exact
authorization and HMAC secrets. Signed RevenueCat `TEST` deliveries from both
App Store and Play Store returned success, were recorded as processed, and had
the expected `ignore` disposition without granting access.

The guarded additive Supabase package was run manually. All four Journal Cloud
tables use forced RLS; authenticated clients have owner-scoped SELECT only on
the minimal entitlement projection, while private billing evidence has no
client table privileges. Reconciliation is executable only by `service_role`.
Independent metadata verification and synthetic owner/cross-owner, replay,
payload-mismatch, active/inactive, and sandbox-isolation tests passed with no
synthetic rows persisted. Legacy siFia billing objects were unchanged.

The mobile billing service now contains a guarded plan-purchase method that
requires an authenticated account and an exact complete offering. A separate
owner-derived service reads the Supabase projection and treats only a current
production `active` row as server-authorized. Neither method is allowed to
authorize private uploads from RevenueCat client state alone. Focused billing,
webhook, and entitlement tests pass 36/36; targeted lint and diff checks are
clean. The checkout UI remains disabled because a successful store receipt is
not yet a promise that encrypted upload, restore, deletion, and recovery are
ready. Phase 9 is now 97%, and weighted roadmap delivery is **19.7%
(approximately 20%)**.

## Backup restore-planning checkpoint, 2026-11-18

The V1 inventory now records exact source-key provenance for canonical Journal,
reflection, prayer, Bible Study, routine, and review records. This prevents a
singleton entry from being silently restored as an ordinary collection entry.
The backup validator requires these locations before a restore can be planned.

A new pure restore planner imports no storage API and performs no writes. It
validates every record/key pair, enforces exact namespaces for drafts, Gospel
content, and preferences, rejects duplicate output keys, reconstructs active
indexes instead of trusting backed-up indexes, derives the latest Bible Study
pointer deterministically, and warns while excluding legacy records with no
proven V1 mapping. Any fatal issue returns an empty operation list. Three
focused suites pass 13/13, the storage dependency gate tests pass 4/4, the UUID
regression suite passes 5/5, and diff validation is clean. Phase 5 moves from
15% to 20%; weighted roadmap delivery was **25.2% (approximately 25%)**.

This is not yet user-visible backup or restore. No file was created, no local
record was changed, no cloud upload occurred, and no SQL was run. Authenticated
archive encryption, media packaging, resource/path limits, rollback execution,
and clean-device iOS/Android restore tests remain.

The following portable-manifest safety increment adds a distinct versioned
archive manifest intended to live only inside a future authenticated encrypted
container. Its pure validator bounds manifest/container/object sizes, records,
assets, nesting depth, structural nodes, strings, and object-key lengths. It
requires exact opaque `objects/<UUID>` paths, allowlisted image/audio media,
SHA-256 declarations, unique IDs/paths, real owning records, and internally
consistent totals. Restore preflight additionally requires native-stream
evidence for the authenticated final marker and exact observed object lengths.
It explicitly does not authenticate or encrypt anything itself. Four focused
backup suites pass 20/20 and targeted lint/diff checks are clean. Phase 5 is now
24%; weighted delivery is **25.6% (approximately 26%)**.

## Archive encryption provider gate checkpoint, 2026-11-18

The current React Native package field was reviewed before adding a native
archive-encryption dependency. No candidate jointly proves the required
native `secretstream` final-marker semantics, Argon2id off the JavaScript
thread, current upstream libsodium, React Native 0.88/new architecture, and
clean-device iOS/Android failure behavior. No crypto package was installed.

An executable acceptance contract now requires exact package and libsodium
versions, lockfile integrity, source/license verification, all required native
capabilities, and platform evidence for round trips, known-answer vectors,
wrong keys, corruption, truncation, reordering, final tags, bounded memory,
interruption, and log hygiene. It intentionally reports blocked until real
provider evidence exists. Focused synthetic tests prove acceptance only when
every field passes and fail closed for missing, outdated, blocking, or partial
evidence. Phase 5 is now 25%; weighted delivery is **25.7% (approximately
26%)**. Native authenticated encryption remains unimplemented.

## Native archive-crypto host spike checkpoint, 2026-11-18

The official libsodium 1.0.22 source release is pinned by its exact GitHub
release URL and published SHA-256 digest. The reproducible spike rejects a
wrong digest, oversized download, unexpected redirect host, and archive paths
outside the pinned source root before extraction. It builds the minimal static
library in a newly created temporary directory and removes that directory at
the end; no generated native binary or source archive is committed.

The synthetic native C harness derives an archive key with Argon2id13, encrypts
three bounded chunks with XChaCha20-Poly1305 secretstream, requires the final
tag, and proves correct decryption. It also proves rejection of a wrong
password, modified ciphertext, a truncated chunk, reordered chunks, and a
stream stopped before its final tag. Keys, salt, native states, recovered
plaintext, and ciphertext buffers are cleared before exit. The harness writes
no plaintext file and prints only non-secret assertion metadata. Supply-chain
tests pass 4/4 and the native harness passes every assertion.

This is host evidence only, so the production provider gate intentionally
remains closed. It does not yet prove a React Native 0.88.1 new-architecture
module, off-JavaScript-thread execution, an iOS/Android build, device memory
behavior, interruption cleanup, or cross-platform vectors. Phase 5 moves from
25% to 27%; weighted delivery is **25.9% (approximately 26%)**. No app data,
Supabase row, SQL, purchase, cloud upload, or user-visible behavior changed.

## Android archive-crypto artifact checkpoint, 2026-11-18

The repository now has a clean-room Android artifact verifier that downloads
the same pinned libsodium 1.0.22 release, rechecks its SHA-256 and archive root,
and invokes the upstream AAR build with the project's Android floor and NDK.
It retains no generated AAR or extracted source after the run.

The end-to-end run passed with NDK 27.1.12297006 and `minSdk` 24. The resulting
temporary 2,654,317-byte AAR contained 1,330 entries, all four supported ABIs,
and the full, static, minimal, and minimal-static Prefab modules. `llvm-nm`
confirmed `crypto_pwhash_argon2id`,
`crypto_secretstream_xchacha20poly1305_init_push`, `randombytes_buf`, and
`sodium_memzero` in every full shared library. Four focused verifier tests and
the four existing supply-chain tests pass.

This is packaging evidence, not app integration or device approval. No native
module is registered, the AAR is not shipped, and customer journal data cannot
reach it. The provider gate remains closed until isolated React Native 0.88.1
TurboModules, off-JavaScript-thread work, and cross-platform device failure
evidence pass. Phase 5 moves from 27% to 28%; weighted delivery
is **26.0% (approximately 26%)**. No SQL or user action was required.

## iOS archive-crypto artifact checkpoint, 2026-11-18

The paired Apple verifier now rebuilds the same pinned libsodium release for an
iOS arm64 device and arm64/x86_64 simulators at the app's iOS 15.1 deployment
floor. It creates a temporary static XCFramework with the reviewed headers and
module map, validates its `Info.plist`, checks the device and simulator slices,
and deletes every generated artifact after the run.

The clean run passed with Xcode 26.4.1 (build 17E202). Both XCFramework platform
entries contained their expected architectures, and `nm` confirmed
`crypto_pwhash_argon2id`,
`crypto_secretstream_xchacha20poly1305_init_push`, `randombytes_buf`, and
`sodium_memzero` in the device and universal simulator libraries. Three focused
iOS-verifier tests pass in addition to the Android, source, and provider tests.

This remains packaging evidence only: the XCFramework is not linked, no
TurboModule exists yet, and customer journal data cannot reach this code. The
production gate remains closed pending isolated React Native 0.88.1 modules,
off-JavaScript-thread work, cross-platform vectors, and device failure tests.
Phase 5 moves from 28% to 29%; weighted delivery is **26.1% (approximately
26%)**. No SQL or user action was required.

## Archive-crypto TurboModule contract checkpoint, 2026-11-18

The app now declares one isolated React Native 0.88.1 new-architecture module,
`JournalArchiveCrypto`, with only two promise methods: provider metadata and a
synthetic self-test. The contract exposes explicit evidence for Argon2id,
secretstream, wrong-password, corruption, truncation, reordering, final-tag,
buffer-clear, plaintext-file, platform, architecture, and execution-boundary
assertions. It intentionally exposes no source path, destination path,
encrypt/decrypt method, archive bytes, key, passphrase, or customer record.

The fail-closed contract checker has three passing tests: the approved shape,
rejection of a premature customer-file surface, and rejection of Android/iOS
codegen drift. The real React Native code generator also completed for both
platforms in a disposable directory. Verification found the expected Android
Java/JNI module, iOS Objective-C++/JSI protocol, both methods, and iOS provider
registration; the generated files were deleted after inspection.

This is an interface checkpoint, not a native crypto implementation. The
module is not imported by the app, no native module is registered or shipped,
no libsodium binary is retained, and no journal data can reach it. The provider
gate remains closed pending native implementations, off-JavaScript-thread
Argon2id/streaming work, cross-platform vectors, and device failure tests. The
repository-wide TypeScript command remains red on pre-existing project/config
debt (including the missing `@react-native/typescript-config` base and existing
UI/test errors); React Native codegen itself accepted this new spec. Phase 5
moves from 29% to 30%; weighted delivery is **26.2% (approximately 26%)**. No
SQL or user action was required.

## Android archive-crypto shell checkpoint, 2026-11-18

Android now registers `JournalArchiveCrypto` through a dedicated
`BaseReactPackage` and implements the generated React Native 0.88.1
TurboModule base class. The shell exposes only the two previously approved
synthetic-evidence methods. It reports `not-linked`, keeps provider approval
and off-JavaScript-thread execution false, and returns false for every crypto
self-test assertion. It accepts no journal bytes, file paths, keys, passwords,
or passphrases.

A focused source gate has four passing tests covering the approved fail-closed
shape, rejection of premature provider approval, rejection of a customer-file
surface, and required application registration. Gradle codegen generated the
configured Java/JNI bridge, Kotlin and Java compilation succeeded, all four
Android native architectures built, and `assemblePlayDebug` completed with
866 tasks. The APK is a development verification artifact only; the shell is
not called by product UI and cannot encrypt, decrypt, export, or restore data.

The production provider gate therefore remains closed. The next work is the
isolated synthetic Android implementation using the verified libsodium
artifact, followed by background execution, negative vectors, interruption
cleanup, and device evidence before any customer-facing method can exist.
Phase 5 moves from 30% to 31%; weighted delivery is **26.3% (approximately
26%)**. No SQL or user action was required.

## Android archive-crypto native provider checkpoint, 2026-11-18

Android now links an isolated synthetic-only JNI provider to the retained,
hash-pinned libsodium 1.0.22 Prefab artifact. The module accepts no journal
bytes, file paths, passwords, passphrases, or keys, and runs its fixed native
self-test on a named single-thread executor rather than the JavaScript thread.
It derives a key with Argon2id, exercises chunked XChaCha20-Poly1305
secretstream encryption, clears sensitive buffers, and requires rejection of
wrong passwords, tampering, truncation, reordering, and a missing final tag.

Runtime testing first caught and rejected unresolved CPU-specific symbols in
the upstream Android AAR before any customer surface existed. The retained
artifact is now reproducibly rebuilt from the same verified source SHA-256
using the portable profile, a baseline compiler target, and Argon2's reference
implementation. An `llvm-nm` gate checks every supported ABI for the required
exports and rejects unresolved libsodium-internal implementation symbols. The
retained AAR SHA-256 is
`37e33fb2a93451805609d11747de04c1751454a35eee9a51fa086fa24aa25a61`.

Verification passed 13/13 focused artifact/provider tests, the independent
integrity and source-surface gate, all six Android/iOS codegen assertions,
targeted ESLint, and the full four-ABI `assemblePlayDebug` build (866 tasks).
The corrected APK launched normally on the Android ARM64 emulator. Its
development diagnostic reported libsodium 1.0.22 and passed Argon2id,
secretstream round trip, wrong-password, tamper, truncation, reordering,
missing-final, and sensitive-buffer clearing assertions. It also confirmed
that no plaintext file was written and no customer-data API was enabled.

This does not enable export or restore. Production approval remains false,
and the next provider work is the equivalent isolated iOS implementation plus
portable cross-platform vectors and interruption cleanup before any file or
customer-data method can be designed. Phase 5 moves from 31% to 33%; weighted
delivery is **26.5% (approximately 27%)**. No SQL or user action was required.

## iOS archive-crypto native provider checkpoint, 2026-11-18

iOS now links a retained, integrity-gated static XCFramework built from the
same pinned libsodium 1.0.22 source as Android. The artifact contains an arm64
device slice and an arm64/x86_64 simulator slice, uses one consistent static
library name, records its source and tree digests, and is registered through a
local CocoaPod. The Objective-C++ TurboModule accepts no journal bytes, file
paths, passwords, passphrases, or keys and runs its fixed synthetic self-test
on a dedicated serial queue rather than the JavaScript thread.

The iOS implementation derives a key with Argon2id, exercises chunked
XChaCha20-Poly1305 secretstream encryption, clears sensitive buffers, and
requires rejection of wrong passwords, tampering, truncation, reordering, and
a missing final tag. Its development diagnostic also confirms that it writes
no plaintext file and exposes no customer-data API. Production approval
remains explicitly false.

Verification passed all four artifact tests, all six iOS source/integrity
tests, the fail-closed source gate, targeted ESLint, CocoaPods installation,
and a complete iOS simulator build. The exact built app was installed and
launched on an arm64 iPhone 17 Pro Max simulator; the runtime diagnostic
reported libsodium 1.0.22 and passed every positive and negative assertion.

This still does not enable export or restore. The next provider work is a
portable vector set proving identical Android/iOS bytes and failure behavior,
followed by bounded file transport and interruption cleanup before any
customer-data surface can be designed. Phase 5 moves from 33% to 35%; weighted
delivery is **26.7% (approximately 27%)**. No SQL or user action was required.

## Portable archive-crypto vector checkpoint, 2026-11-18

A canonical synthetic vector now locks the portable backup-encryption format
before file access is introduced. It fixes the password, salt, Argon2id
parameters, secretstream key, header, chunk boundaries, tags, ciphertext, and
expected rejection cases. The canonical JSON is itself protected by SHA-256
`1c0177dbba76e3823eac4ed0e23b7cb44afcc9de8577a95e49c75e9f0ce72e14`.
The gate fails if the fixture changes, a platform drifts from the canonical
bytes, or a caller-controlled vector is added to the native boundary.

The host harness and both native implementations consume the same fixed
evidence. Android and iOS derive the exact expected key, emit the exact
authenticated bytes, and agree on wrong-password, tamper, truncation,
reordering, and missing-final rejection. React Native codegen explicitly
verifies the new fixed self-test method for both platforms; no password, key,
journal payload, or file path crosses the JavaScript interface.

Verification passed 24 focused source tests, all five fail-closed gates,
targeted ESLint, the pinned host-native run, a complete Android Play-debug
build, and a complete iOS simulator build. The exact new APK and simulator app
were installed and exercised on arm64 devices. Both runtime dialogs reported
libsodium 1.0.22, portable vector `journal-archive-portable-v1`, matching key
and byte parity, matching failure behavior, no plaintext file, and no
customer-data API.

This is format-compatibility evidence, not an export or restore feature.
Production approval remains false. The next bounded work is encrypted file
transport with strict size limits and interruption cleanup, followed by media
packaging, transactional restore, and clean-device evidence. Phase 5 moves
from 35% to 37%; weighted delivery is **26.9% (approximately 27%)**. No SQL or
user action was required.

## Bounded archive file-transport checkpoint, 2026-11-18

The synthetic-only native crypto boundary now proves that encrypted archive
bytes can be written without exposing a customer payload, password, key, or
path to JavaScript. Android and iOS write the fixed portable ciphertext in
bounded segments, reject input beyond the absolute cap, stage it in a private
temporary file, synchronize the file, publish it with a same-directory atomic
rename, synchronize the directory, and verify the exact published bytes and
private file mode. The diagnostic also simulates an interrupted stale part,
confirms that incomplete output is never visible as a finished archive, removes
the stale file on retry, and removes every synthetic artifact at completion.

The React Native contract exposes only a parameterless fixed self-test. Source
gates reject caller-controlled transport data, and codegen verifies the method
on both native platforms. This does not create a user export, accept journal
content, choose a destination, or restore data; those production surfaces stay
closed until media packaging and the rollback-safe restore path are separately
designed and verified.

Verification passed 21 focused contract/shell/vector tests, both fail-closed
source gates, React Native codegen, targeted ESLint, diff validation, a complete
four-ABI Android Play-debug build, and a complete iOS simulator build. The
transport assertions cover bounded writes, size rejection, temporary staging,
hidden incomplete output, durable atomic publication, stale cleanup, exact-byte
verification, complete artifact cleanup, and the absence of a plaintext file.

Phase 5 moves from 37% to 41%; weighted delivery is **27.3% (approximately
27%)**. Production approval remains false. The next bounded work is authenticated
media packaging, followed by the transactional rollback executor and
clean-device restore evidence. No SQL or user action is required.

## Authenticated archive media-packaging checkpoint, 2026-11-18

The synthetic-only native boundary now packages one fixed JPEG and one fixed
M4A asset through XChaCha20-Poly1305 secretstream without exposing customer
bytes, passwords, keys, or paths to JavaScript. Before encryption it validates
the allowlisted media kind, MIME type, binary signature, per-asset size,
aggregate asset count and byte limits, strict UUID owner, opaque archive path,
unique asset IDs and paths, and declared SHA-256 content hash.

Each encrypted chunk authenticates the archive version, asset ID and path,
media kind and MIME type, owner, plaintext length and digest, and chunk
position/count as associated data. Restore-side synthetic assertions reject a
signature/MIME mismatch, oversized individual and aggregate inputs, content
hash mismatch, wrong owner, unsafe path, duplicate ID/path, altered metadata,
reordered chunks, and a stream without its final marker. Keys, plaintext,
digests, associated data, ciphertext, and secretstream state are cleared; no
plaintext file is created.

The React Native surface remains a parameterless fixed self-test, and source
gates still reject caller-controlled media or any customer-data operation.
Verification passed 23 focused contract/shell/vector tests, all standalone
source and codegen gates, targeted ESLint, diff validation, a complete
four-ABI Android Play-debug build, and a complete iOS simulator build. The
exact APK and iOS app then passed the full media diagnostic on ARM64 emulators.

Phase 5 moves from 41% to 45%; weighted delivery is **27.7% (approximately
28%)**. Production approval remains false. The next bounded work is the
transactional rollback executor, followed by clean-device restore evidence and
a separately reviewed customer-data surface. No SQL or user action is required.

## Transactional restore-executor checkpoint, 2026-11-18

The pure restore plan now has a storage-agnostic executor, still disconnected
from AsyncStorage and customer records. It accepts only the canonical reviewed
Journal-owned key policy and requires a coordinator whose exclusive lease must
be shared by every future Journal mutation path. This prevents a normal app
write from racing the snapshot, removal, apply, or verification stages.

Before changing an owned key, the executor captures every existing and planned
key, persists a bounded rollback snapshot, and writes a versioned recovery
marker. It removes only exact reviewed namespaces, applies the deterministic
plan, then reads back both the complete owned key set and every value before
removing recovery evidence. Any apply or verification failure restores the
exact prior key set and values. If rollback itself cannot be verified, the
snapshot and marker remain and the result explicitly requires recovery; a
separate startup-safe recovery entry point can finish that rollback later.
Persisted rollback entries outside the canonical Journal namespace are rejected
without mutation.

Eleven focused executor tests cover success, exact rollback, rollback failure,
interrupted recovery, foreign-key preservation, canonical-policy drift,
malicious and empty snapshots, oversized recovery metadata, existing recovery
evidence, and the no-work path. All five backup suites pass 31/31, the storage
dependency gate tests pass 4/4, targeted ESLint, strict targeted TypeScript,
and diff validation pass. The
production storage dependency gate continues to fail closed as intended because
the current OpenSSL 3.6 graph is not approved.

Phase 5 moves from 45% to 49%; weighted delivery is **28.1% (approximately
28%)**. Production approval remains false. The next bounded work is the
reviewed production adapter and startup recovery boundary, then clean-device
restore evidence. No SQL or user action is required.

### Restore recovery on a new database connection (2026-11-18)

The development diagnostic opens a disposable database, writes a synthetic
interrupted restore, closes it, and opens it again. Before the first journal
read, recovery restores the original value and clears the rollback records.
The iOS simulator passed, and the user confirmed the same diagnostic passed
on the Android emulator. Each run used a temporary encryption key held in the
same process. A host file-backed test also passed. A separate test confirms that
invalid rollback evidence prevents the session from opening and preserves the
evidence for recovery.

Phase 5 is estimated at 51% and weighted delivery at 28.3%. This database
reopen check is complete on both mobile platforms. Recovering the key after process
termination, integration with customer startup, and a clean-device restore
remain separate milestones.

### Restore after terminating the app process (2026-11-18)

The development diagnostic runs the restore executor on a disposable encrypted
database. It pauses after the replacement value commits and before final
verification. In testing, the native app process was then terminated. The new
process retrieved the existing device-held key, opened the existing file,
restored the original test value before the first session read, and verified
that both rollback records had been cleared. Successful verification removes
the disposable database. A missing key or file causes verification to fail.

| Platform | Result |
| --- | --- |
| iOS 26.3, iPhone 17 Pro Max simulator | Passed after terminating and relaunching a debug build with its configured simulator Keychain entitlement. The initial build lacked that entitlement and stopped before arming. |
| Android API 35, Pixel 8 emulator | Passed after a force-stop and relaunch. The developer menu required a Metro reconnect and reload in the new process. |

For a repeat, open the developer menu and select **Test Journal restore after
relaunch**. Choose **Arm** and wait for the armed alert. Terminate the app
process, launch Journal again, open the same menu, and choose **Verify**.
The expected alert is **Journal restore after relaunch passed**.

Phase 5 is estimated at 53% and weighted delivery at 28.5%. This diagnostic
uses synthetic data and an explicit developer action after launch. Automatic
startup recovery for customer journals and restoring an exported backup to a
clean device are still pending.

### Automatic restore check at startup in development (2026-11-19)

The development build now checks for a pending synthetic restore before loading the Journal app. Arming the test saves a flag after preparing the original entry and before applying the replacement. On the next launch, Journal opens the existing test database with its saved device key, recovers the original entry, and checks that the rollback records are gone. If verification fails, the app shows a retry button and retains the evidence. An ordinary development launch skips the test database.

To repeat on a rebuilt debug app, choose **Test Journal restore after relaunch → Arm** in the developer menu. Wait for **Journal restore interruption armed**, terminate the native app process, and open Journal again. The expected alert is **Journal startup restore check passed** with the message **Journal recovered the original test entry before opening.**

Testing surfaced an iOS crash when Hermes released an OP-SQLite worker after shutdown. A focused native regression check reproduced failure when another thread reused the old worker's ID. The dependency patch identifies the currently running worker directly and preserves protection against a worker trying to join itself. Run the regression check from the repository root with:

```sh
c++ -std=c++17 -pthread -I node_modules/@op-engineering/op-sqlite/cpp \
  scripts/test-journal-sqlite-worker.cpp node_modules/@op-engineering/op-sqlite/cpp/OPWorkerThread.cpp \
  -o /tmp/journal-sqlite-worker-test && /tmp/journal-sqlite-worker-test
```

| Check | Result |
| --- | --- |
| iOS 26.3 simulator | Automatic recovery passed after process termination. Dismissing the result opened Today. |
| Android API 35 emulator | Automatic recovery passed after a force-stop and cold launch of the rebuilt app. |
| Automated verification | 43 focused JavaScript tests passed. The native worker regression check failed before the patch and passed afterward. |

Phase 5 is estimated at 55% and weighted delivery at 28.7%. The next Phase 5 check is restoring a synthetic exported backup on a clean installation. Customer-data rollout still depends on a supported storage provider.

## 2026-11-19 · Phase 5 portable text backup

A debug-only test exports one generated text entry to an encrypted file. Only the file crosses devices. The receiving app authenticates it using a fixed test recovery code, validates the manifest, and runs the restore planner and executor against a new SQLCipher database with a fresh local key. It then closes and reopens the database and checks both the entry and its index. The fixed recovery code is solely for this synthetic fixture.

| Source and destination | Observed result |
| --- | --- |
| Android emulator → newly installed iOS simulator app | The random identifier displayed after restore matched the one displayed at export. |
| iOS simulator → fresh app data in a separate Android emulator user profile | A second, independently generated identifier matched after restore and database reopen. |
| Native host test | Restored after deleting the source directory. Wrong code, modified, truncated, appended, missing and symlinked files were rejected. |
| Regression checks | Both mobile debug builds passed. All 39 focused JavaScript backup and restore tests passed. |

To repeat, open **Test portable Journal backup → Export** in the source app’s developer menu and record the generated identifier. Transfer only `journal-transfer-test.bin` from the source app’s temporary directory (iOS) or cache directory (Android) to the corresponding destination directory. Select **Test portable Journal backup → Restore** on the destination. Compare the **Transferred restore passed** identifier with the source.

Phase 5 is estimated at **58%**, with weighted overall delivery at **29.0%**. The next checkpoint is to restore an entry with a photo and verify that a missing or damaged attachment leaves the existing destination journal intact. The user-facing backup and recovery-code flow still needs implementation and customer rollout still requires a supported storage provider.

## 2026-11-19 · Phase 5 encrypted photo restore

The development backup now includes a generated PNG linked to a journal entry. The recipient authenticates the archive, checks the photo’s owner, path, length and SHA-256 digest, and restores the entry and photo together. The small image is stored inside the synthetic entry. Full-size, file-backed attachments still need a separate storage and recovery test.

| Check | Result |
| --- | --- |
| iOS → fresh Android installation | The Android app restored the encrypted iOS export and verified the entry, its index and photo after reopening SQLCipher. The identifier matched the original iOS export. |
| Host → fresh iOS installation | The iOS app restored an independently generated encrypted photo, reopened SQLCipher and displayed the matching identifier. |
| Missing photo | The native importer rejected an authenticated file whose manifest listed a photo but whose payload omitted it. All existing destination records matched after database reopen. |
| Damaged photo | The importer rejected an authenticated file with one changed image byte. All existing destination records matched after reopen. |
| Valid photo | The restored image matched an independently checked SHA-256 digest after a disk database reopen. The text and rebuilt index matched too. |
| Older backups | The importer accepted the previous text-only format. The host reader also opened an iOS export from the previous checkpoint. |

To repeat the host integration test on a development machine with libsodium and Node’s SQLite module installed, run from the repository root:

```sh
c++ -std=c++17 -Wall -Wextra -Werror scripts/test-journal-synthetic-transfer.cpp $(pkg-config --cflags --libs libsodium) -lz -o /tmp/journal-transfer-host
/tmp/journal-transfer-host
JOURNAL_TRANSFER_HOST=/tmp/journal-transfer-host ./node_modules/.bin/jest --runInBand --coverage=false --testMatch '**/journalPhotoTransfer.integration.ts'
```

Phase 5 is estimated at **60%**, with weighted overall delivery at **29.2%**. The next checkpoint is to stage a full-size image as a separate file and prove that an interrupted restore preserves the previous entry and its photo together.

### 2026-11-19 • Interrupted restore of a file-backed photo on the development Mac

The host test stores two distinct synthetic 1600 × 1200 PNGs as encrypted files. The native helper writes a new file in 64 KiB chunks, verifies its size and SHA-256, and publishes it under a fresh name before the restore executor can reference it. The old file stays available until the database has reopened and recovered. Cleanup requires an exclusive directory and the complete set of live filenames.

| Interruption or input | Verified on reopen |
| --- | --- |
| Process killed halfway through writing the replacement | The original entry, index and full photo survived. Cleanup removed the partial file. |
| Process killed after publishing the file | The original entry still referenced its original photo. Cleanup removed the unreferenced replacement. |
| Process killed after committing the replacement entry while rollback was pending | The database contained the replacement before recovery. Recovery restored the original entry and its matching file. |
| Incorrect ciphertext digest, followed by a valid retry | Staging rejected the digest and discarded the temporary file. The retry restored the replacement entry, index and matching photo, including after cleanup and a second reopen. |

Run the previous native host build command, then run both file-transfer suites with:

```sh
JOURNAL_TRANSFER_HOST=/tmp/journal-transfer-host ./node_modules/.bin/jest --runInBand --coverage=false --testMatch '**/journal*Photo*integration.ts'
```

Phase 5 is estimated at **61%**, with weighted overall delivery at **29.3%**. These tests use desktop SQLite and synthetic encryption credentials. The next checkpoint is to exercise full-size file staging and recovery in the iOS and Android development apps with their encrypted databases.

### Mobile recovery of a full-size photo · 2026-11-19

The development app generates two different 1600 × 1200 PNGs and encrypts them. The test saves the original entry, then starts restoring its replacement. It pauses after writing the new photo reference to SQLCipher, while the saved evidence for rolling back the restore still exists. An external process stop at that point exercises the same recovery code a fresh process must use.

| Development target | What was verified |
| --- | --- |
| iPhone 17 Pro Max simulator, iOS 26.3 | After a forced restart, Journal recovered the original text, index and exact decrypted image. A second restore wrote the replacement and it survived another database reopen. |
| Pixel 8 Android emulator, ARM64 | After an external force-stop and fresh launch, Journal recovered the original text, index and exact decrypted image. Retrying restored the replacement, which survived another database reopen. |

To repeat in a development build, open the developer menu and choose **Test full-size photo recovery → Arm**. Wait for **Photo restore armed**, terminate the app process externally, and relaunch. Choose **Test full-size photo recovery → Verify**. The expected alert reads **Photo restore passed**.

Android app-private storage on the API 35 emulator denied hard-link creation. The Android implementation now publishes a completed file with a no-replace rename and syncs the directory before returning its filename to the database. A name collision or unsupported filesystem operation fails the restore.

Phase 5 is estimated at **63%**. Weighted overall delivery is **29.5%**. The fixture uses its own encrypted database and its own app-private photo directory. Device interruption during the file copy and immediately after file publication are the next checks. The previous host test covers those two points. The customer-facing export and restore flow is still pending.

### Testing interruptions while restoring a photo · 2026-11-19

Use the development build on an iOS simulator or Android emulator. Each test uses a generated 1600 × 1200 photo and a dedicated encrypted test database.

1. In the developer menu, choose **Test photo copy interruption → Stop app**. Journal closes when it has copied at least half of the encrypted replacement photo and still has bytes left to copy.
2. Reopen Journal. In the same developer menu item, choose **Verify**. The check confirms that an incomplete copy exists, reads the original entry and photo, and removes the interrupted copy and its temporary encrypted source. It then retries the restore and reopens the database to verify the replacement.
3. Repeat with **Test published photo interruption → Stop app**, then reopen and choose **Verify** under that same item. Here the complete replacement file is already on disk when Journal closes, and the database still points to the original. Verification checks that both files exist before cleanup and that only the referenced photo remains afterward.
4. Each successful verification displays **Photo restore passed**.

| Interruption point | iPhone 17 Pro Max simulator | Pixel 8 emulator |
| --- | --- | --- |
| Halfway through copying the replacement | Passed | Passed |
| After publishing the replacement and before changing the entry | Passed | Passed |

All four runs confirmed a new app process on relaunch. Each recovered the original text, index and exact image bytes, cleaned up leftover files, and successfully restored the replacement on retry. The two host process-exit checks also passed. Phase 5 is estimated at **65%**, with weighted overall progress at **29.7%**. The next restore case is a backup with multiple attachments, including a photo referenced by two entries.

### Restoring two entries that share a photo · 2026-11-19

The Pixel 8 emulator and iPhone 17 Pro Max simulator each passed **Test shared photo recovery**. The development test uses two generated 1600 × 1200 PNGs. The first entry references both photos and the second references the first photo.

| Check | Result on both platforms |
| --- | --- |
| Stop the app after it writes the edited entry, then reopen it in a new process | Journal recovered the original entries, their date index, the order of each entry’s photos, and the exact bytes of both images. |
| Retry the edit and reopen the database | Removing the shared photo from the first entry preserved it for the second entry. |
| Remove the last reference to the shared photo | Cleanup removed that file and preserved the other photo. |

To repeat in a development build, choose **Test shared photo recovery → Arm**. At **Shared photo restore armed**, terminate Journal and reopen it. Choose **Test shared photo recovery → Verify**. A successful run displays **Shared photo restore passed**. A separate native test also verified that when one referenced photo fails authentication or content verification, cleanup preserves staged files. It checked that repeating successful cleanup preserves the surviving image.

Phase 5 is estimated at **67%** and weighted overall progress at **29.9%**. This check used encrypted photos already staged on each device. The next checkpoint is to export both entries and photos into one portable encrypted file and restore it on a fresh installation.

### Moving two entries and their photos to a fresh installation · 2026-11-19

The development backup contains two generated entries and two 1600 × 1200 PNGs. Both entries reference the first photo, so the archive stores that image once. On restore, Journal verifies the complete encrypted file and both image hashes before staging the photos. It rebuilds the entries and their date index in a new database, reopens it, and checks both entries, both image hashes, and the shared reference.

The host integration test copied only the backup, removed the source folder, restored, and then removed the backup before reopening the destination database. It also tried a truncated backup and a backup whose second photo had been altered and re-encrypted. Both attempts preserved the destination entries and photos. To repeat with the host binary built above, run:

```sh
JOURNAL_TRANSFER_HOST=/tmp/journal-transfer-host ./node_modules/.bin/jest --runInBand --coverage=false --testMatch '**/journalSharedPhotoTransfer.integration.ts'
```

The Pixel 8 emulator exported one 3,846,542-byte encrypted file. We copied only that file into a fresh iPhone 17 Pro Max simulator installation. Journal reopened the destination SQLCipher database and verified the entries, index, references and photo contents. Its **Transferred restore passed** alert displayed the same identifier as the Pixel export.

To repeat, choose **Transfer two photos → Export** on the source device's developer menu. Copy `journal-shared-transfer-test.bin` from the Android app cache to the iOS app's temporary directory, then choose **Transfer two photos → Restore** on iOS. Compare the identifier under **Transferred restore passed** with the identifier under **Test backup exported**.

Phase 5 is estimated at **69%** and weighted overall delivery at **30.1%**. The next development checkpoint is choosing a recovery secret and saving or selecting a backup through the device's file picker using test entries.

The developer menu uses generated entries and a fixed test recovery code. Customer backups require a user-controlled recovery secret, a supported storage provider, and export and restore controls in Account & Data.

### 2026-11-19 · Save and reopen a sample backup from Account & Data

In a development build, open **More → Account & Data → Local backup test**. Choose **Save sample backup**, keep the recovery code separately, confirm that you saved it, then choose a destination in Files. To practice recovery, choose **Restore sample backup**, enter the code and select the saved file. Success means Journal reopened a separate encrypted test database and verified both generated entries and both photos, including the photo shared by the entries.

Each export uses a fresh 128-bit recovery code. The native test covers correct, incorrect and malformed codes and confirms that a rejected code creates no staged photos. The component tests cover code acknowledgement, cancellation, retry, failure feedback and success. Both mobile debug builds, 19 bridge checks and three host photo integration tests passed.

On the Pixel 8 emulator, Journal reported “Sample backup saved” after Android Files wrote the file. The restore check entered the recovery code, selected that same file in Android Files, and verified two entries and two photos after reopening the encrypted test database. On the dedicated iPhone simulator, Journal saved a fresh sample through Files. The restore check entered its recovery code and selected the same file in Files → Recents. After reopening the encrypted test database, Journal reported “Restored and verified 2 sample entries and 2 photos.” Customer backups also need the production storage provider and a restore preview.

Phase 5 is estimated at **72%**, with weighted overall delivery at **30.4%**.

### 2026-11-19 · Confirm a sample restore before writing

Under **More → Account & Data → Local backup test**, choose **Restore sample backup**, enter the recovery code and pick the file. Journal verifies the sample and previews the two entries, two distinct photos and their combined size. **Cancel** discards the selection. **Confirm sample restore** restores that same backup into a separate, empty test journal and verifies the entries and photos after reopening it.

The preview holds one encrypted copy in memory. Each selection can be confirmed once. The native tests cover cancellation, replacement, incorrect recovery codes, selecting the same file again and removal of the original file after preview. Component tests cover leaving the screen and returning from the picker. The host integration test rejects a damaged photo before changing the test journal. The updated iOS simulator and Android Play debug builds both compiled successfully. On the dedicated iPhone simulator, selecting a generated file in Files displayed the expected preview. Confirm restored and verified both entries and photos after reopen. A second run verified that Cancel returned to the backup controls. The same native archive tests passed directly on the Pixel 8 with the Android build’s encryption library. On the Pixel 8, Android Files opened the sample backup and Journal previewed two entries and two photos (3.8 MB). Cancel returned to the backup controls. After the emulator restarted, selecting the same backup in Android Files and tapping Confirm sample restore restored both sample entries and both photos. Journal reopened its encrypted test database and verified the saved entries and photo digests.

Phase 5 is estimated at **73%**, with weighted overall delivery at **30.5%**. Customer backup still needs a production storage adapter and a preview that handles an existing journal, including duplicates and conflicts.

### 2026-11-19 · Compare a backup with existing local data

The development restore session can count which Journal-owned keys a full restore would add, match byte-for-byte, replace, or remove because they exist only on the device. The comparison takes the same exclusive lock as a restore and returns only counts. An unfinished recovery blocks comparison. Counts include settings and indexes. Showing a person which journal entries conflict and letting them keep both versions is still pending.

The focused executor, reopen and sample-screen tests passed on the development Mac (21 tests). The reopen diagnostic now checks that comparing a different value preserves the original. Phase 5 is estimated at **74%**, with weighted overall delivery at **30.6%**.

The subsequent Pixel 8 Files confirmation completes the sample preview checks on both platforms. Phase 5 is now estimated at **75%**, with weighted overall delivery at **30.7%**. The next increment is a user-facing comparison for restoring into a journal with existing entries.

### 2026-11-19 · Keep both versions of a sample entry

In **More → Account & Data → Local backup test**, open an encrypted sample file and select **Compare with an existing sample journal**. Journal shows the device and backup text for the same sample entry before asking for a decision. **Cancel** discards the preview. **Keep both and restore sample** retains the device entry at its original ID and restores the backup version at a new ID with its photos.

The exercise uses a separate database. After reopening, Journal checks both versions, an unrelated device entry, the second backup entry, the date index and both photo digests. Automated tests cover cancellation, a stale comparison and refusal to proceed if an unexpected device record would be removed. Both mobile debug builds compiled. A backup created by the previous Android fixture remained readable. Phase 5 is estimated at **76%** and weighted overall delivery at **30.8%**.

On the dedicated iPhone simulator, opening the sample in Files, comparing the two entries and choosing **Keep both** passed. After reopening the database, Journal verified all four entries and both photo digests. The comparison also checks the device's date index immediately before restore. A host regression test changes only that index after preview and verifies that **Keep both** refuses the restore and preserves every current database row. The Pixel 8 emulator also passed the Files walkthrough with a previously exported encrypted sample. After **Keep both**, Journal reopened its sample database and verified the device and backup versions, the two other entries, the date index and both photos. With both platform checks complete, Phase 5 is estimated at **77%** and weighted overall delivery at **30.9%**.

For customer restore, the planned default is to skip identical entries, add backup-only entries and preserve device-only entries. An older backup should preserve a provably newer device edit. When the versions cannot be ordered reliably, present the choice before writing. General conflict detection, repeated imports and production storage integration still need implementation.

### Reopening the same sample backup after Keep both

While the local backup test screen is open, restore the sample using **Keep both**. Then tap **Restore sample backup** and choose the same file with its recovery code. Journal recognizes it even if the file was renamed. It displays **You already restored this backup** before copying photos or writing journal entries. A different backup still opens for preview. Leaving the screen discards the practice database.

The native preview authenticates the file and hashes the manifest, which includes both photo hashes. The practice database saves the hash and the restored entries in the same SQLite transaction. The host integration test reopened that database, edited the imported copy, repeated the import and checked that every row was preserved. A simulated failure to save the receipt rolled back the first import and allowed a retry. Tests also cover the picker skipping the second photo import and opening a different backup normally. Customer journal integration, comparing different backup revisions and the production restore flow remain open.

The iPhone simulator and an isolated Pixel 8 emulator running Android 15 passed the Files walkthrough. On both, the first restore verified four entries and two photos after reopening the practice database. Selecting the same encrypted file again displayed the duplicate-backup message. The usual Pixel 8 emulator's package service failed during installation, so Android verification used a fresh test installation with onboarding marked complete.

### Reviewing a revised practice backup

After restoring the original sample with **Keep both**, select the matching revised file from Files during the same practice session. The screen displays the current device text beside the revised backup text. **Keep my device version** dismisses the review. **Keep both versions** creates one additional entry that references the two existing photos. A receipt in the same transaction prevents a repeated import. If the device entry changes during review, the screen asks the user to select the file again.

The native test helper can generate a matching pair for mobile testing. Run the compiled helper with `--write-mobile-revision-pair <new-directory>`. It creates `Original.bin` and `Revised.bin` and prints their shared practice recovery code. Both files contain generated entries and photos. The regular sample exporter still produces the original version.

The host integration test used both encrypted files and a temporary SQLite database. It verified the live device text, rejection of a different original, rollback after an interrupted write, preservation of unrelated files, and exactly five entries and two referenced photos after confirmation and reopen. Automated screen tests cover both decisions. The Android debug build and the iPhone simulator build succeeded. The dedicated iPhone simulator and an isolated Android 15 Pixel 8 emulator both passed the Files walkthrough. On each platform, the screen displayed the two versions, preserved the device version on request, added the revised copy on confirmation, and recognized the same revised file when selected again. This exercise covers one changed text entry with identical photos. The next checkpoint extends this exercise to revisions that change a photo.

### Keeping both versions when a practice photo changes

The development Files flow recognises two more encrypted samples. One adds a third photo to the first entry. The other replaces its second photo. Both refer to the original backup and preserve the photo shared with the second entry. The preview identifies the change before asking what to keep. Choosing the device version discards the selection. Choosing both creates a separate entry and verifies the new photo before committing the entry, index and import receipt together.

The Mac integration test uses actual encrypted files and a temporary SQLite database. It checks both variants after reopen, verifies that existing records retain their original bytes and references, and repeats each import. An interrupted database commit may leave one encrypted photo in practice storage. A retry verifies and reuses it. The test also corrupts that staged file and confirms that the restore rejects it without changing the records. Both mobile development builds compiled. On the dedicated iPhone simulator and an isolated Android 15 Pixel 8 emulator, Files opened each encrypted revision. Both screens accepted both choices and recognised each completed revision on repeat selection. Android used software graphics after the host graphics configuration left the app window invisible. The release app still needs its customer-data restore integration.

### Reconnecting photos across a journal backup

The Files practice import now uses the archive path in each journal photo block to find its staged image. Several blocks can reference one photo, even when their block IDs differ. The resolver checks that each image appears in its owning entry and that every staged file matches one inventory item. Unit tests cover 300 generated entries, reordered image inventories, entries without images, and invalid or missing references.

The native Files exercise still imports known samples. The native reader now returns the complete photo list for each supported practice archive. It reopens each encrypted image and verifies the bytes before returning its asset ID, local filename, size and digest. The same list drives the restore for original and revised samples. Repeated restores reuse verified images.

The host integration test restored samples containing two and three images, reversed the order of the returned list, and checked that missing, duplicate and mismatched evidence left the database untouched. The native reader now also accepts a practice format that carries its own entry manifest and image list. Preview checks the manifest against the authenticated image bytes before showing counts. Confirm uses the encrypted copy retained during preview. A host integration test previewed an empty journal and restored both a text-only journal and a 300-entry journal with three shared photos into fresh local test databases. It reopened each restored database and checked the entries and indexes. It also checked rejection of incomplete frames, trailing bytes and mismatched image hashes. The iOS simulator and Android Play debug builds compiled.

The development screen now offers **Save a custom sample**. The tester chooses 0–300 generated entries, saves the recovery code, then chooses a location in Files. An empty or one-entry sample contains no photos. Larger samples contain three photos and can share an image across entries. The native writer and reader passed round-trip tests at 0, 1, 2, 37 and 300 entries, including rejection of an incorrect recovery code. The dedicated iPhone simulator and an isolated Android 15 Pixel 8 emulator each saved a 300-entry backup through Files, selected the same file, previewed 300 entries and three photos, and confirmed the restore. Journal reopened the practice database and verified the restored records and photos on both platforms. The Android test used a fresh installation with onboarding marked complete.

The development backup screen now offers **Check local journal counts**. On request it builds the V1 backup in memory from the device’s local records. It shows counts for active journal entries, reflections and prayers, photo references in those records’ journal blocks, and validation warnings. A reference count says how many times entries mention a photo. Checking the underlying image files is a separate step.

The reader enumerates supported record keys, reads up to 128 at a time, and requires two consecutive observations with matching keys and contents plus a final key-list check. It retries a changing journal and reports an incomplete read if the observations still differ. It rejects unreadable canonical records without logging their text. Automated tests cover 300 entries, a saved edit between reads, a late insertion, an incomplete batch, damaged records, tombstones and sensitive keys. All 62 focused tests passed. The counts action also passed through the development screen on the dedicated iPhone simulator and an isolated Android 15 Pixel 8. This is a read-only preview. A production export also needs a consistent view of photo files and any journal edits that occur while preparing the archive.

Next, resolve each photo reference to a verified local image and carry the entries and images into the encrypted file writer. Test reopening that file with the recovery code on both platforms before enabling customer backup.

### Local photo availability on iOS and Android — 2026-11-19

**Check local journal counts** now opens referenced photo files from the app’s image-picker folder and reads them in bounded chunks. It checks the file signature against its JPEG or PNG extension. A shared reference counts toward each entry’s reference total, while its file is read once. The screen reports counts of readable, missing, unsupported, unreadable and oversized files. This development check reads active journal, reflection and prayer blocks. Other reference types, including photo-library identifiers and encrypted restore-object paths, still need their own readers.

The native reader passed fixture checks on the Pixel 8 emulator and the dedicated iPhone simulator, including a missing image, a symbolic link, a mismatched file signature and a file over budget. The eight backup test suites passed (63 tests). File readability is a point-in-time result. The next export increment needs to capture the exact bytes being encrypted, associate them with their entries, and reopen the resulting archive with the recovery code. Customer export remains pending.

### Capturing the photo referenced by a backup entry

The development screen can prepare an in-memory list of photos from journal, reflection, and prayer blocks. It reads each distinct picker file once and records its byte length and SHA-256 digest. Entries that share a photo use the same portable file reference. A missing or changed file prevents a successful check.

The practice writer reads generated photos from disk, compares the captured bytes with their expected digests, and uses those same bytes in the encrypted archive. Tests on the iPhone simulator and Pixel emulator reopened the practice archive, detected a same-size replacement and a missing image, and verified that a failed save preserved the previous archive. The native reader also rejected a replacement during an open read. Eight JavaScript backup suites passed with 65 tests.

The next step is to connect the real entry snapshot and approved photo sources to an encrypted writer, then reopen that file on each platform before enabling customer exports. The current Files export still uses generated practice entries.

## Primary references checked on 2026-11-03

- [Apple App Review Guidelines, payments/subscriptions](https://developer.apple.com/app-store/review/guidelines/): mobile subscription checkout baseline and subscription disclosures. Regional alternative-payment programs require separate review if later used.
- [Google Play Payments policy explanation](https://support.google.com/googleplay/android-developer/answer/10281818): digital cloud services billing baseline.
- [RevenueCat customer identity](https://www.revenuecat.com/docs/customers/identifying-customers): stable account IDs, cross-platform entitlement identity, and restore/transfer considerations.
- [RevenueCat webhook events](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields): lifecycle integration reference.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): object authorization and service-key bypass behavior.
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups): database recovery scope excludes stored object bytes.
- [OWASP MASVS source](https://github.com/OWASP/masvs/blob/master/OWASP_MASVS.yaml): applicable mobile security verification controls; using this reference is not certification.

