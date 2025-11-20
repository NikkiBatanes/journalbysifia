-- Migration: Add alarm_minutes column to time_blocks table
-- Date: 2025-11-21
-- Description: Adds alarm_minutes column to store user's alarm preference for calendar events

-- Add alarm_minutes column to time_blocks table
ALTER TABLE time_blocks
ADD COLUMN IF NOT EXISTS alarm_minutes INTEGER;

-- Add comment to document the column
COMMENT ON COLUMN time_blocks.alarm_minutes IS 'Minutes before event to trigger alarm (null = no alarm, 0 = at time, 15 = 15 min before, etc.)';

-- Create index for potential queries filtering by alarm_minutes
CREATE INDEX IF NOT EXISTS idx_time_blocks_alarm_minutes ON time_blocks(alarm_minutes) WHERE alarm_minutes IS NOT NULL;
