-- Complete time_blocks table schema update
-- Migration: 20241126_timeblocks_schema_update.sql
-- Purpose: Add missing columns for repeat and alarm functionality

-- Check if time_blocks table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_blocks') THEN
        CREATE TABLE time_blocks (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            selected_date DATE NOT NULL,
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE NOT NULL,
            all_day BOOLEAN DEFAULT FALSE,
            title TEXT NOT NULL,
            location TEXT,
            category TEXT NOT NULL DEFAULT 'general',
            alert TEXT DEFAULT 'none' CHECK (alert IN ('none', 'at-time', '5-min', '10-min', '15-min', '30-min', '1-hour', '2-hours', '1-day', '2-days', '1-week')),
            alarm_minutes INTEGER, -- Minutes before event for calendar alarm
            repeat_rule JSONB, -- Repeat configuration as JSON
            repeat_until DATE, -- End date for repeating time blocks
            repeat_frequency TEXT, -- Frequency of repeat: never, daily, weekly, monthly, yearly
            repeat_end_date TIMESTAMP WITH TIME ZONE, -- End date for repeating time blocks
            repeat_custom_frequency INTEGER, -- Custom repeat frequency number
            timezone TEXT DEFAULT 'UTC',
            is_completed BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMP WITH TIME ZONE,
            description TEXT, -- Notes field in the UI
            calendar_event_id TEXT, -- Native calendar event linkage
            version INTEGER DEFAULT 1,
            metadata JSONB, -- Additional metadata
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX idx_time_blocks_user_id ON time_blocks(user_id);
        CREATE INDEX idx_time_blocks_selected_date ON time_blocks(selected_date);
        CREATE INDEX idx_time_blocks_category ON time_blocks(category);
        CREATE INDEX idx_time_blocks_is_completed ON time_blocks(is_completed);
        CREATE INDEX idx_time_blocks_repeat_frequency ON time_blocks(repeat_frequency);
        CREATE INDEX idx_time_blocks_alarm_minutes ON time_blocks(alarm_minutes);
        
        -- Create trigger for updated_at
        CREATE TRIGGER update_time_blocks_updated_at
            BEFORE UPDATE ON time_blocks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
            
        RAISE NOTICE 'time_blocks table created successfully';
    ELSE
        RAISE NOTICE 'time_blocks table already exists, adding missing columns';
        
        -- Add missing columns if they don't exist
        ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS alarm_minutes INTEGER;
        ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS repeat_frequency TEXT;
        ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS repeat_end_date TIMESTAMP WITH TIME ZONE;
        ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS repeat_custom_frequency INTEGER;
        
        -- Add indexes if they don't exist
        CREATE INDEX IF NOT EXISTS idx_time_blocks_repeat_frequency ON time_blocks(repeat_frequency);
        CREATE INDEX IF NOT EXISTS idx_time_blocks_alarm_minutes ON time_blocks(alarm_minutes);
        
        RAISE NOTICE 'Missing columns added to time_blocks table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE time_blocks IS 'Time blocks for scheduling and calendar integration';
COMMENT ON COLUMN time_blocks.alarm_minutes IS 'Minutes before event to trigger calendar alarm';
COMMENT ON COLUMN time_blocks.repeat_frequency IS 'Frequency of repeat: never, daily, weekly, monthly, yearly';
COMMENT ON COLUMN time_blocks.repeat_end_date IS 'End date for repeating time blocks';
COMMENT ON COLUMN time_blocks.repeat_custom_frequency IS 'Custom repeat frequency number';
COMMENT ON COLUMN time_blocks.repeat_rule IS 'Repeat configuration as JSON object';
COMMENT ON COLUMN time_blocks.repeat_until IS 'End date for repeating time blocks (legacy)';
COMMENT ON COLUMN time_blocks.calendar_event_id IS 'Native calendar event ID for sync';
COMMENT ON COLUMN time_blocks.metadata IS 'Additional metadata as JSON';
COMMENT ON COLUMN time_blocks.version IS 'Version for optimistic locking';

-- Enable Row Level Security
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own time blocks" ON time_blocks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time blocks" ON time_blocks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time blocks" ON time_blocks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time blocks" ON time_blocks
    FOR DELETE USING (auth.uid() = user_id);
