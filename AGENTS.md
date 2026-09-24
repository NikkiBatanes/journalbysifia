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
- `Continue review` for Weekly and Monthly drafts resumes the exact last visited step by its stable stage key, including read-only or unanswered pages. If an older or invalid key cannot be resolved, start at the first reflection.
- Storage: `src/storage/reviewStorage.ts`
- Settings: `src/storage/reviewSettingsStorage.ts`
- Period calculations: `src/services/reviewPeriodService.ts`
- Eligibility / dashboard priority: `src/services/reviewEligibilityService.ts`

### Cadence & availability

| Review       | Default trigger                                | Period reviewed                              | Ends with             | Dashboard lifespan                            |
| ------------ | ---------------------------------------------- | -------------------------------------------- | --------------------- | --------------------------------------------- |
| Weekly       | User’s chosen review day, default Sunday, 7 PM | Previous 7 days based on Profile `weekStart` | Step into next week   | Until next weekly period becomes available    |
| Monthly      | First 7 days of the following month            | Previous calendar month                      | Step into next month  | Through day 7 of the following month          |
| Quarterly    | Last 7 days of Mar/Jun/Sep/Dec                 | Current quarter                              | Step into next season | Until next quarterly period becomes available |
| Year End     | December 15                                    | Jan 1 → Dec 31                               | Close the year        | Dec 15 through Dec 31                         |
| Begin Year   | January 1–14                                   | Builds from Year End carry-forward           | Begin the year        | Jan 1 through Jan 14                          |
| Past Reviews | Always                                         | Completed periods                            | Read / edit / revisit | More → Reviews                                |

### Dashboard lifecycle

- Only one pending review gets main dashboard priority. The largest active period gets the main CTA; smaller active periods are listed as `Also ready`.
- Reviews that are ready but not started and reviews already in progress are both actionable from `More → Reviews` while their availability window is open.
- If a review's availability window expires, its unfinished draft remains stored but is hidden from the actionable Reviews UI. Completed reviews remain in Past Reviews.
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
- PRAYER: `Pray over your week` is its own page immediately after the walkthrough, using `prayer_ahead`. Earlier `week_support_choices` remain readable; new reviews use free writing. Completing the review saves the words as one canonical active Weekly Open Prayer, linked to the review and visible in Moments; retries update that prayer instead of duplicating it.
- People, Rest, and Faithful Step are no longer separate weekly questions. Existing answers remain readable in the recap and Past Reviews.

Closing: a shared `WeeklyReviewSummary` shows **Looking Back / Looking Ahead** tabs at the end of the editor and when opening a completed weekly review. Looking Back starts selected; editing returns to the same tab, and editing Looking Forward goes through both walkthrough steps. Daily activity and category counts come from unique captured moments inside the saved period; life-area ratings come directly from answers. See [Weekly review summary](docs/weekly-review-summary.md). Weekly completion happens only on `Finish review`, after saving; reaching the recap leaves a draft open. All Looking Ahead steps are optional.

#### Monthly

**Look Back**

