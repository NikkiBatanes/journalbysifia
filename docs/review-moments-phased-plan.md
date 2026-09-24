**Review flows in Moments — phased implementation plan**

Prepared September 23, 2026 for Journal by siFia. Baseline: working tree based on `de266845`, including existing uncommitted review work. This document is a plan; no application implementation was changed during this investigation.

The outcome: everything a person writes in a weekly, monthly, quarterly, Year End, or Begin Year review is saved, easy to find in Moments, and presented with the same coherent grouping as Morning and Evening. Each flow can be reopened, continued, and read in full.

The proposed presentation is separate, linked **End** and **Begin** moments. This is a planning assumption, pending the user's presentation preference. Weekly, monthly, and quarterly can remain one continuous guided journey with a clear stopping point between the two parts. Year End and Begin Year retain their separate identities. A combined-card preference would change presentation, not the answer ownership or save guarantees below.

**What the user should experience**

| Cadence | End flow / saved heading | Begin flow / saved heading | Relationship |
| --- | --- | --- | --- |
| Daily, existing | Evening | Morning | Preserve existing daily routines and their content. |
| Weekly | End the Week | Begin the Week | Reflection covers week W; planning covers W+1, with explicit dates for both. |
| Monthly | End the Month | Begin the Month | Reflection covers month M; planning covers M+1. |
| Quarterly | End the Quarter | Begin the Quarter | Reflection covers calendar quarter Q; planning covers Q+1. “Season” may remain in prompts. |
| Yearly | End the Year | Begin the Year | Year End Y links to Begin Year Y+1; each is independently available and saved. |

For example, a weekly review written September 21 can produce “End the Week · September 14–20” and “Begin the Week · September 21–27.” All the feelings, check-ins, gratitude, prayers, priorities, and other written responses belong to the appropriate part. The cards provide readable sections; opening them exposes the complete saved writing.

Proposed behavior:

- Create a visible moment after the first meaningful persisted answer or remembered selection. Mark unfinished work “In progress”; never require completion to preserve or discover writing. Merely visiting a cover creates no empty timeline card.
- Finishing End offers “Begin the next week/month/quarter” and “Done for now.” Finishing End does not complete an unanswered Begin. Begin can be started independently without forcing a retrospective.
- Show the period, status, and an appropriate Read / Continue / Edit action. Editing updates the same moment identity. Keep every draft accessible in Reviews.
- Use the day of first meaningful save as the proposed timeline date, frozen per phase. Display the reviewed/planned period separately. This makes early planning visible immediately under the existing “Until Today” filter and prevents later edits moving cards between dates. Period-based discovery uses explicit period metadata. Confirm this date convention in Phase 1; it is a deliberate difference from the existing weekly-gratitude period-end convention.
- Use one top-level Reviews filter with cadence and End/Begin choices, rather than eight additional top-level pills. Preserve current filter combination semantics and show a clear empty state.
- Retain optional questions. A completed phase can contain selected memories without writing; an explicitly completed empty phase may show a small completion card, with no invented answer text.
- Keep the app's spiritual purpose: reflection and faithful attention, with optional carry-forward into Today. No automatic task creation or scheduling from prose.

**Inspection scope and baseline**

The source review covered the review editor, reader, history, storage, period calculations, eligibility, reminders, Today, Moments timeline/rendering/filtering/refresh, Morning/Evening presentation, remembered-source relationships, weekly gratitude/prayer outputs, navigation, review rhythm counts, backup contract/inventory, and the active authentication provider. The sibling `siFia` app was checked to identify the appropriate project; this implementation plan targets `JournalBySiFia`.

This is an audit of the affected application paths, not a claim that every app screen, native platform, deployed database, or production policy has been verified. Some files were already under active modification; recheck the implementation baseline when work starts.

