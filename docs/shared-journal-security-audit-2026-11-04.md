# Shared Journal: first deployed security audit

Date: 2026-11-04, Asia/Manila. Status: **read-only evidence collected; remediation required before shared-sync/cloud launch**.

Both repositories link to the same Supabase project, named `siFia`, in `ap-southeast-1`. The account authenticated through the CLI can inspect this project. The audit used metadata SELECTs under the `postgres` inspection role, function-list metadata, and one successfully downloaded deployed Edge Function source. It did not read journal bodies, profiles, receipts, storage object paths/bytes, or other customer rows. No application RPC, account-deletion function, billing request, migration, or deployment was executed.

The results establish configuration and source-level findings. They do not prove that an attacker has used them, or replace account-A/account-B/anonymous tests against synthetic staging data.

## Evidence and reproducibility

| Material | Result / boundary |
| --- | --- |
| `scripts/audit-shared-journal-schema.sql` | Executed successfully: 8 named targets, 127 columns, 46 policies including Storage, 30 constraints, 45 indexes, 6 triggers, 687 function-grant rows |
| `scripts/audit-shared-journal-security-surface.sql` | Executed successfully: 14 additional relations, 212 columns, 63 policies, 63 definer functions, 6 views, role/default-grant metadata |
| Private catalog source review | 168 public relations enumerated: 162 base tables and 6 views. Retrieved definitions for 63 definer functions and 3 timestamp-trigger functions; reviewed selected high-risk bodies, not a complete semantic review of all 63 |
| Subscription/deletion enforcement query | Inspected relevant trigger wiring, trigger bodies, and constraints before classifying entitlement write access |
| Edge deployment inventory | 42 active functions; captured versions and JWT-verification flags without invoking handlers |
| Deployed `validate-receipt` | API source download succeeded; reviewed handler identity and receipt-ownership flow |
| Deployed deletion handlers | `delete-account` API download returned an unsupported content type; Docker fallback reported extraction but yielded no inspectable source in the target directory. `process-account-deletions` API download returned “Function store not found.” Their deployed bodies remain unverified |

Raw catalog definitions and deployed source are kept outside Git in a private local evidence directory:

`/Users/nikkimaebatanes/.local/share/sifia/audits/2026-11-04-security-kfl6ee2c`

The directory is mode `0700`; evidence files are mode `0600`. `manifest.json` records individual SHA-256 digests and repository heads. Its SHA-256 is `b56d9b4217f0688fc7102e83390b171e5b4a8f478c53858a5f9eeb01f0716e48`. Deployed receipt-source SHA-256: `1ce20c0cf63af31cda5ce9df6cdeb3c4bd35ac6501cac0616d5a870547630fc6`. No tokens, account identifiers, admin-email allowlists, raw function bodies, or customer data are copied into this report.

The user now requires all SQL to be run manually in the Supabase SQL Editor, including future read-only audits and staging tests. The earlier audit executions predate that instruction. Re-run the two repository SELECT scripts manually to refresh the metadata reports; the agent must not execute them. Inspect function bodies separately in private storage; the reusable scripts deliberately exclude them. Do not call a mutating RPC to demonstrate a finding on production.

## Confirmed foundations

- The six existing content tables—`journal_entries`, `reflection_entries`, `prayers`, `time_blocks`, `devotionals`, and `playbooks`—exist, have non-null owners, and have RLS enabled. Their inspected client policies use owner predicates. All 162 enumerated public base tables have RLS enabled; this is a flag check, not a review of every policy on those tables.
- All six public views report `security_invoker=true`. Anonymous/authenticated roles lack schema-CREATE and RLS-bypass privileges. The service role has RLS bypass, as expected; its callers therefore need explicit authorization.
- Four reviewed admin RPCs explicitly call `public.is_admin()`. That helper checks the authenticated identity against `auth.users`, rather than trusting an editable profile email. Broad execute access is therefore not automatically a vulnerability for every definer function.
- The only Storage bucket is `avatars`: public, 5 MiB, JPEG/PNG/WebP. Its inspected write policies scope object paths to the authenticated user's ID. Public avatar access is intentional and does not provide private Journal storage.
- The existing `UPDATE` policies that omit `WITH CHECK` are not automatically missing an ownership check: PostgreSQL can reuse `USING` for that purpose. Likewise, an owner-scoped policy does not restrict which fields an owner can change.

## Findings and required action

P0 means address before expanding access or relying on this system for paid cloud. It is a remediation priority, not a claim of observed exploitation. Findings apply to the existing shared backend, not just future Journal features.

