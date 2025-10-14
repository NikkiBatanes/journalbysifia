-- Add subscription_display_name column to user_subscriptions_new table
-- This stores the user-friendly display name like "siFia Spark Trial" or "siFia Growth"

DO $$ 
BEGIN
    -- Check if subscription_display_name column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'subscription_display_name'
    ) THEN
        -- Add the subscription_display_name column
        ALTER TABLE user_subscriptions_new 
        ADD COLUMN subscription_display_name TEXT;
        
        RAISE NOTICE 'Added subscription_display_name column to user_subscriptions_new table';
    ELSE
        RAISE NOTICE 'subscription_display_name column already exists in user_subscriptions_new table';
    END IF;
END $$;

-- Drop and recreate the create_default_seeker_subscription function to set display name
DROP FUNCTION IF EXISTS create_default_seeker_subscription(UUID);

CREATE OR REPLACE FUNCTION create_default_seeker_subscription(target_user_id UUID)
RETURNS void AS $$
DECLARE
    tier_limits RECORD;
BEGIN
    -- Get tier limits for seeker
    SELECT * INTO tier_limits FROM get_tier_limits('seeker');
    
    -- Create seeker subscription with display name
    INSERT INTO user_subscriptions_new (
        user_id,
        tier,
        status,
        subscription_display_name,
        playbooks_limit,
        devotionals_limit,
        smart_journaling_enabled,
        playbooks_used,
        devotionals_used
    ) VALUES (
        target_user_id,
        'seeker',
        'active',
        'siFia Seeker',
        tier_limits.playbooks_limit,
        tier_limits.devotionals_limit,
        tier_limits.smart_journaling_enabled,
        0,
        0
    )
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing records to have proper display names
UPDATE user_subscriptions_new 
SET subscription_display_name = CASE 
    WHEN tier = 'seeker' THEN 'siFia Seeker'
    WHEN tier = 'spark' THEN 'siFia Spark'
    WHEN tier = 'growth' THEN 'siFia Growth'
    WHEN tier = 'transformation' THEN 'siFia Transformation'
    WHEN tier = 'family' THEN 'siFia Family'
    WHEN tier = 'free_trial' AND trial_chosen_tier IS NOT NULL THEN 
        'siFia ' || INITCAP(REPLACE(trial_chosen_tier::text, '_', ' ')) || ' Trial'
    WHEN tier = 'free_trial' THEN 'siFia Growth Trial' -- Default to Growth if no chosen tier
    ELSE 'siFia ' || INITCAP(REPLACE(tier::text, '_', ' '))
END
WHERE subscription_display_name IS NULL;

-- Show the updated records
SELECT 
    user_id,
    tier,
    trial_chosen_tier,
    subscription_display_name,
    created_at
FROM user_subscriptions_new
ORDER BY created_at DESC
LIMIT 10;

COMMENT ON COLUMN user_subscriptions_new.subscription_display_name IS 'User-friendly display name for the subscription (e.g., "siFia Spark Trial", "siFia Growth")';
