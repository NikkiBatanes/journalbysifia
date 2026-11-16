# Generation enforcement design gate

Scope status: deferred from the Journal Cloud launch path on November 16, 2026.
Retain for a separately approved siFia generation-security increment. Do not
apply it as Journal Cloud entitlement infrastructure.

Reviewed: November 16, 2026. This is a repository-source review only. It does
not establish which Edge Function source or JWT configuration is deployed, and
it makes no database or function change.

## Decision

Do not deploy a standalone mobile-called usage counter as the enforcement
boundary. A modified client could omit that call and invoke generation
directly. The authoritative quota decision must be coupled to the trusted
playbook/devotional generation path.

The target request flow is:

1. the Edge Function validates the caller's JWT and derives the account;
2. it ignores client-supplied user, tier, limit, and onboarding authority;
3. it reserves one allowlisted action with a per-user operation key in one
   locked database transaction;
4. only an accepted reservation may invoke the paid generation provider;
5. completion is recorded idempotently; a retry cannot consume twice or create
   an additional generation under the same operation key;
6. a failed/interrupted reservation follows a bounded, auditable release or
   expiry rule.

The mobile app may provide an opaque operation UUID and action, but those are
not authority. The server owns identity, entitlement, limit, lifecycle state,
and onboarding eligibility.

## Repository evidence

- `NewSubscriptionService.incrementUsage` performs a client read/check followed
  by a direct update to `user_subscriptions_new`.
- the devotional mutation generates first and attempts the client-side counter
  increment in `onSuccess`; increment failure is logged without retracting the
  generated content;
- the repository Edge Function request types accept client-provided `userId`,
  `userTier`, or `isOnboarding` in generation paths;
- the guided playbook repository function uses a body-supplied `userId` for
  service-role recent-title lookup;
- the repository functions rate-limit using a bearer token string or a decoded
  identifier, not a durable distributed quota ledger;
- local `supabase/config.toml` does not prove the deployed function source or
  deployed JWT setting.

These observations are compatibility and security inputs, not proof that the
same source is live.

## Required evidence before apply SQL

1. Inventory the exact deployed playbook and devotional function names used by
   current iOS and Android clients.
2. Retrieve or compare their deployed source/version and JWT verification
   configuration without changing them.
3. Define where generated results are durably saved so an idempotent retry can
   return or locate the original result instead of generating twice.
4. Define onboarding eligibility from server-owned evidence. Do not accept a
   reusable client `isOnboarding=true` bypass.
5. Define legacy-client behavior for requests that do not send an operation
   key, including retry and rollback behavior.

## Expand-and-contract order

| Order | Increment | Live effect |
| ---: | --- | --- |
| 1 | Deployed generation/configuration read-only inventory | None |
| 2 | Guarded reservation/ledger SQL package and synthetic tests | Manual apply only after review |
| 3 | Versioned Edge Function integration using authenticated owner context | New path; old path retained |
| 4 | iOS/Android switch with stable operation UUIDs | Updated clients use trusted path |
| 5 | Observe retries, failures, quota decisions, and old-client traffic | Monitoring only |
| 6 | Enforce the trusted path and contract direct table writes | Security contraction after compatibility evidence |

The first SQL package must not revoke existing writes, reset counters, alter
tiers, or deploy Edge Functions. Those are separately reversible increments.