| Check performed | Result | Meaning / limit |
| --- | --- | --- |
| Existing targeted Jest baseline, 21 suites | 20 suites passed; 1 failed. 100 tests passed; 1 failed. | Covers review storage, stages, periods, eligibility/history/capture, Moments, weekly outputs, backup contract, Today hook/card, and sticky-header behavior. It does not test the proposed feature. |
| Existing failing test | `reviewCaptureService.test.ts:110` expects “Guided reflection”; code returns “Guided prompt.” | Reconcile intended copy and assertion before requiring a green baseline. No failing test was edited to hide this. |
| TypeScript | `./node_modules/.bin/tsc --noEmit` passed. | Compilation only; does not prove reader completeness or correct dates. |
| Device and native build verification | Not performed in this planning task. | iOS/Android interaction, accessibility, notifications, and interruption behavior remain implementation acceptance work. |
| Production sync/security assessment | Not performed. | Do not infer a working review cloud path, encryption, or account isolation from other app features. |

**App impact and confirmed gaps**

“Confirmed” below means visible in inspected source or existing test results. “Risk” means the implementation permits a concerning path that still needs a reproduction test. Priorities: P0 protects writing or ownership; P1 ensures correct and discoverable behavior; P2 improves presentation and scale.

| Area | Finding / evidence | Required outcome | Priority / phase |
| --- | --- | --- | --- |
| Review model | Confirmed: five legacy types, one answer map and one draft/completed status; no explicit short-cadence End/Begin states. [Storage](../src/storage/reviewStorage.ts) | Add explicit phase state and source/target periods with backward-compatible reads. | P0 · 1–2 |
| Moments ingestion | Confirmed: timeline kinds and source union exclude reviews; loader reads journals/reflections/prayers. [Timeline](../src/services/momentTimelineService.ts) | Add review projections and a review source identity. Both draft and completed writing become discoverable. | P1 · 3 |
| Morning/Evening precedent | Confirmed: grouped sections resolve existing canonical content. [Routine summary](../src/components/moments/RoutineMomentSummary.tsx) | Reuse the presentation approach; provide a review-specific renderer and reader contract. | P1 · 3 |
| Reader completeness | Confirmed: reader handles questions/priorities, but skips weekly feelings and life-check-in stages, including custom feelings. [Reader](../src/screens/ReviewReaderScreen.tsx) | Render all supported answer types, custom answers, and preserved legacy answers. | P0 · 2–3 |
| Reader cadence bug | Confirmed: every stage with key `god` takes a branch reading weekly `answers.god`, bypassing `god_month`, `god_quarter`, and `god_year`. | Scope weekly formatting correctly and test each cadence's exact answer key. | P0 · 2 |
| Save ordering | Confirmed: updates serialize storage writes. Risk: editor patches spread a captured review object; ordering alone does not merge concurrent answer/bookmark/completion changes. [Editor](../src/screens/ReviewScreen.tsx) | Serialize read-modify-write operations, or an equivalent revisioned reducer; flush before completing or exiting. | P0 · 2 |
| Creation and indexes | Confirmed: get-or-create and per-type index read/write are not covered by the update queue; record and index writes are separate. | One record per business identity, protected concurrent create/delete, recoverable indexes after interrupted writes. | P0 · 2 |
| Save acknowledgement | Confirmed: answer saves are invoked without a user-facing save/error state; completion failure resets a ref without explaining failure. | “Saved” must follow durable persistence; show retryable errors and retain unsaved text. | P0 · 2 |
| Draft recovery | Confirmed: history uses `visible.find(...)` for drafts and lists completed reviews separately, leaving older drafts unlisted. [History](../src/screens/PastReviewsScreen.tsx) | List every draft and resume its saved stage/phase. Distinguish Year End from Begin Year in the yearly tab. | P1 · 2, 7 |
| Period/reminder agreement | Confirmed: period service selects closed prior periods; notification service still schedules before closure. [Periods](../src/services/reviewPeriodService.ts), [reminders](../src/services/reviewNotificationService.ts) | One availability policy shared by dashboard, editor, manual entry, and notifications. | P1 · 1, 7 |
| Written project rules | Confirmed: AGENTS.md's availability table describes earlier pre-close windows that differ from current code and closure tests. | Resolve policy and update project guidance when implementing; avoid preserving contradictory behavior. | P1 · 1 |
| Notification integration | No production call sites found for the review scheduler during this inspection. Scheduling returns early for disabled cadences without cancelling a prior request. | Wire lifecycle, cancellation/rescheduling, tap routing, and exact period identity; test on both platforms. | P1 · 7 |
| Today / active plan | Confirmed: Today chooses a weekly review whose reviewed dates match the displayed week, although its Look Ahead answers concern the next week. [Today](../src/screens/TodayScreen.tsx) | Select Begin content by its target period. Test current, prior, and future display dates. | P1 · 3, 7 |
| Year carry-forward | Confirmed: Begin Year asks for Year End references but filters their selected dates against the new year's range. [Memory service](../src/services/reviewMemoryService.ts) | Resolve the linked previous Year End explicitly; preserve the provenance of selected items and carry text. | P1 · 6 |
| New-user eligibility | Confirmed: no canonical journal history means no dashboard review; periods starting before first activity are excluded. [Eligibility](../src/services/reviewEligibilityService.ts) | Allow manual Begin and partial first-period reflection. Do not require a full year of history to begin a year. | P1 · 1, 7 |
| Gratitude and prayer integration | Confirmed: weekly answers also create canonical gratitude and Open Prayer records, with identity links. [Gratitude](../src/services/weeklyGratitudeService.ts), [prayer](../src/services/weeklyReviewPrayerService.ts) | Define ownership and edit/delete propagation. Avoid duplicate standalone and grouped rendering of the same output. | P0 · 2–3 |
| Search / filters / refresh | Confirmed: no review cadence/phase filters or review source in search; Moments listens mainly to existing content events. [Filters](../src/services/momentFilterService.ts), [screen](../src/screens/MomentsScreen.tsx) | Search all written answers, include reviews in filter semantics, refresh after durable changes and on focus. | P1 · 3, 7 |
| List stability | Confirmed: a recent sticky-header fix protects date grouping. [Investigation](moments-sticky-header-scroll-fix.md) | Preserve the adapter and stable list identity while adding review cards and expanding sections. | P1 · 3, 9 |
| Navigation / rhythm counts | Confirmed: review screens use loosely typed parameters; completion feeds review rhythm counts. [Navigation](../src/navigation/JournalStackNavigator.tsx), [rhythms](../src/services/faithfulRhythmService.ts) | Address records by ID + phase; validate routes and avoid counting two card projections as two completed reviews. | P1 · 3, 7 |
| Backup / restore | Confirmed: reviews are inventoried and a V1 envelope is validated, but contract explicitly defers persistent export and restore; no migrations exist. [Contract](../src/services/journalBackupContract.ts) | Implement and exercise export, version migration, restore, recovery, and reference validation. | P0 · 8 |
| Local ownership / privacy | Confirmed: review keys are not account scoped; active sign-out path does not clear them. Review bodies use direct AsyncStorage. [Active auth](../src/context/IndustryStandardAuthContext.tsx) | Decide device-vault versus account ownership before cloud features; prevent implicit reassignment. Plan encrypted storage and backups for sensitive writing. | P0 · 1, 8 |
| Cloud and export | No review-specific cloud repository or reader export path identified in inspected code. | Treat cloud and user-facing exports as explicit work, not inherited capability. Recovery backup is required in Phase 8; cloud remains a separate scope decision. | P0/P1 · 8, optional 10 |

