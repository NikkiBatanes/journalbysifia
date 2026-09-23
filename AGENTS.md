# Journal by siFia — Project Notes

## Moments scrolling

- Confirmed September 22, 2026: sticky date headers reported inner `y=0` to VirtualizedList, corrupting spacing and causing jumps between dates. Keep `MomentsStickyHeader` wired into the renderer and date headers free of entrance transforms.
- Diagnosis, implementation, tests, and the related pending siFia issue: [Moments scroll fix](docs/moments-sticky-header-scroll-fix.md). Recheck the adapter's internal RN contract on upgrades.

## Sermon Notes

- Main file: `src/screens/SermonNotesScreen.tsx`
- Session Note types: one shared editor serves Sermon/Conference/Speaking/Meeting/Workshop/Other via additive `metadata.sessionNoteType` (`src/types/sessionNotes.ts`). Legacy records without the field resolve to `sermon` at read time — no migration. Add menu "Session Notes" opens the editor's type picker directly, matching the Heart Journal entry flow and avoiding a duplicate picker animation. Distinct from Heart Journal `journalClassification: 'notes'`.
- Common verification: `npx tsc --noEmit`

## Review Feature

### Core architecture

- Reviews are **orchestration**, not canonical content. They store references to journal, reflection, sermon, Scripture, and prayer records.
- `Remember this` belongs to the review, not the original record. Marking something memorable in a review does not mutate the source record.
- Storage: `src/storage/reviewStorage.ts`
- Settings: `src/storage/reviewSettingsStorage.ts`
- Period calculations: `src/services/reviewPeriodService.ts`
- Eligibility / dashboard priority: `src/services/reviewEligibilityService.ts`

### Cadence & availability

| Review | Default trigger | Period reviewed | Ends with | Dashboard lifespan |
|---|---|---|---|---|
| Weekly | User’s chosen review day, default Sunday, 7 PM | Previous 7 days based on Profile `weekStart` | Step into next week | Until next weekly period becomes available |
| Monthly | Last 3 days of month | Current calendar month | Step into next month | Until next monthly period becomes available |
| Quarterly | Last 7 days of Mar/Jun/Sep/Dec | Current quarter | Step into next season | Until next quarterly period becomes available |
| Year End | December 15 | Jan 1 → Dec 31 | Close the year | Dec 15 through Dec 31 |
| Begin Year | January 1–14 | Builds from Year End carry-forward | Begin the year | Jan 1 through Jan 14 |
| Past Reviews | Always | Completed periods | Read / edit / revisit | Journal → Reviews |

### Dashboard lifecycle

- Only one pending review gets main dashboard priority. The largest active period gets the main CTA; smaller active periods are listed as `Also ready`.
- If a newer period of the same type becomes available, the dashboard card switches to the newest one. Old uncompleted drafts live under `Journal → Reviews → Drafts`.
- Completed reviews briefly show a `✓` card, then disappear from the dashboard.

### User settings

- Weekly boundaries follow Profile `weekStart` (default Monday). `getReviewSettings(weekStart?)` derives `weekEndsOn` as the preceding day; the legacy stored review day is ignored. AuthContext mirrors the effective preference in `journal:review-week-start` for services outside React. Explicit saved review period dates remain unchanged.
- `reminderTime` (HH:MM)
- `enabledCadences` per review type

### One-page screen flow

1. **Cover** — cadence, date range, stats, CTA
2. **What you captured** — collated categories, each with `Remember this`
3. **What you want to remember** — only selected items
4. **Look Back** questions
5. **Look Ahead / Step Into** practical questions
6. **Saved / Ready** closing page

### Question beats by cadence

#### Weekly

**Look Back**
- FEELINGS: How did this week feel? (up to 3 everyday or spiritual words, or write your own)
- LIFE CHECK-IN: How did these areas of life feel this week? Mind, Body, Relationships, Work / School, Finances, Responsibilities, Rest, and Life with God share the catalog in `src/data/weeklyLifeAreas.ts`.
- MOMENTS: Moments from this week — browse and bookmark.
- REMEMBERED: What you want to remember — keep this as a separate page after Moments, with an optional “Anything else you want to remember?” field for unlogged memories (`week_memory_other`).
- THE HARD PARTS: What felt difficult this week? (optional, `week_difficulty`)
- WEEKLY GRATITUDE: Looking back on this week, what do you want to thank God for?
- GOD’S FAITHFULNESS: How did God meet you this week? (choose up to 3 or write your own)
- WHAT YOU’RE LEARNING: What are you learning through this week? (`week_learning`)

Weekly Look Back reflection answers stay in the review. New learning answers must not create Open Prayers. Legacy `answers.prayer` remains preserved and readable in the editor/reader; existing canonical prayers are left intact. Weekly gratitude retains its existing Gratitude Moment integration.

