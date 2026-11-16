# User-run Seeker bootstrap preflight review

Reviewed: 2026-11-16. The user manually ran `01-preflight.sql` in the existing
siFia Supabase project and supplied its metadata JSON.

| Check | Result | Review |
| --- | --- | --- |
| Function baseline | Exists; MD5 `1375a3a42b6e82c8bee176040ddca33a`; audit match true | Accepted audited definition |
| Ownership/mode | `postgres`; `SECURITY DEFINER`; returns `void`; search path unpinned | Expected vulnerable baseline |
| Function execution | PUBLIC, anon, authenticated, service role; anon true | Confirms narrow AJ-01 exposure remains |
| Table | RLS enabled; required columns present | Structural prerequisite passes; RLS does not protect a definer function |
| Identity | Non-null UUID `user_id`; unique; Auth FK with `ON DELETE CASCADE` | Supports idempotent owner row and test cleanup |
| Enum values | `seeker` and `active` exist | Fixed initializer values are valid |
| Database callers | No Auth triggers or textual function candidates reported | No reported database dependency blocks owner binding; dynamic/external callers remain outside this scan |
| Client table access | Authenticated has CRUD plus REFERENCES/TRIGGER/TRUNCATE; permissive PUBLIC-role owner-management policies exist | Confirms AJ-02 remains; do not claim table entitlements are secured by this function patch |

The preflight is accepted for a guarded replacement of this one function. It is
not authorization to revoke subscription-table writes, enable Journal Cloud, or
trust the current subscription row as a paid entitlement. No apply, verification,
synthetic runtime test, or app smoke test has yet been reported.
