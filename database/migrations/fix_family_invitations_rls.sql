-- Fix family_invitations RLS to allow invited users to decline invitations
-- Currently only admin can update invitations, but invited users need to be able to decline

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

-- Add comment
COMMENT ON POLICY family_invitations_update_policy ON family_invitations IS 
  'Allows family admin to update invitations in their group, and allows invited users to update (decline) invitations sent to their email';