**Look Ahead (Step into next week)**
- PRIORITY: What matters most this week? Start with one input; the icon-only floating plus beside Next adds and focuses another, up to three.
- NEEDS CARE: What needs care this week? Select any of the shared life areas or Other (`week_care_areas`). Other reveals its own text field (`week_care_other`); one shared optional note retains the legacy `dont_forget` answer key.
- CHALLENGES AHEAD: What could make this week difficult? Reuses `watch_for` immediately after Needs Care. Suggestions are stored in `week_challenge_choices`; Other keeps the legacy `watch_for` text. Older written answers open as Other. Deselection preserves the text for re-selection.
- LOOKING FORWARD: Reuses the daily Looking Forward walkthrough’s emotion and writing steps with weekly wording. Answers use `week_looking_forward`, `week_looking_forward_emotion`, and `week_looking_forward_other`. It saves a distinct `weekly_looking_forward` Moment titled `Looking forward to this week`, using the reviewed period end as its timeline date and the upcoming seven days on its card. Daily Looking Forward entries remain separate.
- PRAYER: `Pray over your week` is its own page immediately after the walkthrough, using `prayer_ahead`. Earlier `week_support_choices` remain readable; new reviews use free writing. Prayer answers stay in the review.
- People, Rest, and Faithful Step are no longer separate weekly questions. Existing answers remain readable in the recap and Past Reviews.

Closing: a shared `WeeklyReviewSummary` shows **Looking Back / Looking Ahead** tabs at the end of the editor and when opening a completed weekly review. Looking Back starts selected; editing returns to the same tab, and editing Looking Forward goes through both walkthrough steps. Daily activity and category counts come from unique captured moments inside the saved period; life-area ratings come directly from answers. See [Weekly review summary](docs/weekly-review-summary.md). Weekly completion happens only on `Finish review`, after saving; reaching the recap leaves a draft open. All Looking Ahead steps are optional.

#### Monthly

**Look Back**
- REMEMBER: What do you want to remember from this month?
- NOTICE: What pattern are you beginning to notice?
- GOD: Where did you see God’s faithfulness?
- FORMATION: What might God be forming in you through this season?
- PRAYER: What prayers were answered? What are you still waiting on?
- RELEASE: What don’t you want to carry unnecessarily into another month?

**Step Into Next Month**
- What matters most next month? (up to 3)
- What needs your attention? (decision, responsibility, conversation, deadline, etc.)
- What do you want to continue?
- What should you simplify or stop?
- Who do you want to be intentional with?
- What rhythm do you want to protect?
- What are you praying for this month?

#### Quarterly

**Look Back**
- THE SEASON: If you had to describe this season, what would you call it?
- PATTERNS: What kept showing up?
- GROWTH: Where can you see change in yourself?
- GOD: Where did you see God’s faithfulness?
- PRAYER: What changed in your prayers this season?
- RELEASE: What needs to end here?
- CONTINUE: What is worth carrying forward?

**Step Into Next Season**
- What are the 3 things that deserve your attention this quarter?
- What needs less of your attention?
- What important decision needs to be made?
- What relationship needs intentional care?
- What rhythm needs protecting?
- What have you been postponing?
- What would faithfulness look like this quarter?

#### Year End

- REMEMBER: What moments do you never want to forget?
- GOD: Where can you see God’s faithfulness now that you couldn’t see at the time?
- FORMATION: How are you different from the person who entered this year?
- HARD THINGS: What was difficult, disappointing, or painful?
- GRATITUDE: What are you deeply thankful for?
- PRAYER: Which prayers did you see answered?
- STILL WAITING: What are you still bringing before God?
- RELEASE: What are you ready to leave here?
- CARRY: What truth, prayer, relationship, lesson, or Scripture do you want to carry into the next year?

Year End closes the year; it does not plan the next year.

#### Begin Year

- Pull forward selected carry items from Year End
- POSTURE: How do you want to enter this year with God?
- FORMATION: Who do you want to become?
- ATTENTION: What deserves your attention this year? (optional categories: Faith, Marriage/relationships, Family, Work/calling, Health/stewardship, Church/community, Rest, Finances, Other)
- PRIORITIES: What three do you especially want to remember?
- RHYTHMS: What rhythms would help you live faithfully this year?
- PEOPLE: Who do you want to intentionally make room for?
- PRAYER: What are you asking God for this year?
- SURRENDER: What are you choosing to entrust to God?
- FAITHFULNESS: At the end of this year, what would faithfulness matter more than achievement?

### Guiding principle

Planning is not productivity. The practical planning should answer one question:

> After everything I noticed with God, what deserves faithful attention next?

No hour-by-hour scheduling, project management, elaborate goals, or giant task lists.

### Morning Routine integration (future)

- Today can surface items from the active Week review under `FROM YOUR WEEK`.
- Hierarchy: Begin Year → Quarter → Month → Week → Today.
- Journal should surface, not command.

### Build phases

1. Review foundation (done): model, period calculator, settings, eligibility, draft autosave
2. Weekly capture + collation
3. Weekly one-question-per-stage reflection and Look Ahead
4. Monthly
5. Quarterly
6. Year End
7. Begin Year
8. Dashboard lifecycle
9. Settings UI
10. Notifications
11. Cloud sync
