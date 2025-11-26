-- Add missing columns to time_blocks table for repeat and alarm functionality
-- Migration: 20241126_add_timeblock_repeat_and_alarm_columns.sql

-- Add repeat_frequency column
ALTER TABLE time_blocks 
ADD COLUMN IF NOT EXISTS repeat_frequency TEXT;

-- Add repeat_end_date column  
ALTER TABLE time_blocks
ADD COLUMN IF NOT EXISTS repeat_end_date TIMESTAMP WITH TIME ZONE;

-- Add repeat_custom_frequency column
ALTER TABLE time_blocks
ADD COLUMN IF NOT EXISTS repeat_custom_frequency INTEGER;

-- Add alarm_minutes column for calendar alarm functionality
ALTER TABLE time_blocks
ADD COLUMN IF NOT EXISTS alarm_minutes INTEGER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_blocks_repeat_frequency ON time_blocks(repeat_frequency);
CREATE INDEX IF NOT EXISTS idx_time_blocks_alarm_minutes ON time_blocks(alarm_minutes);

-- Add comments for documentation
COMMENT ON COLUMN time_blocks.repeat_frequency IS 'Frequency of repeat: never, daily, weekly, monthly, yearly';
COMMENT ON COLUMN time_blocks.repeat_end_date IS 'End date for repeating time blocks';
COMMENT ON COLUMN time_blocks.repeat_custom_frequency IS 'Custom repeat frequency number';
COMMENT ON COLUMN time_blocks.alarm_minutes IS 'Minutes before event to trigger calendar alarm';
