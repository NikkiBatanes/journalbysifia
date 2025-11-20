-- Rollback Migration: Remove alarm_minutes column from time_blocks table
-- Date: 2025-11-21
-- Description: Removes alarm_minutes column if migration needs to be rolled back

-- Drop index first
DROP INDEX IF EXISTS idx_time_blocks_alarm_minutes;

-- Remove alarm_minutes column from time_blocks table
ALTER TABLE time_blocks
DROP COLUMN IF EXISTS alarm_minutes;
