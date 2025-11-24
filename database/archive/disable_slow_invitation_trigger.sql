-- Disable the slow invitation status change trigger
-- This trigger causes decline to be slow because it:
-- 1. Fires on every status change
-- 2. Does complex INSERT with jsonb_build_object
-- 3. Triggers RLS checks with multiple subqueries
--
-- Activity logging is nice-to-have but not critical for MVP
-- We can re-enable it later with better performance (async queue, etc.)

DROP TRIGGER IF EXISTS invitation_status_change ON family_invitations;

-- Optional: Also drop the function if you want to clean up completely
-- DROP FUNCTION IF EXISTS log_invitation_status_changes();

-- Add comment to track why it was disabled
COMMENT ON TABLE family_invitations IS 
  'Family subscription invitations. Note: invitation_status_change trigger disabled for performance - decline was too slow due to activity log inserts with RLS checks.';
