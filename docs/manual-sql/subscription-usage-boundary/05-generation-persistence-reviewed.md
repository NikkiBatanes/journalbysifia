# Generation persistence preflight review

Reviewed: November 16, 2026. The user manually ran
`05-generation-persistence-preflight.sql` in the existing siFia Supabase
project. The agent did not execute SQL or read customer rows.

## Accepted metadata

All seven target tables exist, are owned by `postgres`, and have RLS enabled but
not forced: `playbooks`, `devotionals`, `generation_queue`,
`onboarding_progress`, `onboarding_personalization_profiles`, `user_profiles`,
and `user_subscriptions_new`.

`playbooks` and `devotionals` have non-null UUID primary keys and owner foreign
keys cascading from Auth. Devotionals may reference a playbook but the foreign
key does not prove that both records have the same owner. Neither content table
has a generation operation/idempotency key.

## Existing queue is not the authoritative ledger

`generation_queue` already has useful workflow fields (`status`, `result_data`,
`result_id`, retry counters, and an onboarding boolean), but it does not satisfy
the security contract:

- `id`, `user_id`, and `created_at` are nullable;
- there is no primary key and no unique per-user operation key;
- the only unique constraint is `(id, created_at)` and nullable components weaken
  identity guarantees;
- clients may insert and update their own queue rows;
- `is_onboarding`, `context_data`, `additional_params`, and result fields are
  client-writable under the current table boundary;
- it has no transactional relationship with `playbooks_used` or
  `devotionals_used`.

Do not retrofit this table as the entitlement ledger in the first secure
increment. A dedicated server-owned operation table is narrower and safer;
queue compatibility can remain separate.

## Onboarding is not entitlement authority

The database has `user_profiles.onboarding_completed` plus one owner row in
`onboarding_progress`, but authenticated users currently have update paths to
both profile and onboarding state. `generation_queue.is_onboarding` is also a
nullable client-writable boolean. These fields may drive UX, but none may grant
free generation or provider priority as authoritative evidence.

The replacement needs a server-owned one-time benefit record. New clients must
not send a reusable `isOnboarding=true` authority flag. Existing users require
an explicit compatibility/backfill rule based on current counters and rollout
state, not mutable onboarding UI fields.

## Content-result decision

Use a new server-owned generation-operation identity and link each successful
result to it. The additive design should preserve current content IDs and old
clients while enforcing:

- unique `(user_id, operation_key)`;
- immutable action and request fingerprint per key;
- server-owned reservation/completion/failure state;
- an expiry for abandoned reservations;
- a stable `result_id` and action-specific result relation;
- one completion increment at most;
- no client writes to operation state or quota fields.

The versioned Edge Function should persist or locate the result before marking
the operation complete, then replay the same result for a retry. This avoids
double provider calls, duplicate content, and double quota consumption.

## Additional authorization debt

All inspected tables still expose very broad base grants to `anon` and
`authenticated`, including operations beyond their intended Data API surface.
RLS blocks ordinary cross-owner row access but does not create a field-level or
TRUNCATE boundary. Duplicate owner policies exist on playbooks, devotionals, and
profiles. These grants/policies should be contracted only after old-client
callers are migrated and tested; this preflight made no change.

Several generation/onboarding database helpers are PUBLIC/anonymous executable,
including definer functions that accept supplied UUIDs. Their exact source must
be reviewed before the new operation is named or implemented.

## Next step

Run `06-generation-function-source.sql` manually. It returns only catalog
function definitions for the six helpers that could overlap with queue claim,
content creation, or onboarding authority. No function is invoked.
