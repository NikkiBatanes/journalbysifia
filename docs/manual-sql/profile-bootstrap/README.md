# Manual security fix 1: owner-bound profile bootstrap

Status: **deployed, verified, smoke-tested, and cleaned up for this narrow
helper**. The guarded production apply, integrated synthetic assertions,
independent deployed metadata check, real app A/B smoke test, and temporary-user
cleanup passed.
The user-run preflight passed for the existing siFia project.
On 2026-11-16, the user manually ran `02-apply.sql` and supplied the expected
success result: deployment committed, synthetic assertions passed, and no
synthetic profile rows persisted.

The user then manually ran `03-verify.sql`. The deployed helper exists as
`create_default_user_profile(uuid,text)`, is owned by `postgres`, remains a
security-definer function, has `search_path=""`, denies PUBLIC/anonymous
execution, permits authenticated execution, and carries the expected guarded
deployment marker. Recorded deployed definition MD5:
`569bb4004827e98027690d98ea33af59`.

The user completed all eight siFia smoke-test steps successfully and completed
the Journal by siFia sign-in/profile checks successfully. Journal displayed the
temporary account name while authenticated and returned to the device's local
name after logout. This is the expected separation between the optional cloud
identity and the independent local-only Journal profile; it is not evidence of
cross-account leakage. No authored test content was created. Platform was not
reported.

The user deleted both temporary Auth users and manually ran
`07-cleanup-test-profiles.sql`. Cleanup returned `auth_users_present=false`,
`profiles_deleted=0`, and `temporary_profile_cleanup=passed`. Zero profile
deletions means the existing Auth-user deletion path had already removed the
synthetic profiles; the cleanup guard confirmed neither test UUID remained.

This fixes one part of audit finding AJ-01. It does not fix the other privileged
functions, client-writable subscription entitlements, receipt ownership,
deletion handlers, shared Journal sync, or Journal Cloud.

## Operating rule

All SQL is run manually by the user in Supabase SQL Editor. The agent prepares
and reviews files but does not execute SQL through the CLI, API, browser, or a
database connection. These files are outside `supabase/migrations`, so normal
migration tooling will not apply them automatically.

The chosen route does not require a paid staging project. It is a guarded live
deployment with synthetic accounts, transactional assertions, a post-deployment
app test, containment, and a last-resort rollback. This reduces risk but is not
equivalent to rehearsing the full app against an isolated staging backend.

## What changes

The existing definer function accepts a supplied user ID and email, can update
that profile, and returns it without binding the request to the signed-in user.
The replacement:

- requires `auth.uid()` to equal the requested profile owner;
- derives the email from `auth.users` and ignores the legacy email argument;
- keeps the existing function signature for older app builds;
- preserves existing default fields and updates only email/`updated_at` on an
  existing owner profile;
- pins an empty search path;
- removes PUBLIC and anonymous execution while retaining authenticated use;
- propagates authorization failures instead of logging private identifiers and
  converting every server failure to `NULL`.

Both apps already have local client guards that obtain the verified current
identity before calling this fallback helper and reject a mismatched response.
Those tests passed locally, but client checks cannot replace server enforcement.

## Before running anything else

The accepted `01-preflight.sql` result is recorded in
`01-preflight-reviewed.md`. Do not run `02-apply.sql` until all of these are true:

1. Create two **new temporary Auth test users** through the normal Supabase
   Authentication/Dashboard flow. Use email addresses you control and passwords
   suitable only for testing. Do not use a customer, owner, or administrator.
2. Record each test user's UUID and exact Auth email privately. Do not paste
   passwords, access tokens, UUIDs, or emails into chat.
3. Do not open either app with those accounts yet. The guarded script requires
   both users to have no `public.user_profiles` row so it can prove fresh profile
   creation and then roll it back.
4. Open a fresh copy of `02-apply.sql` in Supabase SQL Editor and replace its
   four `REPLACE_WITH_*` values **in the editor only**. Do not save real test
   identifiers into the repository file.
5. Run during a quiet period and keep this runbook, `03-verify.sql`, and
   `05-containment.sql` open.

The script refuses to proceed if placeholders remain, the UUID/email pairs do
not match `auth.users`, either test user already has a profile, or the audited
function/schema baseline has drifted.

