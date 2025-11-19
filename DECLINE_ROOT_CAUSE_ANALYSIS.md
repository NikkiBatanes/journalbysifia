# Root Cause Analysis - Decline Failing

## The Problem
When you decline an invitation, you get:
```
ERROR: new row violates row-level security policy for table "family_activity_log"
code: 42501
```

## What Happens Step-by-Step

### 1. You tap "Decline"
```typescript
// NotificationsScreen.tsx line 411
const { data: declineResult, error: declineError } = await supabase
  .from('family_invitations')
  .update({ status: 'declined' })
  .eq('invitation_code', normalizedCode)
  .eq('status', 'pending')
  .select();
```

### 2. The UPDATE triggers a database trigger
```sql
-- family_subscription_enterprise_safeguards.sql line 182-187
CREATE TRIGGER invitation_status_change
  AFTER UPDATE ON family_invitations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_invitation_status_changes();
```

### 3. The trigger function tries to INSERT into family_activity_log
```sql
-- line 155-175
INSERT INTO family_activity_log (
  family_group_id,
  user_id,                    -- ← THIS IS THE PROBLEM
  activity_type,
  activity_description,
  metadata,
  created_at
) VALUES (
  NEW.family_group_id,
  NEW.invited_by_user_id,     -- ← INSERTS ADMIN'S ID, NOT YOURS
  'invitation_status_changed',
  'Invitation status changed from ' || OLD.status || ' to ' || NEW.status,
  jsonb_build_object(...),
  NOW()
);
```

### 4. RLS Policy Checks
The INSERT runs in **YOUR** security context (auth.uid() = your ID).
But it's trying to insert a row with `user_id = admin's ID`.

The RLS policy checks:
```sql
WITH CHECK (
  -- Check 1: Are you a member of this family?
  family_group_id IN (
    SELECT family_group_id 
    FROM user_subscriptions_new 
    WHERE user_id = auth.uid()  -- ← YOUR ID
  )
  -- You're NOT a member yet (you're declining!)
  
  -- Check 2: Are you the admin?
  family_group_id IN (
    SELECT id FROM family_subscription_groups 
    WHERE admin_user_id = auth.uid()  -- ← YOUR ID
  )
  -- You're NOT the admin
  
  -- Check 3: Do you have a pending invitation?
  family_group_id IN (
    SELECT family_group_id 
    FROM family_invitations 
    WHERE invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
    AND status = 'pending'
  )
  -- THIS SHOULD PASS... but might not if:
  -- - user_profiles.email doesn't match invited_email
  -- - The subquery can't access user_profiles
  -- - Email case sensitivity issue
)
```

## Possible Root Causes

### A. Email Mismatch
- `family_invitations.invited_email` might be lowercase: `"nikkibatanes@gmail.com"`
- `user_profiles.email` might be different case or format
- The subquery `(SELECT email FROM user_profiles WHERE id = auth.uid())` might return NULL

### B. RLS on user_profiles
- The subquery might be blocked by RLS on `user_profiles` table
- If you can't SELECT your own email from `user_profiles`, the check fails

### C. Timing Issue
- The trigger fires AFTER UPDATE
- By the time it runs, the invitation status is already 'declined'
- The RLS check looks for `status = 'pending'`
- So it finds NO rows!

## The Real Problem: Check #3 Timing Issue

```sql
-- At the time the trigger runs:
SELECT family_group_id 
FROM family_invitations 
WHERE invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
AND status = 'pending'  -- ← ALREADY CHANGED TO 'declined'!
```

The UPDATE already changed status to 'declined', so when the trigger fires and checks for pending invitations, it finds NONE!

## The Fix

We need to check if the invitation EXISTS (regardless of status), not just if it's pending:

```sql
CREATE POLICY family_activity_log_insert_policy ON family_activity_log
  FOR INSERT
  WITH CHECK (
    -- Allow if current user has ANY invitation to this family group
    -- (not just pending, since trigger fires AFTER status change)
    family_group_id IN (
      SELECT family_group_id 
      FROM family_invitations 
      WHERE invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
      -- NO status filter!
    )
    OR
    -- ... other conditions
  );
```

## Alternative: Simpler Fix

Just allow ANY authenticated user to insert activity logs:

```sql
CREATE POLICY family_activity_log_insert_policy ON family_activity_log
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

This is safe because:
- The trigger controls what gets inserted
- The trigger only fires on valid invitation updates
- The activity log is just for auditing
