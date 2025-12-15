# siFia — App Store Review Notes

**Build:** 1.3.0  
**Bundle ID:** com.nikkibatanes.sifia  
**Short app purpose (one line):**
siFia is a spiritual wellness app that uses OpenAI to generate personalized devotionals, playbooks, and guided journaling prompts.

**Important disclosure (required):**
This app uses AI (OpenAI) to assist with generating devotionals and prompts. Outputs may not always be accurate and are intended for spiritual reflection, not professional advice.

## Test accounts (please use these to sign in)
**Reviewer test account:** reviewer+apple@example.com / Password123!  
**Alternate free account:** reviewer+free@example.com / Password123!  
*(Replace these placeholders with the real test credentials you want us to use.)*  
**Notes:** Accounts are standard email/password; social sign-in is optional.

## Reproduction steps (high-priority flows)

1. **Install and open the app.**
2. **Sign in with the Reviewer test account listed above.**
3. **Onboarding:** Sign in using the account and it will start the onboarding process. There is no skip. At the end of the onboarding it will ask you to write your struggle but you can choose suggestion to populate then click create playbook. Once they created a playbook, it will you can continue your journey and it will direct you to the sales offer screen. The app push for sales before the trial. Choose which one. The app uses sandbox you will not be charged. You can also opt out and use the free account but wont be able to generate playbooks and devotionals. Journal tools are free. Once done with the onboarding it will go to dashboard.
4. **Create a Playbook:** From dashboard there is a fab you can tap to create a playbook or you can also go to playbooks tab and find the playbook you created and the fab to create another one. You can generate a new playbook as long as you are not in the seeker account. Follow prompts → verify tasks, affirmations, and journaling fields.
5. **Create a Devotional:** To generate a devotional, you can go to a playbook and tap the fab (with the heart icon) to generate. Or you can long press the playbook from dashboard or from the playbooks tab. Choose a duration of the devotionals. This will depend on your tier. Select duration (1/3/5/7 days) → Generate. Verify AI-generated content appears and you can save/complete sessions.
6. **Journaling:** You can go to journal tab and enter any journaling. You can also go to the devotional tab and tap question to ponder. Scroll down. Type → Save → Export (PDF export available in the top-right).
**Smart Journaling:** To test smart journaling, go to playbook tab, tap a playbook, tap action steps, long press subtask and emoji choices will come up - reflection, prayer, gratitude and timeblock.
7. **Subscriptions / IAP:** Go to Settings → Subscription. Use Apple sandbox test purchase to buy "Growth" tier (or use the provided test Apple sandbox account). I suggest to get growth tier to be able to test other features like exporting to pdf and smart journaling. Verify purchase, unlock features, and Restore Purchases works.
8. **Account deletion:** Dashboard > tap on the users avatar upper right corner > tap on avatar edit again on the left, navigate to delete account — this will permanently remove user data (confirm to test).
9. **Notifications:** Allow push notifications when prompted; verify a scheduled reminder (Settings → Reminders → set one).

## What to focus on / test

- App does not crash during onboarding, generation, purchase, export, or deletion.
- AI generation flow: content displays, save works, and editing/saving preserves content.
- Subscription gating: features correctly toggle by plan.
- Restore purchases: works as expected.
- Privacy: no personal data leaked in visible logs (no debugging info).
- Accessibility: VoiceOver and Dynamic Type supported for key screens (onboarding, devotional, journal).
- Keyboard behavior: input fields are not obscured; keyboard persists when tapping action buttons (modal screens).

## Technical & compliance notes

- **Framework:** React Native + TypeScript. Backend: Supabase (Postgres).
- All subscriptions are handled through Apple IAP (no external payments). Free trial is available in sandbox.
- **Privacy policy URL:** [insert URL] (linked in app).
- Account deletion implemented and available in Settings.
- No console logs or debug keys in production.

## Contact (fastest for review help)

**Developer:** Nikki Batanes  
**Email:** [your-support-email@example.com]

If you need device logs or a screen-recording of any failure, reply to this note and I will provide.

---

Thank you for reviewing siFia. If you need specific build instructions, a video walkthrough, or additional test accounts, please let me know and I'll supply them immediately.