- FEELINGS: How did this month feel? First collate every canonical Morning Check-in feeling for the month by frequency. Tapping a feeling revisits its dated “underneath it” reflections. The user then chooses up to three separate retrospective words (`month_feelings`, optional `month_feeling_other`); the app never converts the raw check-ins into an automatic mood verdict.
- WHAT SHAPED THIS MONTH: This is the Monthly Review’s single moments and remembering page. It uses the exact shared weekly moments experience: the same presentation groups, rich card variants, horizontal carousels, counts, expansion controls, selection behavior, loading behavior, and empty state. Monthly selection is expressed as hearting rather than bookmarking: use filled and outline heart icons with the same `alertCoral` rose treatment as “Needs care.” When completed Weekly Reviews contain bookmarks for the month, those moments are automatically hearted once and the page defaults to them. `More moments` contains only moments that were not bookmarked in Weekly Reviews, so the views never duplicate cards. Weekly Review itself continues to use bookmarks. With no Weekly bookmarks, Monthly automatically shows all moments and explains the fallback instead of presenting an empty page. A swipe beginning on a moments carousel moves its cards and remains contained there; a swipe beginning on the heading or open page area navigates backward or forward through the review. Continue directly to PATTERNS; do not add another selection-review or free-writing remember page.
- PATTERNS: “What patterns do you notice?” keeps three distinct tabbed charts on one page: canonical Morning Check-in feelings by days, retrospective Weekly Check-in feelings by check-in frequency, and the emotions saved with daily Looking Forward reflections under “Looking forward to the next day, you felt…” by days. Positive/steady feeling bars use muted sage; difficult feeling bars use `Colors.alertCoral`. Never combine the units into one frequency or infer an aggregate mood verdict. Save the user’s own observation to `notice_month`.
- WHOLE-LIFE SYNTHESIS: “How were you this month?” is read-only. Collate the completed Weekly Whole-life answers instead of asking for the ratings again. Keep the week-by-week graph, then show frequency, coverage, and a deterministic interpretation for each shared life area. Missing answers remain neutral “No answer” segments; one answer is explicitly insufficient for a pattern; when the month has no Whole-life answers, show one empty state and do not invent an interpretation.
- WINS: Immediately after the Whole-life synthesis, show “You had wins worth remembering.” as a read-only reminder using every Today’s Win recorded during the month. Present the wins in a vertically scrolling, responsive Pinterest-style masonry grid: cards keep their natural content height and flow into the shortest column rather than a horizontal carousel or fixed-height rows. Remove heart, bookmark, selection, and writing interactions. Omit this stage entirely when the month has no wins, then continue directly to the life-giving page.
- LIFE-GIVING / DRAINING: Follow the Whole-life synthesis with “What gave you life this month?” and “What drained you this month?” Use the app’s rounded pill selection UI, allow up to three choices on each page, and include an Other pill that reveals a free-text field. These are user-authored reflections, not conclusions inferred from the Whole-life ratings.
- FORMATION: “What might God be forming in you through this season?” opens with its writing field focused, the cursor and keyboard ready, and the field scrolled into view.
- PRAYERS: “This month in prayer” is a reflective heading rather than a question. It first shows every canonical answer event recorded during the month, followed by every currently active prayer or prayer need that existed by month end. Do not rank or limit this inventory. Exclude Prayer Requests that have not been prayed for yet; a linked prayer response is canonical evidence that a request was prayed for. Present both groups as horizontal carousels using the shared Prayer card from WHAT SHAPED THIS MONTH—including prayer type, date, title/body hierarchy, and “God answered” / “Carry in prayer” status treatment—but keep these overview cards read-only and do not show a bookmark action. A swipe beginning on either carousel moves its cards and remains contained there, while a swipe beginning elsewhere on the page navigates between review steps. This page is entirely read-only: do not show “What do you notice?” or any input field. Preserve legacy `prayer_month` responses in completed-review recaps without showing an empty reflection card for new reviews.
- GOD: End Looking Back with “Where did you see God’s faithfulness this month?” This is the hopeful spiritual landing before the Looking Ahead transition. Its writing field opens focused, with the cursor and keyboard ready, and remains scrolled into view. Do not add a separate monthly gratitude prompt; captured gratitude already appears in WHAT SHAPED THIS MONTH. Do not add a RELEASE page because it duplicates “What should you simplify or stop?” in Looking Ahead. Preserve legacy `release_month` answers in completed-review recaps.

**Step Into Next Month**