**Calendar and availability decisions**

Recommended baseline: preserve the current closed-period calculation, then make every entry point agree. This differs from the older pre-close schedule in AGENTS.md and the existing notification service. If early reflection is desired, explicitly call it an in-progress period and re-collate on completion; do not silently label a partial period as finished.

| Rule | Proposed behavior | Acceptance example |
| --- | --- | --- |
| Week boundaries | Profile `weekStart` determines new weekly boundaries. Saved explicit dates never change when the preference changes. | Monday-start: September 14–20 is available September 21. |
| Month boundaries | Calendar months; prior month closes at the start of the next month. | September End becomes available October 1; its Begin part targets October. |
| Quarter boundaries | Calendar quarters, not fiscal quarters, unless separately requested. | Q3 End covers July 1–September 30; Begin targets October 1–December 31. |
| Year boundaries | Year End covers the prior Jan–Dec year; Begin Year covers the current year. | January 1, 2027 can offer End 2026 and Begin 2027 independently. |
| Dashboard windows | Preserve one highest-priority review with “Also ready”; weekly/monthly/quarterly replace with the newest eligible period. Proposed annual promotion remains Jan 1–14. | Annual content remains readable and manually startable from Reviews after January 14. |
| Manual access | Start or resume historical End and current/next Begin from Reviews, including new users without prior captured content. | A new install in September can Begin the Week immediately. |
| Early Begin | Planning may be written before the target period starts. It is immediately saved and visible, labelled with the future target dates. | Begin October written September 28 remains visible that day. |
| Late reflection | A historical End links to the period immediately following it, not whatever period happens to be current today. | Late End August on October 5 still links to Begin September. Offer a separate route to Begin October. |
| Timezone | Persist calendar dates and creation timezone separately from UTC audit timestamps. Recompute reminders for travel; never reinterpret saved period dates. | Midnight, daylight-saving changes, and Manila-to-US travel do not move an existing review into a different period. |
| Resume | Availability controls promotion, not access to saved writing. | An old draft is still editable after newer periods become eligible. |