## Run order

| Step | File/action | Success condition |
| ---: | --- | --- |
| 1 | `01-preflight.sql` | Already completed and accepted for the existing project; `02` repeats its critical drift guards |
| 2 | `02-apply.sql` | One result with `deployment_committed: true`, synthetic assertions passed, and no synthetic profile rows persisted |
| 3 | `03-verify.sql` | Owner `postgres`; definer true; `search_path=""`; PUBLIC/anon false; authenticated true; 2026-11-16 deployment marker present |
| 4 | `04-app-smoke-test.md` | Test users A and B can sign in, load separate profiles, sign out, and switch accounts without leakage |
| 5 | Remove temporary accounts | Only after the smoke test evidence is reviewed; delete them through the Supabase Authentication dashboard |
| 6 | `07-cleanup-test-profiles.sql` | After Auth-user deletion, zero to two matching synthetic profile rows are removed and neither test UUID remains |

Share only the JSON result from steps 2 and 3 plus the sanitized pass/fail smoke
checklist. Never share passwords, tokens, complete profiles, or authored content.

## How the guarded transaction works

`02-apply.sql` performs the following in one manually submitted script:

1. Validate the two synthetic identities and the previously audited baseline.
2. Replace only `public.create_default_user_profile(uuid,text)` and its execute
   grants.
3. Create a savepoint after the function replacement.
4. Simulate authenticated test user A at the database role/claim boundary.
5. Prove owner creation, server-derived email, repeat-call field preservation,
   cross-owner denial, null/missing-owner denial, and anonymous denial.
6. Roll back to the savepoint, removing the synthetic profile writes while
   retaining the function replacement in the outer transaction.
7. Recheck function security properties and confirm neither synthetic profile
   exists.
8. Commit and require the deployment marker to exist after commit.

Any unexpected assertion raises an error. If the editor reports **any error**,
the deployment is not a pass. Run `ROLLBACK;` in a new SQL Editor query, stop,
and share only the sanitized error text. Do not retry by removing a guard.

The database assertions simulate JWT claim state inside PostgreSQL. They do not
prove real gateway token validation, native session switching, email/Google/Apple
sign-in, or every old app version. That is why the app smoke test remains
mandatory immediately after verification.

## Failure and recovery

| Option | When to use | Security effect |
| --- | --- | --- |
| Automatic transaction rollback | Any error before `COMMIT` | Leaves the previously audited function unchanged |
| `05-containment.sql` | Hardened helper committed but missing-profile repair must be disabled while investigated | Removes client execution; safer than restoring the vulnerability, but new/missing profile repair may return null |
| `06-restore-audited-baseline.sql` | Last-resort service recovery after a specific reviewed production failure | Restores the known insecure behavior and reopens AJ-01; replace with a corrected forward fix urgently |

`07-cleanup-test-profiles.sql` is not a recovery script. It is the narrow
post-test cleanup, guarded by both test UUIDs/emails and by requiring the Auth
users to have already been removed. It safely reports zero deletions when Auth
deletion already cascaded to the profiles.

Do not run either recovery file preemptively. The preferred response after a
post-commit defect is containment plus a corrected forward patch. The baseline
rollback exists only when service restoration outweighs the explicitly accepted
temporary security exposure.

## Verification already completed locally

- Journal focused auth/subscription-boundary tests: 3 suites, 38 tests passed.
- siFia focused auth tests: 2 suites, 30 tests passed.
- Changed auth TypeScript lint passed in both repositories.
- Journal full TypeScript check passed.
- siFia retained only its six previously documented onboarding type errors.

No database SQL or real-session test was executed by the agent. The user-run
apply, metadata verification, and app smoke test are accepted as deployed
evidence for this narrow helper. Phase 2 is now conservatively 5% complete;
overall Shared Journal delivery is 13.3%, still reported as approximately 13%.
This does not close the remaining privileged-RPC, entitlement, receipt,
deletion, sync, storage, or billing findings.

## Following security work

The source inventory found additional privileged RPCs and 32 direct siFia mobile
subscription-write sites. Those require compatible authenticated server
operations before permission revocation. A successful profile-helper deployment
closes only this narrow function; it is not approval to enable shared sync, paid
cloud authorization, private media, or backup infrastructure.
