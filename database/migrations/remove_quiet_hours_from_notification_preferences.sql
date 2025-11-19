-- Migration: Remove quiet hours columns from notification_preferences table
-- Date: 2025-11-19
-- Description: Removes quiet_hours_enabled, quiet_hours_start, and quiet_hours_end columns
--              as quiet hours feature has been removed from the application

-- Remove quiet hours columns from notification_preferences table
ALTER TABLE notification_preferences 
DROP COLUMN IF EXISTS quiet_hours_enabled,
DROP COLUMN IF EXISTS quiet_hours_start,
DROP COLUMN IF EXISTS quiet_hours_end;

-- Add comment to track migration
COMMENT ON TABLE notification_preferences IS 'User notification preferences - quiet hours removed 2025-11-19';