**Saving and presentation architecture**

Reviews continue to orchestrate references to original journal, Scripture, reflection, session-note, and prayer records. The review owns the answers written in the review and its “Remember this” selections. It does not take ownership of the original source records.

One shared flow definition should drive the editor, saved reader, Moment sections, search text, meaningful-answer counts, and export. Each prompt definition needs a stable answer identifier, cadence, End/Begin phase, presentation type, label, and template version. Legacy unknown answers remain preserved and readable under additional saved responses; a prompt change must not make older writing disappear.

Conceptual path: **Editor → review repository → saved review → Moments / Reader / History / Today**. Existing gratitude and prayer integrations become linked operations with retryable reconciliation; they must not create a second competing review document.

| Contract | Proposed implementation direction | Invariant |
| --- | --- | --- |
| Storage evolution | Extend the existing review record additively behind a repository/adapter; retain legacy five-type reads during migration. Add schema/template versions, explicit phase metadata, and ownership scope. | No destructive rewrite or new database is required simply to display reviews. Transactional storage is a separate measured decision in Phase 2. |
| Phase metadata | End and Begin each have `not_started / draft / completed`, a stable resume-stage key, first meaningful save date, update revision, and completion timestamp. Short cadences keep one parent review; yearly records link explicitly. | Completing one phase cannot complete, clear, or hide the other. Legacy top-level status remains a compatibility value, with readers moved to phase state. |
| Period identity | Preserve reviewed bounds; store explicit Begin target bounds. Use a scoped business key for get-or-create and `reviewId + phase` for timeline identity. | Double tap, repeated navigation, restore, and retry cannot create duplicate flows. |
| Standalone Begin | Resolve/create the same short-cadence parent using its source/target period pair, leaving End `not_started`. Yearly uses its existing Begin Year record. | Starting Begin independently and later starting End converge on the same answers. |
| Save operations | Merge patches against the latest persisted revision under one repository serialization boundary. Protect create, update, complete, delete, and index changes. | A bookmark save or completion cannot overwrite a newer text answer. |
| Acknowledgement | Distinguish Saving, Saved on this device, and Save failed. Await the latest revision before showing successful completion. | Once “Saved” is shown, restarting offline retrieves that revision. Immediate termination before a save completes cannot be promised recoverable. |
| Interruption handling | Persist promptly, drain pending changes on blur/back/background when the OS allows, and resume from a durable stage. Recover or rebuild missing indexes. | An interrupted completion never produces a completed card with missing acknowledged answers. |
| Side effects | Persist a durable reconciliation intent for linked prayer/gratitude updates and apply idempotently; retry after restart. Specify bidirectional editing policy before coding. | Review success must not silently mask a failed secondary write; a reader opening alone must not overwrite an independently edited prayer. |
| Timeline | Add `review` as a source and a review moment kind with cadence/phase metadata. Build view models from the saved record; no copied timeline answer store. | One stable projection per meaningful phase; every surface resolves the same record revision. |
| Deletion | Delete/undo the selected phase with clear scope; retain shared parent while its other phase exists. Remove projections, references owned by that phase, and search results. | Source journal entries and independently valuable prayers are not cascade-deleted by deleting a review. Retention for existing prayer snapshots must also be explicit. |
| Legacy mapping | Weekly/monthly/quarterly map their known answer keys around the transition to End/Begin. Year End maps to End; Begin Year to Begin. Preserve IDs, dates, raw answers, and unrecognized keys. | No invented responses or duplicate canonical entries. Legacy phase completion is derived conservatively from whole-review status and meaningful content. |
| Legacy dates | Use a documented, frozen fallback for first-save timeline dates where no local date was recorded, and retain original timestamps. | Do not claim historical timezone precision the old record did not capture. |

