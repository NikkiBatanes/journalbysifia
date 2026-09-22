# Faithful Rhythms implementation

The percentages below separate each phase's share of the total project from
the completion of that phase. Weighted completion is calculated as
`phase share × phase progress`.

| Phase | Scope | Share of project | Phase progress | Overall contribution |
|---|---|---:|---:|---:|
| 1. Dependency audit | Classify legacy streak, Playbook, points, badge, route, notification, and persistence dependencies | 8% | 100% | 8.0% |
| 2. Visible cleanup | Remove obsolete user-facing tracker, badges, Playbook settings, pressure-based alerts, and dead screens | 12% | 55% | 6.6% |
| 3. Data foundation | Build one local-first rhythm model for routines, prayer, journal, Scripture, and Reviews | 18% | 85% | 15.3% |
| 4. Calculation engine | Partial completion, weekly percentage, current/longest consistency, timezone and deduplication rules | 15% | 75% | 11.3% |
| 5. Tracker experience | Today card, full details, profile summary, accessibility, empty/loading states | 20% | 75% | 15.0% |
| 6. Completion and Reviews | Closing trigger, milestone presentation, spiritual Review summaries, store-rating prompt | 10% | 80% | 8.0% |
| 7. Settings and reminders | Rhythm preferences and gentle notification scheduling | 5% | 20% | 1.0% |
| 8. Migration and QA | Compatibility migration, offline/pre-auth/timezone tests, device QA, staged rollout | 12% | 30% | 3.6% |
| **Total** |  | **100%** |  | **68.8%** |

## Implemented

- Morning and evening rhythm history now derives from canonical local routine state.
- Completing a routine emits one `faithful_rhythm_updated` event from the shared completion boundary.
- Morning and evening use the four sections already shown on Today for partial progress.
- Weekly percentages exclude future days.
- A missing completion today preserves a streak completed through yesterday until the day is over.
- Today shows Faithful Rhythms immediately after the daily routine card.
- More shows the same Faithful Rhythms summary instead of the inherited tracker.
- The old Streak Tracker, Badges modal, and placeholder Streak Detail screen were removed.
- Visible Playbook reminder controls were removed from Profile and onboarding.
- Legacy Playbook and pressure-based streak-alert defaults are disabled while their schemas remain for compatibility.
- A newly completed Morning or Evening closing now opens the familiar siFia-style celebration with a routine-specific `N-day morning streak` or `N-day evening streak` headline.
- The celebration uses Journal's warm cream, sage, and forest palette with a fade transition instead of the inherited bottom-up modal motion.
- Morning and Evening celebrations use routine-specific reflection copy instead of the original app's generic activity language.
- The celebration uses a quiet sun or moon marker and simple weekly checks, without sparkle, shadow, or floating white surfaces.
- The routine icon has a gentle sun or moon motion, and the paper-plane action opens a dedicated streak share composer with the rhythm label and full weekday status row.
- The celebration uses the completed routine's own streak history, works before sign-in, and returns to Moments when dismissed.
- One rhythm model now covers Morning, Evening, Heart Journal, Prayer, Scripture Notes, Bible Study, Session Notes, and Reviews.
- Heart Journal, Prayer, and Scripture Notes use daily dates; duplicate entries on one day still count as one day.
- Bible Study and completed Session Notes use weekly cadence so they are not pressured into a daily streak.
- Guided Heart Journal drafts and edited entries do not increase the rhythm; completion is the meaningful boundary.
- Reviews are tracked by their own review periods and open the same quiet celebration after the final Review stage is completed.
- The compact Today/Profile card shows four primary rhythms and “View all” opens the complete tracker grouped into daily, weekly, and Review sections.
- All rhythm celebration screens use the correct rhythm icon, labels, date/day row, and dedicated share composer.
- The automatic App Store review request is no longer attached to inherited points, levels, Playbooks, or prayer milestones. It is requested after dismissing the 7-, 30-, or 100-day Morning/Evening celebration, subject to the existing 30-day and yearly limits.
- Focused service, trigger, celebration, and share-composer tests cover the new boundaries.

## Next slice

1. Retire remaining ordinary save-triggered legacy streak celebrations for inherited planning and Playbook activities.
2. Add per-rhythm reminder preferences without pressure-based “streak at risk” language.
3. Finish migration coverage for legacy records, timezone boundaries, and account-linking scenarios.
4. Complete iOS and Android device QA for compact screens, larger text, and reduced motion.
5. Remove the compatibility branch and legacy services after their remaining callers have moved.
