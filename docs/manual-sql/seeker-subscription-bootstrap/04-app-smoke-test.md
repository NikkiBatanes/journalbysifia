# Seeker initializer app smoke test

Use only the two temporary accounts from `02-apply.sql` on a simulator/emulator
or test installation without valuable unsynced local data. Do not purchase,
start a trial, create authored content, or change subscription fields.

## siFia account A

1. Sign into siFia as temporary user A.
2. Open Profile/subscription and confirm the account is on the free Seeker tier.
3. Sign out, restart the app, and sign into A again.
4. Confirm Seeker still loads and no duplicate/error appears.

## siFia account B

1. Sign out of A and sign into temporary user B.
2. Confirm B receives its own Seeker subscription.
3. Switch back to A and confirm A still loads independently.

## Journal-only boundary

If the current Journal by siFia build exposes account sign-in, create a third
temporary Auth user C that has never opened siFia, sign into Journal only, and
confirm Journal account/profile access works. Do not open siFia with C. A later
read-only check must confirm Journal-only sign-in did not create a siFia Seeker
subscription. If Journal sign-in is unavailable, record `not implemented`.

After the app steps, run `04-app-smoke-verify.sql` manually before deleting the
test users. Expected: A and B each report `tier=seeker`, `status=active`; if C
was tested, `journal_only_user_has_sifia_subscription=false`.

Report only pass/fail, platform/build, and sanitized error codes. Do not share
emails, UUIDs, passwords, tokens, profile rows, or authored content. Any failure
stops cleanup and recovery decisions; do not run containment/rollback without
review.
