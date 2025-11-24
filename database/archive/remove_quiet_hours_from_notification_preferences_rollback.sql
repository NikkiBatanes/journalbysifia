-- Rollback Migration: Restore quiet hours columns to notification_preferences table
-- Date: 2025-11-19
-- Description: Restores quiet_hours_enabled, quiet_hours_start, and quiet_hours_end columns
--              in case rollback is needed

-- Add back quiet hours columns to notification_preferences table
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '07:00';

-- Add comment to track rollback
COMMENT ON TABLE notification_preferences IS 'User notification preferences - quiet hours restored via rollback';
