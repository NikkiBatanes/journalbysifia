# Generation helper source review

Reviewed: November 16, 2026. The user manually ran
`06-generation-function-source.sql` in the existing siFia Supabase project. The
agent did not execute SQL or invoke a function.

## Conclusion

None of the six helpers is suitable for the new generation quota/idempotency
boundary. All are PUBLIC, anonymous, and authenticated executable and all lack
a pinned search path.

## Findings

| Function | Finding | Current repository caller |
| --- | --- | --- |
| `claim_next_playbook_job(varchar)` | Definer function lets any caller claim and lock the next global job; anonymous execution can disrupt the worker queue | None found; deployed worker source remains unavailable |
| `create_devotional_from_playbook(uuid,uuid,text,text,text,integer)` | Invoker function accepts supplied owner/content and copies a playbook title; RLS limits ordinary calls but it has no authenticated-owner assertion, idempotency, quota decision, or input bounds | None found |
| `initialize_onboarding(uuid)` | Definer function creates three onboarding/profile rows for an arbitrary Auth UUID | Active `OnboardingService` and diagnostic service |
| `record_devotional_creation(uuid,uuid,integer)` | Definer function awards variable FaithPoints to an arbitrary user/content ID and has no replay protection | None found |
| `record_playbook_creation(uuid,uuid,text)` | Definer function awards FaithPoints to an arbitrary user/content ID and has no replay protection | None found |
| `update_onboarding_progress(uuid,text,integer,onboarding_step_status,integer)` | Definer function mutates any user's onboarding state from caller-supplied values | Active `OnboardingService` and diagnostic service |

## Remediation split

1. Preserve the signatures of the two active onboarding RPCs, require
   `auth.uid()` to equal the supplied UUID, pin `search_path=''`, qualify every
   reference, revoke PUBLIC/anonymous execution, and retain authenticated-owner
   execution. Test current iOS/Android onboarding behavior with synthetic users.
2. Do not blindly revoke or change the queue claim until the deployed worker
   caller is proven. Its target state is service-only execution with a pinned
   path and bounded worker identity.
3. Treat the two FaithPoints helpers as a separate idempotency/authority
   boundary. Caller absence is not permission to delete them. They must become
   owner-bound with server-verified content or service-only after external
   caller evidence.
4. Do not extend `create_devotional_from_playbook`; the versioned trusted
   generation path will validate ownership and persist a complete result.
5. Build the new generation-operation ledger under distinct names. It must not
   depend on any client-writable onboarding, queue, content, or subscription
   field as authority.

## Generation operation direction

The guarded design now has enough metadata to use a dedicated server-owned
operation table with:

- unique owner plus operation UUID;
- allowlisted `playbook`/`devotional` action;
- immutable request fingerprint;
- reserved/completed/failed/expired lifecycle;
- reservation expiry and completion-at-most-once rules;
- server-derived tier, status, period, limits, and one-time benefits;
- stable result UUID and result ownership;
- no client table mutations;
- owner-visible minimal status only through a fixed RPC;
- Edge Function completion only after the result is durably saved.

The operation package and onboarding-helper hardening should be separate
transactions with separate rollback/verification scripts. No live change was
made by this review.