Use a review-specific group component with the Morning/Evening spacing and visual language. Keep period headings visible, provide accessible expand/collapse or Read controls for long writing, and virtualize large collections. Do not render every captured source in full inside every yearly card.

**Answer coverage required for “everything is saved”**

| Flow | Required saved sections |
| --- | --- |
| Weekly End | `week_feelings`, custom feeling, all seven `week_check_in_*` fields, remembered references, `notice` plus every `weekly_gratitude_*` response, God's faithfulness selections/custom response, `prayer`, saved prayer-event snapshot where present. |
| Weekly Begin | Three priorities, `dont_forget`, `people`, `prayer_ahead`, `rest`, `watch_for`, `faithful_step`, and explicitly selected carried references. |
| Monthly End | Remember, notice, formation, prayer, God’s faithfulness, and remembered references. Legacy release answers remain readable. |
| Monthly Begin | Three next-month priorities, attention, continue, simplify/stop, people, rhythm, and prayer. |
| Quarterly End | Season name, patterns, growth, faithfulness, prayer, release, continue, and remembered references. |
| Quarterly Begin | Three quarter priorities, less attention, decision, relationship, rhythm, postponing, and faithfulness. |
| Year End | Remember, faithfulness, Scripture, prayer, formation, hard things, gratitude, release, carry, closing prayer, and remembered references. |
| Begin Year | Selected carry-forward, posture, carry, Scripture, formation, ordinary-day faithfulness, attention, three priorities, rhythms, people, prayer, surrender, and end-of-year faithfulness. |
| All legacy / future versions | Unknown populated fields retained, migrations preserve structured/list values, and reader/search/export use equivalent coverage. Unknown internal metadata must not be displayed as if it were an answer. |

The phase split is assigned explicitly in prompt metadata, not guessed from labels such as `god`, `prayer`, or `continue`, which repeat across cadences.

**Phased delivery and acceptance gates**

Only Phase 0's scoped inspection and baseline checks have been performed. Every implementation phase below is pending. Dependencies define the sequence; time estimates should follow Phase 1 once the ownership and calendar choices are fixed.

