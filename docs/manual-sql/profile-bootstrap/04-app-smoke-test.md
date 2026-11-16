# Post-deployment app smoke test

Run this checklist immediately after `02-apply.sql` and `03-verify.sql` both
succeed. Use temporary test accounts only. Do not test with customer content.

## Test A: intended owner flow

1. Sign into siFia as temporary test user A.
2. Open Profile and confirm it loads without an authorization error.
3. Sign out completely, reopen the app, and sign in again as A.
4. Confirm Profile still opens and shows only A's account.
5. If Journal by siFia has the account connection screen available in the
   current build, sign in as A there and confirm it recognizes A. Do not enable
   unfinished sync or cloud paths.

Expected result: sign-in and missing-profile recovery work normally. The app
must not show another identity or require anonymous profile creation.

## Test B: account separation

1. Sign out of A and sign into siFia as temporary test user B.
2. Open Profile and confirm B receives a separate profile.
3. Sign out and sign back into A.
4. Confirm A still sees A's profile and no field from B.

Expected result: both accounts work independently. Switching accounts never
reuses the other account's profile response.

## Failure response

- Capture the exact screen and time, but do not paste tokens, passwords, journal
  text, or complete profile records into chat.
- Do not restore anonymous access as a quick workaround.
- For a missing-profile failure, run `05-containment.sql` only if instructed;
  existing profiles and direct owner-scoped profile operations are unaffected.
- `06-restore-audited-baseline.sql` is a last-resort service rollback because it
  deliberately restores the known authorization weakness. Use it only after a
  specific review of the failure and the temporary exposure.

## Completion evidence

Record only:

- platform and app build tested;
- email, Google, or Apple sign-in route used;
- A profile load: pass/fail;
- B profile load: pass/fail;
- sign-out/account switch: pass/fail;
- whether a new profile was created or an existing one loaded;
- any sanitized error code.

Successful smoke testing does not close all of audit finding AJ-01. It validates
this one owner-bound helper through the real app/session path.

After the result is reviewed, delete both temporary Auth users in the Supabase
Authentication dashboard, then run `07-cleanup-test-profiles.sql` manually to
verify no synthetic profile row remains.

## Recorded result — 2026-11-16

- siFia owner, re-login, second-account, and account-switch steps: passed.
- Journal by siFia temporary-account sign-in/profile: passed.
- Journal logout returned to the independent device-local name: passed and
  expected for local-only mode.
- Authored test content: none created.
- Platform: not reported.
- Temporary Auth users: removed.
- Profile cleanup verification: passed; zero remaining rows needed deletion.
- Remaining action: none for this narrow helper.
