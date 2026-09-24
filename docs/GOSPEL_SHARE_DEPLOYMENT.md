# Gospel share deployment

The production share URL is:

```text
https://go.sifia.app/gospel/{secure-token}
```

The token is generated on the server, stored only as a SHA-256 hash, expires after 90 days, and may be revoked by its sender. A recipient's choice is stored only after they explicitly consent to share it. Reading progress and private choices are never stored.

## 1. Deploy the Supabase backend

From the project root, link the Supabase CLI to project `aesmrjinczhknchlrsmt`, then apply and deploy:

```sh
supabase link --project-ref aesmrjinczhknchlrsmt
supabase db push
supabase functions deploy create-gospel-share
supabase functions deploy gospel-share-public --no-verify-jwt
supabase functions deploy journal-impact --no-verify-jwt
```

The Gospel and Journal Impact migrations are `supabase/migrations/202609190001_create_gospel_shares.sql` and `supabase/migrations/202609240001_create_journal_impact_events.sql`. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions automatically.

The impact endpoint accepts anonymous device sync so account-free and offline Gospel sharing, routine completions, saved prayers, answered prayers, Bible Study activity, gratitude entries, and wins can be counted after a device reconnects. Summary reads remain admin-only. Impact rows contain event type, time, method, platform, and a one-way device-install hash; names, prayer text, reflection text, Bible Study notes, gratitude text, win text, messages, and response text are not included.

## 2. Deploy the recipient web experience

Use the dedicated SiteGround document root for `go.sifia.app`. The final production build must:

- serve the recipient app for `/gospel/*` so direct token links do not return 404;
- include the Gospel background assets used by the page;
- call `https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/gospel-share-public`;
- preserve the token in the browser address bar and never send it to analytics;
- use HTTPS only.

`docs/gospel-recipient-prototype.html` is the production recipient implementation (the legacy filename is retained so existing deployment configuration keeps working). Build the deployable directory with:

```sh
npm run build:gospel-web
```

Upload the contents of `dist/gospel` to the document root assigned to `go.sifia.app`. Upload the contents—not an additional nested `gospel` directory—and include the hidden `.htaccess` file. The build clears stale Gospel backgrounds and copies only the images used by the page.

The included `.htaccess` routes private links such as `/gospel/{secure-token}` to the recipient page. The included `_redirects` file provides the equivalent rule if the site is later moved to Cloudflare Pages:

```text
/gospel/* /index.html 200
```

## 3. Point `go.sifia.app` to the Gospel document root

Configure the `go.sifia.app` subdomain in SiteGround to use the directory containing the uploaded `dist/gospel` contents, and ensure HTTPS is enabled. Do not point this hostname at `journalby.sifia.app`; they are separate products and deployments under the same `sifia.app` parent domain.

## 4. Verify before release

1. Create a link while signed into Journal by SiFia.
2. Open it in a private browser with no app account.
3. Confirm the sender name loads without exposing a user ID or email.
4. Keep one answer private and confirm no database response is created.
5. Share one answer with consent and confirm only that answer appears for its sender.
6. Confirm another signed-in user cannot read the link or response rows.
7. Confirm an expired or revoked token displays an unavailable-link state.
8. Confirm the final app invitation is optional and is not reported to the sender.
9. Record an in-person Gospel share while offline, reconnect, and confirm the admin Gospel Impact count increases in the original event's date range.
10. Submit “Accepted Jesus as Lord and Savior” through both the guided app flow and recipient web page, and confirm each consented response increases the admin acceptance count once.
11. Complete a Morning routine and Evening reflection without an account, reconnect, and confirm each Journal Activity count increases once.
12. Save a prayer and later mark it answered, then confirm the prayer and answered-prayer counts each increase once without exposing the prayer text.
13. Create and finish a Bible Study, then confirm the created and finished counters each increase once.
14. Save and edit gratitude on the same local day, then confirm the gratitude counter increases only once and no gratitude text is uploaded.
15. Record and edit Today's Win on the same local day, then confirm the Wins recorded counter increases only once and no win text is uploaded.
