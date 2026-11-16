# Read-only deployed generation inventory

Status: **initial read-only deployed inventory completed November 16, 2026**.
Authentication succeeded without exposing the access token. No SQL, function
invocation/deployment/deletion, or database operation was performed.

This is not SQL and does not deploy, invoke, or modify an Edge Function. Its
purpose is to compare the deployed function inventory/source with repository
assumptions before the usage reservation schema is finalized.

## Safety rules

- list functions before downloading anything;
- never run `supabase functions deploy` or `delete` in this increment;
- download only the generation functions confirmed by the list;
- download into a temporary directory, never over the repository source;
- do not invoke generation, touch customer rows, or print secrets;
- record function name, version/status, deployed JWT verification metadata when
  available, and a source digest; do not commit downloaded production source.

## Target evidence

- the deployed playbook function called by current clients;
- the deployed devotional function called by current clients;
- any older generation names still deployed for supported clients;
- whether each endpoint verifies JWTs;
- whether deployed code derives the user and tier or trusts request-body values;
- whether the endpoint currently performs an authoritative quota decision;
- where a successful result is persisted or recovered for idempotent retry.

After this evidence is reviewed, prepare—but do not execute—the guarded
reservation/ledger SQL package and the matching versioned Edge Function change.

## Accepted deployed inventory

| Function | Version | Status | JWT | Source evidence |
| --- | ---: | --- | --- | --- |
| `generate-guided-playbook-v2` | 3139 | ACTIVE | verified by gateway | downloaded to temporary storage and reviewed |
| `generate-devotional` | 17754 | ACTIVE | verified by gateway | downloaded to temporary storage and reviewed |
| `generate-playbook` | 17891 | ACTIVE | verified by gateway | downloaded as legacy archive to temporary storage and reviewed |
| `generate-guided-playbook` | 13613 | ACTIVE | verified by gateway | downloaded to temporary storage and reviewed |

The current repository invokes `generate-guided-playbook-v2` and
`generate-devotional`. The downloaded production source was not committed. Its
main-file SHA-256 digests are retained only as comparison evidence:

- current guided playbook: `ea7d75918e8f247594c72e41e5ae7a7ba557432b0dba31f9f8d152626962b25c`;
- current devotional: `2f764ed761b911546140954e897f3811fc6385b4933a1d96005e2f6b9cd27f61`;
- legacy playbook: `6590f8d0c2d40d034be2b4bec19908ecfba0012a0bfb4c8ffbea4ea89a49b32a`;
- legacy guided playbook: `778560d2920558bd9dd4e9b193d14594e525ded8906ff0016009270dba4c7e86`.

Only the legacy guided main file matched its current repository counterpart.
The other three differed, so repository source alone is not deployment proof.

## Confirmed generation boundary

- JWT verification blocks anonymous calls to the four reviewed generators, but
  the handlers do not perform an authoritative subscription/quota decision.
- The reviewed handlers accept request-body `userId`, `userTier`, or
  `isOnboarding` values for recent-title context or provider-key selection.
  These values are not suitable as entitlement authority.
- The guided playbook handler uses a service-role client to query recent titles
  by the body-supplied user ID instead of the authenticated caller.
- The devotional handler uses a service-role client to fetch playbook text by a
  body-supplied playbook ID without an owner predicate. A signed-in caller who
  obtains another record ID could cause private text to enter a derived prompt;
  the owner relationship must be enforced before this path is retained.
- Both current handlers return generated content without persisting an
  idempotent server result. The mobile client saves the playbook/devotional and
  updates usage separately. Devotional usage also has more than one client-side
  increment site, so retry/double-count behavior requires contraction.
- The in-memory rate limiter is not the subscription quota ledger. The guided
  handler keys it with the bearer token string, which changes as sessions
  refresh; it is not a durable per-account quota.

## Unresolved active endpoints

The deployment list also contains older/test generators and queue entry points.
`process-playbook-queue` is ACTIVE with `verify_jwt=false`. Supabase returned
`Function store not found` for both supported download modes for these four:

- `start-playbook-generation`;
- `start-guided-playbook-v2`;
- `process-playbook-queue`;
- `process-playbook-queue-cron`.

Their source is not present in the current repository, so handler-level secret
or caller validation cannot be inferred. This is a release/security dependency:
prove legitimate callers and internal authentication, or retire the endpoints,
before declaring the generation boundary closed.

## Next evidence

Run `05-generation-persistence-preflight.sql` manually. It inspects metadata
only for content persistence, queue, onboarding, profile, and subscription
tables. Its result determines whether an existing durable identity can be used
or a new operation/result ledger is required.
