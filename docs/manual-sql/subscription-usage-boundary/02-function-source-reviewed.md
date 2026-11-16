# Subscription usage function source review

Reviewed: November 16, 2026. The user manually ran
`02-function-source.sql` in the existing siFia Supabase project. The agent did
not execute SQL or invoke any function.

## Conclusion

None of the eight legacy functions is suitable as the new mobile usage
boundary. Do not extend, call, or grant more access to them as part of this
increment.

## Function findings

| Function | Finding |
| --- | --- |
| `increment_usage_counter(text,text)` | Invoker-mode dynamic SQL accepts an unrestricted column name and supplied user text. RLS may scope rows, but the operation has no action allowlist, limit check, idempotency, or pinned path. |
| `increment_usage_counter(uuid,text,text,integer,integer)` | Definer function accepts an arbitrary user UUID and writes to missing `usage_tracking`; publicly/anonymous executable and currently broken. |
| `increment_usage_tracking(text,text,text)` | Invoker dynamic SQL accepts an unrestricted field and writes to missing `subscription_usage_tracking`; currently broken. |
| `increment_usage_tracking(uuid,text,text,integer)` | Definer function accepts an arbitrary user UUID and writes to missing `usage_tracking` plus legacy `subscriptions`; current analytics code calls this overload, but the Supabase error is not checked, so tracking can fail silently. |
| `create_free_trial_subscription(uuid)` | Definer function accepts an arbitrary target UUID and inserts into legacy subscription/intelligence tables. It is publicly/anonymous executable and is a separate AJ-01 risk. |
| `check_and_handle_expired_trials()` | Definer function performs a global downgrade of every expired trial and is publicly/anonymous executable. Its caller/cron compatibility must be proven before restricting it. |
| `check_trial_expirations()` | Invoker function updates the legacy `subscriptions` table globally by predicate. It is publicly/anonymous executable and has no repository caller. |
| `prevent_paid_to_trial_overwrite()` | Trigger blocks only active paid-to-trial replacement. It does not protect arbitrary tier/limit/counter changes and has an unpinned path. |

All eight lack a pinned search path. PUBLIC, `anon`, and `authenticated` can
execute every function in this review.

## Current caller boundary

Repository search finds one current mobile RPC caller among these functions:
`analyticsService` calls the UUID `increment_usage_tracking` overload. Supabase
RPC errors are returned in `{ error }` rather than thrown, so its `try/catch`
fallback does not run and the missing-table failure is silently ignored. This
is analytics debt, not authoritative entitlement usage, and must not be folded
into the new quota operation without an explicit product requirement.

No repository caller was found for the remaining seven functions. External
cron, older-client, or operator use is not disproven by repository absence, so
the functions will not be revoked in this first usage increment.

## Replacement direction

Prepare a new function with a distinct name and contract. It must:

- derive the owner from `auth.uid()` and accept no target user ID;
- accept only explicit actions (`playbook` or `devotional` for the first slice);
- make limit check and increment one locked transaction;
- return a minimal result and use fixed, sanitized errors;
- pin `search_path=''` and qualify every relation/function;
- support idempotent retry using a server-enforced per-user operation key;
- deny anonymous, cross-owner, arbitrary-field, negative-increment, and
  limit-exceeded attempts;
- coexist with old clients until the mobile switch and table-grant contraction
  are separately proven.

The first replacement will not reset counters, change tiers, validate receipts,
or revoke table writes. Those require their own trusted lifecycle operations and
compatibility evidence.
