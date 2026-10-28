# Early Access implementation and QA — October 12, 2026

## Current implementation

The landing page preserves its journal-first story, sage/ivory design, responsive screenshots, local fonts, Privacy/Terms pages, regional founding-price presentation, and optional two-step research flow.

Early Access persistence now uses Supabase instead of SiteGround MySQL:

- The public form sends JSON to the `journal-early-access` Edge Function.
- The function validates and bounds all input, limits origins, handles a honeypot, hashes survey tokens, and calls server-only RPCs.
- `public.journal_early_access` has Row Level Security enabled with no anon/authenticated policies or grants.
- RPC execution is limited to `service_role`; the secret key is never placed in frontend code.
- Signup upserts preserve original campaign attribution and unsubscribe suppression.
- The optional survey remains editable only with the signup token returned to that browser session.
- The PHP pricing proxy remains on SiteGround so PH sees ₱599 and other/unknown locations see US$12.99.

The legacy MySQL/PHP signup files have been removed. The production ZIP contains only the SiteGround pricing proxy; signup persistence is Supabase-only.

## Local verification scope

Automated checks cover frontend validation and consent, successful signup before the optional survey, skip/empty survey behavior, feature limits, price context, tester opt-in, duplicate submission guards, retry errors, attribution privacy, events, local links/assets, Edge Function feature allowlists, Supabase RLS/grants, and PHP parsing for the pricing proxy.

The test suite mocks the Supabase endpoint and country response. It does not execute Postgres, invoke the deployed Edge Function, send email, or confirm a rendered browser layout.

## Required live QA

1. Link to the intended Supabase project, apply `202610120001_create_journal_early_access.sql`, and deploy `journal-early-access` with JWT verification disabled. No production Supabase resource was changed by preparation alone.
2. Upload the refreshed public ZIP to the `journal.sifia.app` document root and verify `.htaccess` is present.
3. Test a disposable signup, optional survey, same-email resubmission, malformed/expired token, missing consent, and simulated API failure. Confirm one normalized row, original attribution retention, UTC timestamps, and suppression retention.
4. Test pricing on the live PHP host: PH → international → PH after VPN changes. Confirm the pricing API is not CDN-cached.
5. Test at 1440, 768, 390, and 320 pixels. Check all screenshots, overflow, clipping, keyboard traversal, focus, 200% zoom, reduced motion, and screen-reader error announcements.
6. Configure the email/list provider with unsubscribe and suppression handling. The signup endpoint stores data but does not send mail.
7. If analytics is wanted, connect the existing `dataLayer`, add only the provider's required CSP domains, and update privacy disclosures before enabling it.

## Remaining risks

- Email ownership is not verified. Someone who knows an address could resubmit it and change platform/research data. Add verified email if abuse appears.
- The honeypot is not full rate limiting. Add Supabase/project-level rate controls or another protection if automated abuse appears.
- Browser attribution lasts only for the tab; with storage blocked, it lasts only for the current page.
- Geolocation is an estimate and pricing falls back to USD if lookup fails.
- Supabase deployment, live persistence, email delivery, and real-device browser QA remain operational steps.

## Copy and offer state

The current copy explains that Early Access is free, optional beta access is temporary, and the final app is not included for free. The founding offer is versioned as `founding-launch-v1`; exact dates remain unannounced. Website eligibility records do not implement app-store purchase or redemption.

`COPY-V1.md` and `copy-v1-manifest.json` remain the copy baseline. No production deployment was performed as part of this code-only handoff.
