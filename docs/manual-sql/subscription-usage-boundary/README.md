# Manual preflight: trusted subscription usage boundary

Status: **read-only investigation complete and deferred from the Journal Cloud
launch path on November 16, 2026; no database change was executed**.

This package records siFia generation/subscription security debt. It is retained
for a separately approved siFia hardening effort and is not the authority for
Journal Cloud. Journal Cloud uses a dedicated server-owned entitlement; free
compatible-record sync does not require it.

## Why this comes first

The mobile write inventory is frozen at 16 direct subscription writes. Six are
usage reset/increment paths. Usage is a narrower migration boundary than store
purchases, but it still cannot be secured by checking row ownership alone: an
owner must not reset counters, raise limits, or consume against a forged tier.

The future trusted operation must derive the caller, use server-owned limits,
make limit-check plus increment atomic, define reset authority, and make retries
idempotent. Before drafting it, we need the deployed column types, constraints,
triggers, grants, policies, and existing helper identities.

## Run order

| Step | File | Status / purpose |
| ---: | --- | --- |
| 1 | `01-preflight.sql` | Completed and reviewed; metadata only |
| 2 | `02-function-source.sql` | Completed and reviewed; all eight legacy helpers rejected for reuse |
| 3 | `03-generation-enforcement-design.md` | Repository review completed; records why quota enforcement must be coupled to trusted generation |
| 4 | `04-deployed-generation-inventory.md` | Initial read-only CLI inventory completed; current handlers reviewed and unavailable queue-source evidence recorded |
| 5 | `05-generation-persistence-preflight.sql` | Completed and reviewed; existing queue/onboarding state rejected as entitlement authority |
| 6 | `06-generation-function-source.sql` | Completed and reviewed; all six helpers rejected for the new boundary; active onboarding RPCs require owner-bound compatibility hardening |

Do not run any further SQL from this folder unless a separate siFia hardening
increment is explicitly approved. No apply package is being prepared in this
track. Queue/onboarding/FaithPoints findings remain documented dependencies for
that future effort.

The agent must not execute this SQL. Do not run an apply/migration script; none
has been prepared. An unexpected result only changes the local design.

## What happens after review

If this siFia security track is resumed, the reviews show that the replacement
must be new rather than reuse an unsafe overload and must be coupled to trusted
generation. Any future apply package still requires baseline guards, synthetic
identities, concurrency/denial tests, independent verification, rollback, and
old-client compatibility evidence. Those requirements are not transferred to
the separate Journal Cloud entitlement design.