| ID / priority | Evidence | Consequence / required action |
| --- | --- | --- |
| AJ-01 — P0: privileged RPC authorization | 63 public-schema `SECURITY DEFINER` functions exist; 57 are executable by `anon`, 61 by `authenticated`. Reviewed `create_default_user_profile(uuid,text)` accepts a supplied owner, updates the profile email on conflict, and returns the complete profile without a caller check. `claim_next_playbook_job` changes global queue state; `queue_notification` accepts a supplied recipient without an identity check. These functions are owned by `postgres` | Confirm each legitimate caller; restrict worker/admin functions to trusted server paths and authenticate/authorize per-user functions. Use an explicit caller/owner check, input limits, and minimal response fields. Revoke both inherited PUBLIC and direct unwanted grants. Test every overload and preserve necessary old-client behavior. No production exploit request was sent; exact HTTP exposure remains an additional check |
| AJ-02 — P0: client-writable entitlements | `user_subscriptions_new` has an owner-scoped `ALL` policy and table-level INSERT/UPDATE/DELETE grants to authenticated clients; the legacy `user_subscriptions` table also allows owner writes. Tier/status/limit fields are in those tables. The inspected trigger only prevents an active paid tier from being overwritten with `free_trial` | Owners can submit changes to entitlement fields; row ownership is insufficient protection. Make entitlement state server-owned and separate user-editable billing/preferences fields. Require verified provider events and durable, idempotent ownership mapping. Test denied self-upgrade, forged limits, family reassignment, deletion, and stale/replayed events before using any entitlement to authorize Journal Cloud |
| AJ-03 — P1: receipt-to-account binding | Deployed `validate-receipt` has gateway JWT verification enabled, but its handler reads `userId` from the request and uses a service-role client without obtaining/comparing the caller identity. It upserts receipts on `transaction_id` while supplying `user_id` from that request | A valid receipt and a valid request identity are separate checks. Derive the target account from verified identity; bind transactions to the original account and use an explicit, audited restore/transfer policy. Prevent an upsert from silently reassigning an existing receipt. Derive trial eligibility on the server. Do not reuse this path unchanged for Journal Cloud |
| AJ-04 — P1: account deletion and cancellation | Repository `delete-account` code trusts a body-supplied owner before admin operations; its deployed body is unverified. Repository processor lacks a handler-level internal-caller check, ignores returned deletion errors, and may mark completion despite auth-deletion failure. Live `account_deletions` policies have owner INSERT/SELECT but no owner cancellation UPDATE, while the mobile cancellation method treats an error-free zero-row update as success | Retrieve deployed deletion source before asserting production exposure. Bind requests to verified identity; protect the processor with internal authorization. Use server-owned grace periods and an authorized conditional cancellation operation that confirms a row changed. Track per-stage deletion failures and retries across both apps; do not report completion until required data/auth/media work succeeded |
| AJ-05 — P1: sync safety protocol absent | Shared text tables lack the planned revision/tombstone/change-feed fields. Time Blocks have a `version` column, but the inspected update trigger only changes `updated_at`; it does not enforce compare-and-swap. Existing policies allow hard deletion | Add a server-enforced conditional mutation protocol, durable ordered changes, idempotency/merge ledger, and recoverable tombstones. Capture legacy writes through the audited compatibility path. A timestamp or an existing version column alone is insufficient to prevent lost updates |
| AJ-06 — P1: private backup/media infrastructure absent | Only the public avatar bucket exists. No private Journal extension/media/snapshot bucket was present | Add separate private storage, owner/device/entitlement enforcement, staged upload/finalization, encrypted payloads and key enrollment/recovery. Verify independent DB and object recovery, retention, and restore integrity. Keep journal files out of `avatars`; present cloud coverage only after a verified recoverable snapshot exists |
| AJ-07 — P2: excessive privileges and search paths | Client roles have TRUNCATE/REFERENCES/TRIGGER grants on the six core tables in addition to CRUD. 57 of 63 definer functions lack a pinned `search_path`; current client roles cannot create in `public` | Reduce current/default grants after caller tracing and stage testing. Pin trusted search paths and qualify relations. RLS does not cover TRUNCATE/REFERENCES; this is privilege hardening, not evidence of an HTTP TRUNCATE endpoint or a demonstrated search-path exploit |
| AJ-08 — P1 compatibility gate: actual schema differs | Generic `action_steps`/`faithful_actions` targets do not exist. Real related tables include `playbook_action_steps`, `playbook_sub_tasks`, and `playbook_screens`. `playbooks.action_steps` also exists as a column. `reflection_entries` lacks `question_topic`, `journal_classification`, `guided_journey`, and `journal_blocks` declared by the Journal API interface | Correct the remote inventory and keep provenance for each persistence family. Never spread the Journal DTO into the current table or migrate private advanced content into shared text merely to make an insert work. Add owner-scoped field adapters and test real deployed column/enum shapes |
| AJ-09 — P1 compatibility gate: Time Block identity | Deployed constraint `UNIQUE(user_id, selected_date, start_time)` rejects distinct blocks with the same start time. Recurrence has several legacy fields; calendar IDs and alert configuration are stored in the current remote table | Decide compatibility for simultaneous distinct blocks before initial merge. Preserve stable record identity and require explicit conflict handling; never deduplicate by start time. Keep recurrence mapping gated, and do not reapply another installation's calendar IDs/alarms |

