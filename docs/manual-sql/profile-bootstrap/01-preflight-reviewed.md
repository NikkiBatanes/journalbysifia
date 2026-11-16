# User-run preflight review

Reviewed: 2026-11-04. Source: the user manually ran `01-preflight.sql` in the
Supabase `siFia` project and supplied its metadata JSON in chat. The result
does not identify a project ref; record the project name as user-reported.
Treat this as the existing app database, not a confirmed staging environment.

| Check | Supplied result | Review |
| --- | --- | --- |
| Function and audited definition | Exists; MD5 `53e81822358e124a7b15a6b9153241e2`; audit match true | Matches the apply draft's baseline |
| Function ownership/mode | Owner `postgres`; security definer true | Matches the audited shape |
| Required profile columns | None missing; non-null UUID ID and text email | Matches the expected identity columns |
| Profile RLS | Enabled | Present; does not replace function authorization |
| Execute access | PUBLIC, postgres, anon, authenticated, service_role; anon/authenticated execution true | Confirms the broad execute access remains unchanged |
| Auth-user triggers | Empty | None reported by this query |
| Referencing function candidates | Empty | No textual candidates detected in the queried schemas; dynamic/external dependencies remain outside this check |

The **baseline preflight is accepted**, not a security pass or a successful fix.
No apply script, database verification, synthetic assertions, or real-session
compatibility tests have been reported as executed. Server remediation remains
pending and overall implementation stays approximately 13%.

No approved separate staging target has been identified. A non-SQL management
listing showed only `siFia` active; other inactive projects must not be assumed
available or repurposed. No project was created/resumed or modified.

A staging project means a separate Supabase test backend with matching relevant
database structure and synthetic accounts/content. It should not copy customer
journals. No such project was created. On 2026-11-16, after discussing the cost
constraint and risk, the user chose a guarded live transaction for this one
narrow helper. The prepared transaction repeats the accepted baseline checks,
requires two new temporary Auth identities, applies the function, runs owner/
cross-owner/anonymous assertions, rolls synthetic profile writes back to a
savepoint, verifies the hardened shape, and commits only if every statement
succeeds. Real app smoke testing and containment remain required afterward.

This documented exception is not equivalent to staging and does not apply to
entitlements, deletion, receipt binding, sync, cloud storage, or billing. The
agent continues to execute no SQL. Current user dependency: review the guarded
runbook and create the two temporary users only when ready to proceed.
