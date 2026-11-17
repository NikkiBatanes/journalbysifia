# Journal Cloud entitlement preflight — accepted evidence

Run date: 2026-11-17  
Environment: existing siFia Supabase project  
Execution: user ran `01-preflight.sql` manually in Supabase SQL Editor

## Result

The metadata preflight passed for additive Journal Cloud entitlement design:

- PostgreSQL reports version 15.8 and the SQL Editor ran as `postgres`.
- `auth.users.id` is a non-null UUID with no client-supplied default.
- `anon` and `authenticated` exist without RLS bypass; `service_role` exists
  with RLS bypass as expected for trusted server operations.
- `pgcrypto` 1.3 and `uuid-ossp` 1.1 are installed in `extensions`.
- No relation exists under any schema with the intended names:
  - `journal_cloud_entitlements`
  - `journal_cloud_entitlement_sources`
  - `journal_cloud_billing_events`
  - `journal_cloud_webhook_inbox`
- No intended table has columns, constraints, policies, triggers, or client
  grants because the tables do not yet exist.
- No public function currently mentions Journal Cloud or RevenueCat.
- The intended enum names `journal_cloud_entitlement_state` and
  `journal_cloud_source_provider` are unused.
- Existing `user_subscriptions_new`, `validated_receipts`, and the hardened
  Seeker initializer remain present. They are legacy siFia objects and will not
  be modified or treated as Journal Cloud authority.

## Accepted design consequences

1. New Journal Cloud objects can be additive; no deployed-name migration is
   required.
2. Entitlements may use `auth.users(id)` as their owner foreign key.
3. The schema must enable RLS from creation and grant authenticated users only
   minimal owner-read access. Raw events and source rows remain server-only.
4. The trusted webhook transaction must use new names and must not write
   `user_subscriptions_new` or `validated_receipts`.
5. Production apply SQL remains gated. Exact Android product identifiers,
   server reconciliation response shape, guarded tests, verification,
   containment, and rollback must be finalized first.

No customer rows were inspected and no database mutation occurred.
