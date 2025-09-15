-- Simple fix for notification_preferences table
-- Run this in your Supabase SQL Editor

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add the missing columns
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS devotional_reminders BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS playbook_steps BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS journal_prompts BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS prayer_reminders BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS milestone_celebrations BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS trial_notifications BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS streak_alerts BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS prayer_requests BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS prayer_request_alerts BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '07:00';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);
