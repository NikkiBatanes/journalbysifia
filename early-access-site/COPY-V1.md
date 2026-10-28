# Stage 2 copy v1 — frozen September 25, 2026

The approved main website copy is frozen. Further work should address technical defects, accessibility, measurement, or an explicit user-requested change. Record substantive future copy experiments as a new version rather than silently replacing this baseline.

The final corrections clarify founding-price access, simplify Early Access, add the same localized price beside signup, remove the ordinary/spiritual contrast, and preserve all eight approved backbone headlines. Pricing continues to show a single automatic regional amount with “one time”, without a region picker.

The hidden Website input is an anti-spam honeypot. It has native `hidden`, `aria-hidden`, CSS hiding, and tabindex=-1; normal visitors should never see it or reach it using Tab.

## Language-note source

Brown–Driver–Briggs, qavah I, sense 1: https://biblehub.com/bdb/6960.htm. The lexicon gives waiting/looking eagerly for and explicitly lists Psalm 27:14. The mockup reads: “To wait or look eagerly for. In Psalm 27:14, the waiting is directed toward the Lord.” The former “not passive delay” claim was removed. Future lexical/historical demo claims need a documented source and must distinguish interpretation from definition.

## Technical release gate

- Local DOM regression suite: 101 checks with mocked Supabase API/country lookup. Not a substitute for rendered mobile/desktop or live Supabase testing.
- Deploy and verify the production Supabase migration, Edge Function, signup, survey, and unique-email behavior.
- Confirm country lookup works in the production browser; the same-origin PHP proxy now follows siFia’s ipwho.is approach, with USD fallback. The static local preview cannot execute PHP.
- Connect the existing dataLayer to the selected analytics service and verify received events and UTM attribution.
- Configure confirmation email and unsubscribe handling with the selected provider; send and inspect a real test message after configuration.
- Verify legal links, desktop/mobile layout, keyboard controls, consent and confirmation state.
- Publish only once configuration and real-path QA pass. No production publication has occurred.

## Day 0 record (complete after publication)

Status: NOT STARTED. Copy freeze is not launch Day 0.

- Publication timestamp (UTC / Asia-Manila): pending
- Production URL and deployed artifact checksum: pending
- Database migration and real signup QA evidence: pending
- Confirmation email delivery/unsubscribe evidence: pending
- Analytics provider, event receipt and test-traffic exclusions: pending
- Baseline unique valid consenting contacts, survey completions, tester volunteers: pending
- Campaign URLs (source / medium / campaign / content / term): pending
- Measurement window and first review date: pending

Use database unique-contact counts for valid signups; event counts can include repeat contacts. Track page → hero/pricing CTA → form start → saved signup → survey start/completion → saved tester opt-in. Keep research optional. Do not enter invented counts or a launch date before production is live.

Approved final heading: “Be there when Journal is ready.” Price remains singular and automatic; unknown location retains US$12.99 as explicitly requested.