| Phase | Scope and deliverable | Depends on | Acceptance gate | Status |
| --- | --- | --- | --- | --- |
| 0 · Baseline | Record affected paths, existing work, confirmed gaps, targeted tests, and compile result. | — | Findings distinguish code evidence from runtime checks still required; baseline failure documented. | Inspection complete within stated scope |
| 1 · Product and data contract | Finalize paired/combined presentation, timeline date, availability, ownership, phase states, legacy mapping, source-output ownership, and deletion semantics. Produce flow/state tables and sample saved cards for all eight flow headings. | 0 | Each current answer key has a destination; End/Begin date examples and independent-entry cases are unambiguous. | Pending |
| 2 · Reliable repository and complete reader | Add versioned phase metadata/adapter, patch merging, create/index protection, save/error status, completion flush, draft recovery, complete answer formatting, and legacy compatibility. Fix the reader omissions and cadence bug. | 1 | Fault-injection tests preserve every acknowledged answer; concurrent edits/complete/bookmark do not regress data; all legacy populated fields remain readable. Reconcile baseline copy failure. | Pending |
| 3 · Weekly end-to-end implementation | Weekly End/Begin grouped Moments, start/continue/read/edit navigation, linked gratitude/prayer rules, immediate refresh, search/filter support, explicit Begin dates, and Today weekly selection. | 2 | Write all weekly answer types → exit → relaunch offline → read identical content in Moments and Reviews. Complete End only, start Begin independently, edit either, and recover an old draft without duplicates. | Pending |
| 4 · Monthly | Configure monthly phases on the shared engine; map all responses and selected weekly memories. | 3 | February/leap year and December rollover pass; `god_month` is visible; monthly planning targets the next month and supports late reviews. | Pending |
| 5 · Quarterly | Configure quarterly phases, remembered monthly material, and three-month target periods. | 4 | Every quarter boundary and Q4→Q1 passes; `god_quarter` is visible; no accidental fiscal-quarter interpretation or hidden populated fields. | Pending |
| 6 · Year End and Begin Year | Separate annual identities, explicit year link, previous-year carry selection and text, manual start, incomplete-year support. | 5 | End 2026 and Begin 2027 remain distinct, work without each other, carry the intended prior-year material, and preserve all writing after January 14. | Pending |
| 7 · App-wide integration | Finish Today/hierarchy, all-draft History, Settings, notifications/tap routing, new-user access, typed navigation, source deletion handling, and review rhythm counting. | 3–6 | All entry points select the same identity/period; reminders never open the wrong period; disabling cancels reminders; two phase cards do not double a review count. | Pending |
| 8 · Recovery and privacy | Working versioned backup/export and restore, ownership isolation, storage protection, migration validation/recovery, log redaction, and deletion/retention policy. | 2–7 | Restore representative legacy/new data onto a clean test install with IDs/answers/references intact; corrupt/interrupted restore cannot destroy the current vault; account changes cannot silently take ownership. | Pending |
| 9 · Release qualification | Cross-platform device tests, accessibility, long histories, performance measurements, release flag, telemetry, migration and rollback rehearsal. | 3–8 | Critical scenario matrix below passes; no unresolved data-loss, date, ownership, or navigation blockers; release evidence includes native builds and device results. | Pending |
| 10 · Optional cloud continuity | If cross-device review sync is in product scope: authenticated ownership, scoped uniqueness, per-operation access policies, durable outbox, conflict retention, tombstones, and migration. | Ownership contract + 8 | Offline edits on two devices, simultaneous edits, delete/edit conflict, retries and account switch preserve both legitimate versions; unauthorized reads/writes denied. | Separate scope; not required just to add Moments |

Weekly is the first usable implementation because it exercises the richest current answers and both linked output types. Reuse its engine for the other cadences; keep cadence copy and mappings as configuration instead of copying whole screens.

**Legacy rollout and recovery checklist**

