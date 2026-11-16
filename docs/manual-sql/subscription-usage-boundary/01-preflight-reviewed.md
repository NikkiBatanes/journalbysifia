# Subscription usage boundary preflight review

Reviewed: November 16, 2026. The user manually ran `01-preflight.sql` in the
existing siFia Supabase project. The agent did not execute SQL.

## Accepted metadata

- `public.user_subscriptions_new` and `public.validated_receipts` exist, are
  owned by `postgres`, and have RLS enabled but not forced.
- `usage_tracking`, `subscription_usage_tracking`, and `discount_codes` do not
  exist in the deployed project despite repository code that refers to them.
- The subscription row is unique by `user_id` and cascades from `auth.users`.
  Receipt transaction IDs are unique and receipts also cascade from Auth.
- Usage fields are integer columns. Only `refinement_count` has a reported
  nonnegative constraint; no equivalent deployed constraint was reported for
  playbook, devotional, or wisdom counters.
- Tier and status enums match the current application vocabulary.

## Confirmed authorization gap

Both `anon` and `authenticated` have effective SELECT, INSERT, UPDATE, DELETE,
TRUNCATE, REFERENCES, and TRIGGER privileges on both existing tables. RLS blocks
ordinary anonymous row access because `auth.uid()` is null, but these grants are
far broader than the required Data API surface; RLS does not protect every SQL
operation such as TRUNCATE.

The subscription table still has a permissive owner-scoped `ALL` policy plus
overlapping UPDATE/SELECT policies. It restricts rows, not fields, so an
authenticated owner can still attempt to set their own tier, limits, counters,
transaction IDs, family fields, and lifecycle state. The deployed trigger only
prevents one paid-to-trial overwrite case and does not establish server-owned
entitlements.

Receipt policies expose owner SELECT and service-role management, but table
grants are still excessive. The preflight did not invoke the Data API and does
not by itself prove which non-SELECT operations are reachable over HTTP.

## Existing functions are not accepted replacements

The database contains four overloads named `increment_usage_counter` or
`increment_usage_tracking`. Three are invoker-mode or accept caller-supplied
text/UUID identities; two definer overloads accept a target UUID. All four are
executable by PUBLIC, `anon`, and `authenticated`, and none reports a pinned
search path.

`create_free_trial_subscription(uuid)` and
`check_and_handle_expired_trials()` are also definer functions executable by
PUBLIC/anonymous users with no pinned search path. `check_trial_expirations()`
is public/anonymous invoker-mode. Function names and grants are enough to block
reuse, but not enough to state their exact behavior; a narrow source review is
required next.

Several aggregate subscription/renewal functions are also anonymous-executable.
They remain in the broader AJ-01 caller/privacy inventory and are not assumed
safe or unsafe without body and caller review.

## Design consequence

Do not extend or call an existing usage helper yet. The next read-only step is
`02-function-source.sql`, limited to the usage/trial functions and entitlement
trigger that could conflict with the new operation. After review, prepare a new
owner-derived, atomic, server-limit-aware operation rather than granting a
blanket target-user mutation.

No production mutation, grant change, policy change, or function invocation was
performed by this preflight.
