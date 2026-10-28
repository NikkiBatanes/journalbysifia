# Journal by siFia — Early Access site

A responsive pre-launch landing page and two-step research funnel for `journal.sifia.app`.

The public website is hosted on SiteGround. Early Access signups are validated by a Supabase Edge Function and stored in Supabase Postgres. SiteGround MySQL is not used. The first step stores the required email, platform, and consent immediately; the optional second step adds product, pricing, and tester research to the same record.

## Architecture

```text
Visitor
  ├── page + images + pricing proxy ──> SiteGround / public_html
  └── Early Access JSON form ─────────> Supabase Edge Function
                                           └── protected Postgres RPCs
                                                 └── journal_early_access
```

- `api/location-proxy.php` remains on SiteGround and returns only a visitor country code for PH/USD pricing.
- `app.js` submits signups directly to the `journal-early-access` Supabase Edge Function.
- The browser never receives the Supabase service-role/secret key.
- Row Level Security is enabled and no browser role receives table access.
- This flow records signups; it does not create Supabase Auth users and does not send email.

## Supabase setup

The required backend code is:

- `../supabase/migrations/202610120001_create_journal_early_access.sql`
- `../supabase/functions/journal-early-access/index.ts`
- `[functions.journal-early-access] verify_jwt = false` in `../supabase/config.toml`

Apply the SQL manually in **Supabase Dashboard → SQL Editor** by pasting the complete migration file and running it once. A successful schema operation reports `Success. No rows returned`.

Type-check the Edge Function in Docker from the repository root:

```sh
docker run --rm \
  -v "$PWD/supabase/functions/journal-early-access:/app:ro" \
  -w /app denoland/deno:latest deno check index.ts
```

Then deploy only the function:

```sh
supabase login
supabase functions deploy journal-early-access \
  --project-ref aesmrjinczhknchlrsmt \
  --no-verify-jwt \
  --use-api
```

This command does not apply database migrations. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function runtime; do not put the service-role/secret key in HTML, JavaScript, SiteGround, Git, or a ZIP.

Deployment status on October 12, 2026: `journal-early-access` is deployed to project `aesmrjinczhknchlrsmt`. Its production-origin CORS preflight and non-writing error response were verified live.

The Edge Function accepts requests only from:

- `https://journal.sifia.app`
- `http://127.0.0.1:4173`
- `http://localhost:4173`

If the production hostname changes, update both `ALLOWED_ORIGINS` in the function and the canonical/domain references in the website before redeploying.

## SiteGround setup

1. In SiteGround, create the `journal.sifia.app` subdomain and confirm its document root.
2. Deploy the Supabase migration and Edge Function first.
3. Upload the contents of `dist/journal-early-access-public-html.zip` into the subdomain's `public_html` directory. Extract the ZIP there; do not upload the enclosing ZIP as the website root.
4. Confirm `.htaccess` was uploaded. Some file managers hide dotfiles.
5. Clear SiteGround Dynamic Cache/CDN caches for the subdomain.
6. Open `https://journal.sifia.app`, submit a disposable signup, answer the optional survey, and confirm the row in Supabase.

No SiteGround database, database user, phpMyAdmin import, or database credential file is required. The legacy MySQL schema, migrations, configuration template, and PHP signup endpoint have been removed from the project.

## View and export signups

In Supabase Dashboard, open **Table Editor → journal_early_access**. You can filter and export CSV there. Useful filters are:

- Subscribed contacts: `email_consent = true` and `unsubscribed_at is null`
- Test volunteers: `tester_opt_in = true` and `unsubscribed_at is null`
- Completed research: `survey_completed_at is not null`
- Platform: `iphone` or `android`

Feature choices are stored as a JSON array. Signup, consent, survey, and update timestamps are stored as UTC `timestamptz` values.

## Form behavior

- Email, phone platform, and email consent are required.
- All product and pricing questions are optional.
- Resubmitting a normalized email updates the existing record instead of creating a duplicate. Original attribution, creation time, previous research until a new survey is saved, and unsubscribe suppression are preserved.
- UTM tags, source, the landing page without query/hash, and the referring origin are retained for the current tab.
- The hidden honeypot reduces basic automated spam.
- Survey access uses a random token; only its SHA-256 hash is stored.
- Funnel events use `window.dataLayer`; no analytics collector is configured yet.
- Email delivery and unsubscribe automation still need a separate provider/workflow.

## Pricing localization

The pricing flow intentionally mirrors siFia Launch. SiteGround renders the page first, then `/api/location-proxy.php` sends the visitor's public IP to `ipwho.is` and returns only `country_code` to the browser. PH displays ₱599; every other country or a failed lookup displays US$12.99.

There is no region picker, browser-language inference, or saved country cache. Reloading after a VPN change triggers a fresh lookup. SiteGround must provide PHP with cURL. Exclude the pricing endpoint from forced CDN caching and verify the forwarding headers on the live host. A static-only local preview cannot execute PHP and therefore falls back to USD.

## Product and copy sources

The landing page leads with “Know where to begin. Have something to return to.” It presents Journal as a place for ordinary writing, prayer, Scripture notes, sermon notes, and reviews—not as a productivity app or a preorder.

The displayed screenshots live under `assets/screenshots/`. Their stories are checked against Today, Morning and Evening, Heart Journal, Prayer History, Review, Bible Study, and Sermon Notes implementation in the app. Keep claims aligned with the product when changing the page.

Regional founding prices are ₱599 and US$12.99 one time. Early Access membership is free. Members are eligible to buy at the regional founding price during a limited launch-period window; the website does not implement app-store redemption.

## Funnel events

| Event | Trigger |
| --- | --- |
| `early_access_page_view` | Home page script initializes |
| `early_access_hero_cta_clicked` | Hero Join CTA clicked |
| `early_access_pricing_viewed` | At least 25% of pricing enters the viewport |
| `early_access_pricing_cta_clicked` | Pricing Join CTA clicked |
| `early_access_form_started` | First signup field focus |
| `early_access_joined` | Signup API returns success |
| `early_access_survey_started` | First optional question focus |
| `early_access_survey_completed` | Survey API returns success |
| `early_access_tester_volunteered` | Successful survey save with tester opt-in |
| `early_access_survey_skipped` | Skip clicked |

Page/view/start/completion events deduplicate during a page lifetime. No email, free text, or survey answer is sent to the local event queue. Before adding an analytics provider, configure only its required CSP domains and update the privacy disclosures.

## Verification

Run the dependency-isolated DOM suite from the repository root:

```sh
npm install --prefix /tmp/journal-qa jsdom php-parser --no-audit --no-fund
NODE_PATH=/tmp/journal-qa/node_modules node scripts/verify-early-access.cjs
```

The suite mocks the Supabase API, pricing proxy, and IntersectionObserver. It checks validation, form flow, attribution, pricing, events, local assets, Edge Function allowlists, RLS/grants, and PHP parsing for the pricing proxy. It does not execute the Supabase migration, make a live database write, send email, or replace browser/device QA.

## Before launch

- Confirm `privacy.html` and `terms.html` match actual operating practices.
- Test 1440, 768, 390, and 320 pixel widths, keyboard navigation, 200% zoom, reduced motion, and a screen reader.
- Verify PH → international → PH pricing on the hosted site using the VPN workflow.
- Test a disposable signup and optional survey, then remove the test record in Supabase.
- Configure the email/list provider, suppression handling, and an unsubscribe link before sending marketing email.
- Connect analytics only if wanted; the current `dataLayer` events are not transmitted anywhere.

No production deployment, signup, email, or analytics configuration is performed by the local code changes alone.
