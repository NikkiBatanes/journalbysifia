-- Comprehensive Database Schema Fix
-- Run this in your Supabase SQL Editor to fix all schema issues

-- 1. Fix notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devotional_reminders BOOLEAN DEFAULT true,
  playbook_steps BOOLEAN DEFAULT true,
  journal_prompts BOOLEAN DEFAULT true,
  prayer_reminders BOOLEAN DEFAULT true,
  milestone_celebrations BOOLEAN DEFAULT true,
  trial_notifications BOOLEAN DEFAULT true,
  streak_alerts BOOLEAN DEFAULT true,
  prayer_requests BOOLEAN DEFAULT true,
  prayer_request_alerts BOOLEAN DEFAULT true,
  quiet_hours_start TEXT DEFAULT '22:00',
  quiet_hours_end TEXT DEFAULT '07:00',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add missing columns if table exists but columns don't
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

-- 2. Create missing subscription enums
DO $$ BEGIN
    CREATE TYPE subscription_tier_new AS ENUM (
        'seeker', 'free_trial', 'spark', 'growth', 'transformation', 'family'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM (
        'active', 'cancelled', 'expired', 'pending_payment', 'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create user_subscriptions_new table if missing
CREATE TABLE IF NOT EXISTS user_subscriptions_new (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier subscription_tier_new NOT NULL DEFAULT 'seeker',
    status subscription_status NOT NULL DEFAULT 'active',
    playbooks_limit integer NOT NULL DEFAULT 0,
    devotionals_limit integer NOT NULL DEFAULT 0,
    playbooks_used integer NOT NULL DEFAULT 0,
    devotionals_used integer NOT NULL DEFAULT 0,
    smart_journaling_enabled boolean NOT NULL DEFAULT false,
    trial_start_date timestamptz,
    trial_end_date timestamptz,
    subscription_start_date timestamptz,
    subscription_end_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- 4. Create the missing trial expiry function
CREATE OR REPLACE FUNCTION check_and_handle_expired_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count integer := 0;
    expired_user record;
BEGIN
    -- Find and process expired trials
    FOR expired_user IN 
        SELECT user_id 
        FROM user_subscriptions_new 
        WHERE tier = 'free_trial' 
        AND trial_end_date < now()
        AND status = 'active'
    LOOP
        -- Downgrade to seeker
        UPDATE user_subscriptions_new 
        SET 
            tier = 'seeker',
            status = 'active',
            playbooks_limit = 0,
            devotionals_limit = 0,
            playbooks_used = 0,
            devotionals_used = 0,
            smart_journaling_enabled = false,
            trial_start_date = null,
            trial_end_date = null,
            updated_at = now()
        WHERE user_id = expired_user.user_id;
        
        expired_count := expired_count + 1;
    END LOOP;
    
    RETURN expired_count;
END;
$$;

-- 5. Create the missing default seeker subscription function
CREATE OR REPLACE FUNCTION create_default_seeker_subscription(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_id uuid;
BEGIN
    -- Insert or update seeker subscription
    INSERT INTO user_subscriptions_new (
        user_id,
        tier,
        status,
        playbooks_limit,
        devotionals_limit,
        playbooks_used,
        devotionals_used,
        smart_journaling_enabled,
        created_at,
        updated_at
    ) VALUES (
        target_user_id,
        'seeker',
        'active',
        0,
        0,
        0,
        0,
        false,
        now(),
        now()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        tier = 'seeker',
        status = 'active',
        playbooks_limit = 0,
        devotionals_limit = 0,
        smart_journaling_enabled = false,
        updated_at = now()
    RETURNING id INTO subscription_id;
    
    RETURN subscription_id;
END;
$$;

-- 5. Fix onboarding_progress foreign key constraint
-- First check if the table exists and fix the constraint
DO $$
BEGIN
    -- If onboarding_progress table exists, temporarily disable the constraint
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'onboarding_progress') THEN
        -- Drop the foreign key constraint temporarily
        ALTER TABLE onboarding_progress DROP CONSTRAINT IF EXISTS onboarding_progress_user_id_fkey;
        
        -- Delete any orphaned records (users that don't exist in auth.users)
        DELETE FROM onboarding_progress 
        WHERE user_id NOT IN (SELECT id FROM auth.users);
        
        -- Re-add the foreign key constraint
        ALTER TABLE onboarding_progress 
        ADD CONSTRAINT onboarding_progress_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Enable RLS and create policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions_new ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON user_subscriptions_new;
CREATE POLICY "Users can manage their own subscriptions" ON user_subscriptions_new
  FOR ALL USING (auth.uid() = user_id);

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION check_and_handle_expired_trials() TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_seeker_subscription(uuid) TO authenticated;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_user ON user_subscriptions_new(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_tier_status ON user_subscriptions_new(tier, status);

-- Success message
SELECT 'Database schema fixes applied successfully!' as result;
