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
- NOTICE: What stands out as you look back on this week?
- GOD: Where did you notice God’s faithfulness this week?
- HEART: What was happening in your heart this week?
- SCRIPTURE: What truth from Scripture do you want to carry with you?
- PRAYER: What are you still bringing to God?

**Look Ahead (Step into next week)**
- PRIORITY: What matters most this week? (up to 3)
- DON’T FORGET: What needs your attention this week?
- PEOPLE: Who do you want to make room for this week?
- PRAYER: What do you want to keep bringing to God this week?
- REST: Where will you make room to rest?
- WATCH FOR: Is there anything you need to be mindful of this week?
- FAITHFUL STEP: What is one faithful step you want to take this week?

Closing: `YOUR WEEK IS READY` with chosen priorities, carried Scripture, active prayers, and one faithful step.

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
