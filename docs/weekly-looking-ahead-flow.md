# Weekly Looking Ahead

The design uses the user's repeated feedback about length, crowded layouts, too many choices, and the prayer/action prompts. These are design hypotheses informed by that feedback and general usability research, not findings from app-user interviews or analytics.

The intended needs are to identify what matters, choose where care is needed, anticipate difficulties, and notice something to look forward to, with room for prayer. The weekly flow has these optional reflections:

1. What matters most? One input initially, with up to three priorities.
2. What needs care? Select life areas and optionally add one shared note.
3. What could make this week difficult? The existing short set of choices and Other.
4. Looking forward to this week: the shared Looking Forward walkthrough, first choosing how the week feels and then writing what the user is looking toward.
5. Pray over your week: a separate page for optional prayer writing. There are no suggested prayer words in the current flow.

People and Rest fit within Needs Care. The separate Faithful Step prompt is removed. The final recap shows actual answers, allows editing, and displays the seven calendar days after the reviewed period. Finish review explicitly completes the review; an unanswered week is allowed.

This follows [Nielsen Norman Group's form guidance](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/): remove unnecessary questions, make optional inputs clear, reveal detail when needed, and let later questions build on earlier answers. The exact spiritual wording is a product decision, not something that source validates.

Saved keys are retained. Removed questions and previously saved prayer word choices remain readable for older reviews. Anticipation uses `week_looking_forward`, `week_looking_forward_emotion`, and `week_looking_forward_other`; prayer keeps `prayer_ahead`. Weekly Looking Forward also saves a separate `weekly_looking_forward` Moment, titled `Looking forward to this week`, with feeling, writing, and the upcoming dates. No canonical Prayer records are created. Other review cadences and daily Looking Forward entries retain their existing behavior.

Useful next validation with app users: can they distinguish priorities from needs-care areas, reach the recap without feeling required to fill every field, and recognize their own week in the recap? Native keyboard behavior and device spacing should also be checked on a phone.