## Important interpretation limits

The family-profile SELECT policy text includes a broad-looking subquery. It must be evaluated together with RLS on `user_subscriptions_new`; its appearance alone does not prove cross-family disclosure. Self-editable family association fields are part of AJ-02 and require an explicit family-owner/member authorization test matrix.

The current admin helper reads `auth.users`; changing a profile's contact email through AJ-01 is not proof of changing Auth credentials or gaining admin access. The profile return value still makes AJ-01 a serious privacy issue.

Metadata inspection ran as `postgres` and did not exercise client roles against customer data. The session-level `pgrst.db_schemas` setting returned null, so it does not certify the deployed Data API exposed-schema configuration. Verify that configuration and use synthetic staging requests for client-denial tests. Do not infer “safe” from all tables having RLS enabled, or “unsafe” solely from RLS not being forced for table owners.

Backup schedule/PITR retention, independent object backup, OAuth/email controls, webhook-signature correctness, signed download behavior, rate limits, and complete Edge Function authorization were not certified by this pass. Eleven deployed functions report `verify_jwt=false`; some are intentionally public/webhook endpoints and require their own validation. Review each handler rather than assuming that flag alone proves a vulnerability.

## Implementation order and proof required

| Step | Deliverable | Exit evidence |
| --- | --- | --- |
| 1 | Inventory app/server/cron callers for privileged RPCs and subscription writes; map both apps' deletion and billing lifecycle | Every changed operation has a known legitimate caller; unknown callers stay gated rather than receiving blanket access |
| 2 | Prepare narrow authorization/entitlement fixes locally, including safe replacements for required client operations | Reviewable migrations/handlers, rollback/compatibility notes, no blanket revoke that silently breaks onboarding or current purchases |
| 3 | Test against a separate staging environment with synthetic guest, account A, account B, admin, worker, and expired-entitlement identities | Cross-account reads/writes, self-entitlement changes, unauthorized workers, receipt reassignment, cancellation races, and stale/replayed writes are denied; intended operations still pass |
| 4 | Verify deployed deletion sources and complete unresolved exposure/backup configuration checks | Source/version evidence matches the target environment; deletion cannot wipe another account or falsely report completion |
| 5 | Apply reviewed fixes through the release/deployment process; repeat read-only verification and monitor | Deployed evidence closes each security finding before new Journal network paths or paid-cloud authorization are enabled |
| 6 | Resume additive shared-sync schema, transactional local storage, private media/export, and encrypted recovery work | Follow the master plan's phase gates; retain the free compatible-base versus paid Journal-private-content distinction |

No user action is needed for the next local caller-inventory/fix preparation. A verified separate staging target and test identities are prerequisites for step 3, before production changes. We will identify those prerequisites explicitly when the reviewable fixes are ready. The remaining recurrence/lifecycle/structured-content mappings can continue independently.

## Progress and checkpoint state

Phase 0 inventory estimate increases from 65% to **80%** because deployed metadata/source evidence is now available. Phase 1 remains 80%, Phase 2 remains 0% (findings are not remediated), Phase 5 remains 10%, and Phase 7 remains 15%. With unchanged phase weights, overall delivery is **12.7%, approximately 13%**. This is implementation progress, not a security pass score.

This report and its new companion SQL script are local/uncommitted. Existing code continuation also remains local; GitHub reference heads remain Journal `3744a634` and siFia `7d1e01bf`. No deployment was made.

## Primary references checked on 2026-11-04

- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): policy composition, implicit checks, table-owner behavior, and operations outside RLS.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions): definer privileges, caller checks, search paths, and both PUBLIC/direct execute grants.
- [Supabase Edge Function authorization](https://supabase.com/docs/guides/functions/auth): gateway verification, caller identity, and privileged server access.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): private object authorization and service-role bypass.