| Step | Required behavior |
| --- | --- |
| Inventory | Count saved reviews and populated answer keys by legacy type; identify duplicate periods, orphaned index records, and unresolved references without logging writing. |
| Compatibility first | Introduce an adapter so existing reviews can render before any destructive transformation. Preserve unknown fields and original IDs. |
| Read-only mapping preview | Compare old and proposed phase mappings, periods, and reference counts against fixture expectations. Mark ambiguous records for review rather than guessing. |
| Durable migration | If persistence must change, version each record and use a recovery marker/checkpoint. Avoid an unprotected application-wide rewrite on startup. |
| Repeatability | Restart or rerun migration safely; assert one logical flow per identity and unchanged answer bodies. Never delete duplicate records until all distinct writing is retained or explicitly resolved. |
| Recovery | Stage a restore rollback snapshot before replacing owned stores; reject malformed/newer unsupported formats before mutation. Rebuild indexes from records and validate source links. |
| Rollback | Disable new presentation without removing saved data. Retain the compatible reader for new phase metadata; test supported-version behavior rather than assuming an old binary understands it. |

**Full affected-app acceptance matrix**

All rows are pending feature implementation and device verification. Automated tests should exercise outcomes, not merely assert source strings or mirror implementation branches.

| Check | Scenarios | Pass condition |
| --- | --- | --- |
| Answer completeness | Every answer type in all eight flows; multi-select, custom text, repeated gratitude, multiline/emoji/non-Latin text, very long writing, legacy keys. | Editor, reader, Moments, search, and recovery backup agree on all populated answers; previews may shorten text only with a route to the full value. |
| Autosave | Rapid typing, concurrent bookmark, immediate Next/Close, background, app termination before/after acknowledgement, write rejection, storage full. | No acknowledged writing is lost. Unsaved state is visible; retry saves the correct latest revision. |
| Identity | Double start, repeated completion, duplicate period records, two overlapping navigation entries, retry after restart. | One flow identity; duplicate conflicts retain all distinct user writing. |
| Phase lifecycle | End only, Begin only, both, empty visit, explicit skip, revise completed work, clear an answer. | Correct phase status and no artificial completion of the other part. |
| Recovery navigation | Multiple old drafts per cadence, reopen via card/history/dashboard, invalid or missing record, deleted source, Back/Android hardware Back. | Every draft is discoverable; correct phase/stage resumes; missing content gets an informative state. |
| Calendar | All week starts, month lengths, leap February, Q4→Q1, Dec→Jan, late review, early Begin, timezone travel, DST. | Stored source/target periods remain correct and stable across settings/time changes. |
| Availability / new install | First activity midperiod, no history, disabled cadence, simultaneous annual/quarterly/monthly/weekly availability. | Manual Begin works; dashboard priority is consistent; disabled reminders stay cancelled. |
| Today / Morning | Begin week/quarter/year active now, previous/future display date, multiple eligible intentions. | Select by target period and user choice; no wrong-week priorities or automatic task creation. |
| Moments filters | Review cadence + phase, date range, upcoming, planning, remembered, search + filters, clear/reset. | Matching is consistent and every saved phase can be found. Reviews do not appear in Heart Journal solely because they are non-prayer content. |
| Source relationships | Delete/edit a remembered journal or prayer; edit prayer outside review; delete review phase; undo. | No source cascade deletion, no silent overwrite, and graceful missing-source placeholders; snapshot behavior follows the retention contract. |
| Existing daily flows | Morning, Evening, Heart Journal, Bible Study, Scripture notes, session notes, prayers, gratitude, wins, and planning. | Their creation, editing, filters, and counts continue to work. |
| Long timeline | Proposed fixture: five years of daily activity and at least 500 review records, long annual answers, repeated expand/collapse and new saves. | No duplicate cards or date-header loops; stable scroll; measured performance meets budgets below. |
| Accessibility / device UI | VoiceOver, TalkBack, large text, small phone, tablet, reduced motion, keyboard, safe areas, supported themes/fonts. | Readable headings/status, usable controls, logical focus order, no clipped answers or keyboard-obscured completion. |
| Notifications | Permission denied, disable/change cadence/time, completed review, restart, timezone change, cold/warm tap. | Reminder content and destination agree; cancelled/obsolete notifications do not create an incorrect review. |
| Recovery export | Legacy/new records, unknown fields, source IDs, large answers, corruption, unsupported version, interrupted import, clean install. | Round trip preserves content and relationships; failed restore leaves current writing recoverable. |
| Privacy / ownership | Signed-out use, sign-in, sign-out, second account, diagnostic events, exported files, source/review deletion. | Explicit ownership, no unintended account visibility or reassignment, protected backups, and no answer bodies in diagnostics. |
| Cloud, if added | Two devices offline, same-field conflict, separate-field edits, delete/edit conflict, stale session, access-policy negative tests. | Conflicts preserve writing; retries do not duplicate; another user cannot access the data. |

