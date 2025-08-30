-- Fix for Growth Trial showing as siFia Seeker
-- This script ensures the trial_chosen_tier column exists and the function works correctly
-- Run this in your Supabase SQL editor

-- Step 1: Add the trial_chosen_tier column if it doesn't exist
ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS trial_chosen_tier subscription_tier_new;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN user_subscriptions_new.trial_chosen_tier IS 'The plan user chose during trial signup (used for dynamic trial limit messaging)';

-- Step 3: Update the start_free_trial function to properly handle chosen tier
CREATE OR REPLACE FUNCTION start_free_trial(target_user_id uuid, duration_days integer DEFAULT 3, chosen_tier subscription_tier_new DEFAULT 'growth')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_id uuid;
    trial_end timestamptz;
BEGIN
    trial_end := now() + (duration_days || ' days')::interval;
    
    -- Update existing subscription to trial
    UPDATE user_subscriptions_new 
    SET 
        tier = 'free_trial',
        status = 'active',
        playbooks_limit = 2,
        devotionals_limit = 2,
        playbooks_used = 0,
        devotionals_used = 0,
        smart_journaling_enabled = false,
        trial_start_date = now(),
        trial_end_date = trial_end,
        trial_chosen_tier = chosen_tier,
        updated_at = now()
    WHERE user_id = target_user_id
    RETURNING id INTO subscription_id;
    
    IF subscription_id IS NULL THEN
        -- Create new trial subscription if none exists
        INSERT INTO user_subscriptions_new (
            user_id,
            tier,
            status,
            playbooks_limit,
            devotionals_limit,
            trial_start_date,
            trial_end_date,
            trial_chosen_tier
        ) VALUES (
            target_user_id,
            'free_trial',
            'active',
            2,
            2,
            now(),
            trial_end,
            chosen_tier
        ) RETURNING id INTO subscription_id;
    END IF;
    
    RETURN subscription_id;
END;
$$;

-- Step 4: Grant execute permission
GRANT EXECUTE ON FUNCTION start_free_trial(uuid, integer, subscription_tier_new) TO authenticated;

-- Step 5: Fix any existing trial subscriptions that are missing trial_chosen_tier
UPDATE user_subscriptions_new 
SET trial_chosen_tier = 'growth'
WHERE tier = 'free_trial' 
AND trial_chosen_tier IS NULL;

-- Step 6: Verify the fix worked
SELECT 
    user_id,
    tier,
    trial_chosen_tier,
    trial_start_date,
    trial_end_date
FROM user_subscriptions_new 
WHERE tier = 'free_trial';
