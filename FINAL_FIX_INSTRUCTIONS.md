# FINAL FIX - Complete Instructions

## Problem Summary

You found the exact issue! The decline is failing because of RLS (Row Level Security):

```
ERROR: Decline update returned no rows - invitation may not exist or already processed
invitationCode: "ELEPJ3EO"
```

**Root Cause:** The `family_invitations` table has an RLS policy that **only allows the admin to update invitations**. When you (the invited user) try to decline, the UPDATE returns 0 rows because you don't have permission.

---

## Required SQL Migrations

You need to run **TWO** SQL migrations in Supabase SQL Editor:

### 1. Fix family_invitations RLS (CRITICAL - fixes decline)

**File:** `database/migrations/fix_family_invitations_rls.sql`

**What it does:**
- Allows invited users to UPDATE invitations sent to their email (so they can decline)
- Still allows admin to update any invitation in their group

**Run this in Supabase SQL Editor:**
```sql
-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS family_invitations_update_policy ON family_invitations;

-- Create new policy: Admin can update any invitation, invited user can update their own
CREATE POLICY family_invitations_update_policy ON family_invitations
  FOR UPDATE
  USING (
    -- Admin can update invitations in their family group
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
    OR
    -- Invited user can update invitations sent to their email (to decline)
    invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  );
```

---

### 2. Fix notifications RLS (fixes admin decline notification)

**File:** `database/migrations/fix_notifications_table_rls.sql`

**What it does:**
- Allows authenticated users to insert notifications for other users
- This lets the app send "invitation declined" notification to admin

**Run the entire file in Supabase SQL Editor** (it's already updated with correct column names)

---

## Code Fixes Already Applied

### ✅ 1. Accept Invitation Hanging - FIXED
- `FamilyTrialService.syncMemberLimits` no longer calls `getFamilyGroup`
- Fetches only `admin_user_id` directly

### ✅ 2. Badge Count Not Updating - FIXED
- Added real-time subscription to `family_invitations` table
- Badge updates immediately when invitation is sent

### ✅ 3. Notification Schema - FIXED
- Changed `notification_type` to `type` to match actual database schema
- Decline notification will now insert correctly (after RLS fix)

### ✅ 4. Decline Logging - ADDED
- Comprehensive error logging shows exactly what's failing
- Logs success with row count
- Shows Supabase error details if update fails

---

## Testing Steps

### After running BOTH SQL migrations:

1. **Reload the app**

2. **Test Decline:**
   - Tap Decline on the invitation
   - You should see in logs:
     ```
     ✅ Invitation declined successfully
     updatedRows: 1
     ```
   - Notification should disappear from your screen
   - Admin should see it removed from "Pending Invitations"
   - Admin should receive "Invitation Declined" notification

3. **Test Accept:**
   - Should complete without hanging
   - Show "Welcome to the Family!" alert
   - Navigate to MainTabs
   - Your subscription should show "siFia Family Trial" or "siFia Family"

4. **Test Badge Count:**
   - Admin sends invitation
   - Your badge should increment immediately (within 1-2 seconds)
   - After accept/decline, badge should decrement

---

## Why This Happened

### Original RLS Policy (TOO RESTRICTIVE):
```sql
CREATE POLICY family_invitations_update_policy ON family_invitations
  FOR UPDATE
  USING (
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );
```
This only allowed the admin to update invitations.

### New RLS Policy (CORRECT):
```sql
CREATE POLICY family_invitations_update_policy ON family_invitations
  FOR UPDATE
  USING (
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
    OR
    invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  );
```
This allows:
- Admin to update any invitation in their group (cancel, etc.)
- Invited user to update invitations sent to their email (decline)

---

## Summary

**Run these 2 SQL files in Supabase:**
1. `fix_family_invitations_rls.sql` ← **CRITICAL for decline to work**
2. `fix_notifications_table_rls.sql` ← **Needed for admin to get decline notification**

Then reload the app and test. Everything should work!
