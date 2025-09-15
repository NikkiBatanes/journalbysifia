-- =====================================================
-- Fix notification_preferences table schema
-- =====================================================

-- Add missing columns to notification_preferences table if they don't exist
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS devotional_reminders BOOLEAN DEFAULT true;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS playbook_steps BOOLEAN DEFAULT true;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS journal_prompts BOOLEAN DEFAULT true;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS milestone_celebrations BOOLEAN DEFAULT true;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS trial_notifications BOOLEAN DEFAULT true;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS streak_alerts BOOLEAN DEFAULT true;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS prayer_request_alerts BOOLEAN DEFAULT true;

-- Ensure the table has the correct structure
-- If the table structure is completely different, recreate it
DO $$
BEGIN
    -- Check if the table has the expected columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_preferences' 
        AND column_name = 'devotional_reminders'
    ) THEN
        -- Drop and recreate the table with correct structure
        DROP TABLE IF EXISTS notification_preferences CASCADE;
        
        CREATE TABLE notification_preferences (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            
            -- Core notification preferences
            playbook_steps BOOLEAN DEFAULT true,
            devotional_reminders BOOLEAN DEFAULT true,
            journal_prompts BOOLEAN DEFAULT true,
            prayer_reminders BOOLEAN DEFAULT true,
            milestone_celebrations BOOLEAN DEFAULT true,
            trial_notifications BOOLEAN DEFAULT true,
            streak_alerts BOOLEAN DEFAULT true,
            prayer_requests BOOLEAN DEFAULT true,
            prayer_request_alerts BOOLEAN DEFAULT true,
            
            -- Timing preferences
            quiet_hours_start TEXT DEFAULT '22:00',
            quiet_hours_end TEXT DEFAULT '07:00',
            timezone TEXT DEFAULT 'UTC',
            
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            UNIQUE(user_id)
        );
        
        -- Enable RLS
        ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
        
        -- Create policy
        DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;
        CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
            FOR ALL USING (auth.uid() = user_id);
            
        -- Create index
        CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
    END IF;
END $$;

-- Update the updated_at column trigger
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_notification_preferences_updated_at();
