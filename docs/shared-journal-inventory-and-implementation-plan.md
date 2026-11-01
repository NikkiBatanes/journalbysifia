# Shared Journal inventory and implementation plan

Status: Phase 0 code inventory and product contract started on 2026-10-30.

## Product rules already agreed

1. Every record saved by siFia should be visible in Journal by siFia when the same account is connected and Journal has a compatible renderer.
2. Records supported by both apps have one logical identity. Create, base-field edit, and deletion synchronize in both directions.
3. A siFia artifact that Journal cannot safely edit is display-only in Journal, with an `Open in siFia` fallback for unsupported interactions.
4. Journal-only records never appear in siFia.
5. Journal-only extensions on a shared record do not expand the siFia schema. For example, note text syncs to siFia while a Journal photo remains a child extension.
6. Free siFia account sync and paid Journal Cloud are different capabilities. Existing siFia-supported data stays free. Journal Cloud covers automatic remote persistence for Journal-only records, extensions, and media.
7. A free encrypted manual export remains available. Data that only remains inside the app is not described as backed up.
8. Reviews and routine state orchestrate or reference canonical records. They do not replace or copy the canonical authored content they point to.

The machine-readable version of these rules is `src/compatibility/sharedJournalCapabilityContract.ts`.

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
| Routine state | Unsupported as a shared record | Local references | Journal-only orchestration | Follows referenced records |
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

## Implementation sequence

| Phase | Deliverable | Weight | Readiness at inventory start |
| --- | --- | ---: | ---: |
| 0 | Approved inventory, sanitized fixtures, compatibility matrix | 8% | 45% |
| 1 | Versioned shared contract package consumed by both apps | 7% | 20% |
| 2 | One-tap siFia connection and distinct application links | 10% | 15% |
| 3 | V2 canonical schema, RLS, change feed, and migration ledger | 13% | 10% |
| 4 | Encrypted transactional local store and account namespaces | 12% | 20% |
| 5 | Bidirectional outbox/cursor sync and conflict preservation | 18% | 10% |
| 6 | Journal extensions and durable encrypted media vault | 12% | 25% |
| 7 | Encrypted file export, validation, and transactional restore | 8% | 20% |
| 8 | `journal_cloud` monthly/annual entitlement and automatic vault sync | 7% | 10% |
| 9 | Deletion, operational recovery, security testing, and staged rollout | 5% | 5% |

Overall groundwork at this point is approximately 19%; production-ready selective sync is not implemented.

## Phase gates

### Gate 0: inventory approved

- Every siFia Moments source has a storage owner and synthetic fixture.
- Every Journal creation surface has a capability row.
- Product owner approves read/write, display-only, or Journal-only classification.
- Live legacy RLS and schema have been reviewed.

### Gate 1: shared contract stable

- Contract is published as one versioned dependency rather than copied definitions.
- Both apps pass the same contract fixture tests.
- Unknown variants are preserved and displayed safely rather than discarded.

### Gate 2: shared sync safe for internal users

- Create, update, delete, reinstall, offline retry, and account switching pass on iOS and Android.
- No shared record is duplicated when Journal connects to an existing siFia account.
- Conflicting journal writing is preserved as a recoverable copy.
- Journal-only blocks never appear in legacy siFia payloads.

### Gate 3: backup and cloud launch

- Manual encrypted export and restore are proven before selling automatic backup.
- Media bytes, not only local URI strings, are included and checksummed.
- Store entitlement changes, refunds, grace periods, restore purchases, and account changes are tested.
- Operational recovery covers both database rows and encrypted object storage.

