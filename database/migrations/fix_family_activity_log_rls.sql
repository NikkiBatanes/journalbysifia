-- Fix family_activity_log RLS to allow trigger inserts when invitations are declined
-- The log_invitation_status_changes trigger needs to insert activity logs

-- Drop existing restrictive insert policy
DROP POLICY IF EXISTS family_activity_log_insert_policy ON family_activity_log;

-- Create new policy: Allow authenticated users to insert (needed for triggers)
-- The trigger fires AFTER UPDATE, so status is already changed when it runs
-- We need to allow inserts for ANY invitation-related activity, not just pending
CREATE POLICY family_activity_log_insert_policy ON family_activity_log
  FOR INSERT
  WITH CHECK (
    -- Allow if current user has ANY invitation to this family group
    -- (Don't check status='pending' because trigger runs AFTER status change!)
    family_group_id IN (
      SELECT family_group_id 
      FROM family_invitations 
      WHERE invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
    )
    OR
    -- Allow if current user is a member of this family group
    family_group_id IN (
      SELECT family_group_id 
      FROM user_subscriptions_new 
      WHERE user_id = auth.uid() AND family_group_id IS NOT NULL
    )
    OR
    -- Allow if current user is admin of this family group
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
    OR
    -- Allow service role (for system operations)
    auth.role() = 'service_role'
  );

-- Add comment
COMMENT ON POLICY family_activity_log_insert_policy ON family_activity_log IS 
  'Allows users to insert activity logs for their own actions, admins to insert for their family group, and service role for system operations. Needed for invitation status change triggers.';