Proposed performance budgets, to validate on a named representative mid-range device in release mode: local-save acknowledgement p95 ≤500 ms after a submitted write under normal storage conditions; first useful Moments content ≤1 second for the long-history fixture; local search results ≤300 ms after debounce. These are proposed acceptance targets, not measured baseline claims. Include a larger stress fixture to identify where paging or a different local storage implementation is needed.

Release telemetry should record operation, cadence, phase, duration, revision and error category with non-content identifiers. Track save failures, duplicate suppression, missing-reference rates, migration/restore failures, and crashes. Never collect answer text, prayer bodies, search queries, or prompt responses as analytics. A data-loss report pauses rollout; presentation rollback must leave persisted writing intact.

**Implementation map**

| Work | Existing files to extend / proposed shared module |
| --- | --- |
| Stable schema and operations | `src/storage/reviewStorage.ts`; proposed `src/services/reviewRepository.ts` with an additive legacy adapter and phase metadata. |
| Shared answer coverage | `src/services/reviewStages.ts`; proposed `src/services/reviewPresentationService.ts` used by editor, reader, cards, search, and export. |
| Editor / full reader / drafts | `src/screens/ReviewScreen.tsx`, `ReviewReaderScreen.tsx`, `PastReviewsScreen.tsx`. |
| Moments views | `src/services/momentTimelineService.ts`; proposed `src/components/moments/ReviewMomentSummary.tsx`; `src/systems/journal/renderers/EnhancedMomentsRenderer.tsx`. |
| Discovery and refresh | `src/components/moments/momentFilterOptions.ts`, `src/services/momentFilterService.ts`, `src/screens/MomentsScreen.tsx`, `src/utils/momentsRefresh.ts`. |
| Calendar / Today / reminders | `src/services/reviewPeriodService.ts`, `reviewEligibilityService.ts`, `reviewNotificationService.ts`; `src/hooks/useTodayReviewData.ts`; `src/screens/TodayScreen.tsx`. |
| Linked content / rhythms | `src/services/reviewMemoryService.ts`, `weeklyGratitudeService.ts`, `weeklyReviewPrayerService.ts`, `faithfulRhythmService.ts`. |
| Routes and tabs | `src/navigation/types.ts`, `JournalStackNavigator.tsx`, `BottomTabNavigator.tsx`; validate all entry routes to the same identity. |
| Backup / ownership | `src/services/journalBackupContract.ts`, `journalBackupInventory.ts`, `src/context/IndustryStandardAuthContext.tsx`; concrete restore/encryption work requires its own implementation. |
| Quality evidence | Existing storage/service/rendering tests and `src/dev/reviews/` fixtures; add behavior tests only for the new contracts and failure cases, plus iOS/Android scenario records. |

**Technical references for the later hardening work**

React Native documents AsyncStorage as unencrypted storage. Protecting sensitive review bodies therefore needs an explicit storage design; merely adding save calls or a schema version does not provide encryption. Prefer platform-protected keys for an encrypted journal store/backup, with a documented recovery policy. See [React Native security guidance](https://reactnative.dev/docs/security).

If Supabase review sync is added, scope records to their owner, configure grants and row-level policies for each exposed operation, and run negative access tests. Application filters alone are not an authorization boundary. See [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

Use native accessibility roles, labels, state, and focus behavior for the grouped flows, then verify with both screen readers. See [React Native accessibility](https://reactnative.dev/docs/accessibility). These references inform the proposed acceptance checks; they do not establish that the existing app already satisfies them.