- MORE ROOM: “What do you want to make more room for?” uses the app’s rounded pill selection UI, allows up to three top-level choices, and includes Other with free writing (`month_more_room`, `month_more_room_other`). Every named top-level area expands when selected and offers optional smaller subchoices, limited to three per area. This applies consistently to Rest, Movement or health, Time with God, Family, Friends, Deep work, Creativity, and Financial margin; do not make Time with God the only expandable area. Persist the detail selections in the corresponding `month_more_room_*` answer keys and show them nested beneath their top-level area in the recap.
- NEEDS CARE: “What needs care next month?” is informed by the read-only Whole-life synthesis. Never show unexplained shorthand such as `3×`. Beneath an affected area, make the meaning primary in rose—“Needs attention”—then show quieter evidence such as “· Appeared in 2 weekly check-ins.” The user still chooses what to prioritize; the app does not turn the synthesis into an automatic decision (`month_care_areas`, `month_care_other`). With no completed check-ins, show every area without a care signal and explain that there is no monthly pattern yet.
- LEAVE BEHIND: “What do you want to leave behind?” surfaces the user’s earlier Draining choices before the curated options, but never preselects them. Use the same pill UI and Other behavior (`month_leave_behind`, `month_leave_behind_other`). Like More room, every standard choice expands when selected and offers up to three optional specifics; this includes the standard Draining choices carried forward from Looking Back. Include faith-shaped choices such as Striving and self-reliance, Shame and condemnation, and Resentment or unforgiveness, using gentle language about surrender, grace, forgiveness, and abiding rather than framing every difficulty as spiritual failure. Persist the specifics in their corresponding `month_leave_behind_*` keys and nest them beneath the main area in the recap. A custom Draining answer or Other remains free text because the app cannot predefine meaningful subchoices for user-authored content.
- WHAT MATTERS: “What matters most in [upcoming month]?” keeps one to three free-text intention fields (`next_month_priority_1` through `next_month_priority_3`); do not replace these with canned choices.
- PRAYER: End Monthly Looking Ahead with `Pray over your month`, matching the focused Weekly prayer-writing experience at a month scale. It uses one optional free-writing field (`prayer_for_month`) rather than asking users to select unresolved prayers. Completing the review persists the words as one canonical active Monthly Open Prayer dated to the first day of the upcoming month, linked to the review, and visible in Moments; retries update it instead of duplicating it. Preserve legacy `month_prayer_ids` selections in older recaps without offering that selection UI in new reviews.

Do not add another Monthly feelings or daily Looking Forward page to Looking Ahead. The completed recap presents this five-step flow. Legacy `attention`, `continue`, `simplify_or_stop`, `intentional_with`, and `rhythm` answers remain readable in older completed reviews even though those pages are no longer part of new reviews.

Monthly now follows the Weekly Review’s immersive visual structure without copying its week-specific prompts: a reflective cover, rich Moments and Remembered pages, a Looking Ahead transition, and a shared-style **Looking Back / Looking Ahead** recap. The recap stays month-scale by emphasizing patterns, formation, prayer across the month, God’s faithfulness, and a small set of faithful priorities for the month ahead. Completion happens only from the recap’s `Finish review` action; completed monthly reviews reopen in the same two-tab recap.

Use the same unfilled `leaf-outline` icon for the top section marker on every Monthly Looking Back page. Page-specific icons may still appear inside cards, charts, and other content, but they do not replace this shared Looking Back marker.

On the Monthly Review cover, the month is the primary headline; include its year only when it is not the current calendar year. “Now, let’s look back” is supporting copy. Introduce the journey with “Notice what shaped you, where God met you, and what you want to carry forward.” Keep the cover vertically compact enough to leave breathing room around the primary action, and keep metric counts—including three-digit values—on one line.

Mirror that date-first hierarchy on both Monthly and Weekly: make the reviewed period the primary headline on the Looking Back cover and the upcoming period the primary headline on the Looking Ahead transition, with “Now, let’s look back/ahead” as supporting copy. Hide the year when the period is within the current calendar year; keep it for past or future periods and for weekly ranges crossing New Year. The Monthly transition’s Continue button uses centered text without an arrow.

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
