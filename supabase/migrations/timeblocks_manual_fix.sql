-- Manual SQL fix for timeblocks missing columns
-- Run this directly in Supabase SQL Editor if migration script doesn't work

-- Add missing columns to time_blocks table
ALTER TABLE time_blocks 
ADD COLUMN IF NOT EXISTS alarm_minutes INTEGER;

ALTER TABLE time_blocks
ADD COLUMN IF NOT EXISTS repeat_frequency TEXT;

ALTER TABLE time_blocks
ADD COLUMN IF NOT EXISTS repeat_end_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE time_blocks
ADD COLUMN IF NOT EXISTS repeat_custom_frequency INTEGER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_blocks_repeat_frequency ON time_blocks(repeat_frequency);
CREATE INDEX IF NOT EXISTS idx_time_blocks_alarm_minutes ON time_blocks(alarm_minutes);

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'time_blocks' 
AND column_name IN ('alarm_minutes', 'repeat_frequency', 'repeat_end_date', 'repeat_custom_frequency')
ORDER BY column_name;
