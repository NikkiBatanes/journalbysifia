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
```

The migration is `supabase/migrations/202609190001_create_gospel_shares.sql`. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions automatically.

## 2. Deploy the recipient web experience

Use a dedicated Cloudflare Pages project for the Gospel recipient site. The final production build must:

- serve the recipient app for `/gospel/*` so direct token links do not return 404;
- include the Gospel background assets used by the page;
- call `https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/gospel-share-public`;
- preserve the token in the browser address bar and never send it to analytics;
- use HTTPS only.

`docs/gospel-recipient-prototype.html` is the production recipient implementation (the legacy filename is retained so existing deployment configuration keeps working). Build the deployable directory with:

```sh
npm run build:gospel-web
```

In Cloudflare Pages, use that command as the build command and `dist/gospel-share` as the output directory. The build copies only the page and Gospel images it needs.

For a static Cloudflare Pages deployment, add a `_redirects` file to the published directory:

```text
/gospel/* /index.html 200
```

## 3. Attach `go.sifia.app`

In the Gospel Pages project, choose **Custom domains**, add `go.sifia.app`, and allow Cloudflare to create the DNS record and certificate. If DNS is managed manually, use the exact CNAME target Cloudflare shows for that Pages project. Do not point this hostname at `journalby.sifia.app`; they are separate products and deployments under the same `sifia.app` parent domain.

## 4. Verify before release

1. Create a link while signed into Journal by SiFia.
2. Open it in a private browser with no app account.
3. Confirm the sender name loads without exposing a user ID or email.
4. Keep one answer private and confirm no database response is created.
5. Share one answer with consent and confirm only that answer appears for its sender.
6. Confirm another signed-in user cannot read the link or response rows.
7. Confirm an expired or revoked token displays an unavailable-link state.
8. Confirm the final app invitation is optional and is not reported to the sender.
