-- Migration: Add trial_chosen_tier column to user_subscriptions_new table
-- Created: 2025-08-29
-- Purpose: Store the plan user chose during trial signup for dynamic messaging

-- Add the trial_chosen_tier column
ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS trial_chosen_tier subscription_tier_new;

-- Add comment for documentation
COMMENT ON COLUMN user_subscriptions_new.trial_chosen_tier IS 'The plan user chose during trial signup (used for dynamic trial limit messaging)';

-- Update the start_free_trial function to accept and store chosen tier
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION start_free_trial(uuid, integer, subscription_tier_new) TO authenticated;
