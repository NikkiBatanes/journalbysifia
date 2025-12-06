-- Enterprise-Grade Trial System Database Schema (Safe Version)
-- Only adds columns that don't already exist
-- Execute this SQL to enable the complete trial lifecycle

-- Trial Management Fields (add if not exists)
DO $$
BEGIN
    -- Check and add trial_start_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'trial_start_date'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN trial_start_date TIMESTAMP NULL;
    END IF;

    -- Check and add trial_end_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'trial_end_date'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN trial_end_date TIMESTAMP NULL;
    END IF;

    -- Check and add trial_chosen_tier
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'trial_chosen_tier'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN trial_chosen_tier TEXT NULL CHECK (trial_chosen_tier IN ('spark', 'growth', 'transformation'));
    END IF;

    -- Check and add trial_converted_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'trial_converted_date'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN trial_converted_date TIMESTAMP NULL;
    END IF;

    -- Check and add trial_cancelled_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'trial_cancelled_date'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN trial_cancelled_date TIMESTAMP NULL;
    END IF;
END $$;

-- Billing & Grace Period Fields (add if not exists)
DO $$
BEGIN
    -- Check and add billing_issue
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'billing_issue'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN billing_issue BOOLEAN DEFAULT false;
    END IF;

    -- Check and add grace_period_end_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'grace_period_end_date'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN grace_period_end_date TIMESTAMP NULL;
    END IF;

    -- Check and add refund_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'refund_date'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN refund_date TIMESTAMP NULL;
    END IF;

    -- Check and add auto_renew_enabled
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'auto_renew_enabled'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN auto_renew_enabled BOOLEAN DEFAULT true;
    END IF;

    -- Check and add cancellation_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'cancellation_date'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN cancellation_date TIMESTAMP NULL;
    END IF;
END $$;

-- Platform Integration Fields (add if not exists)
DO $$
BEGIN
    -- Check and add platform_subscription_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'platform_subscription_id'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN platform_subscription_id TEXT NULL;
    END IF;

    -- Check and add platform_transaction_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'platform_transaction_id'
    ) THEN
        ALTER TABLE user_subscriptions_new ADD COLUMN platform_transaction_id TEXT NULL;
    END IF;
END $$;

-- Indexes for Performance (create if not exists)
CREATE INDEX IF NOT EXISTS idx_trial_start_date ON user_subscriptions_new(trial_start_date);
CREATE INDEX IF NOT EXISTS idx_trial_end_date ON user_subscriptions_new(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_grace_period_end ON user_subscriptions_new(grace_period_end_date);
CREATE INDEX IF NOT EXISTS idx_platform_transaction ON user_subscriptions_new(platform_transaction_id);
CREATE INDEX IF NOT EXISTS idx_billing_issue ON user_subscriptions_new(billing_issue);

-- Trial Eligibility Function (for checking if user can start trial)
CREATE OR REPLACE FUNCTION can_start_trial(user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_trial_start BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM user_subscriptions_new 
        WHERE user_id = can_start_trial.user_id 
        AND trial_start_date IS NOT NULL
    ) INTO has_trial_start;
    
    RETURN NOT has_trial_start;
END;
$$ LANGUAGE plpgsql;

-- Expired Trial Handler (background job)
CREATE OR REPLACE FUNCTION check_and_handle_expired_trials()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
    expired_user RECORD;
BEGIN
    -- Find expired trials
    FOR expired_user IN 
        SELECT user_id, trial_chosen_tier
        FROM user_subscriptions_new
        WHERE tier = 'free_trial'
        AND trial_end_date < NOW()
        AND trial_converted_date IS NULL
    LOOP
        -- Revert to seeker tier
        UPDATE user_subscriptions_new
        SET tier = 'seeker',
            subscription_display_name = 'siFia Seeker',
            playbooks_limit = 0,
            devotionals_limit = 0,
            playbooks_used = 0,
            devotionals_used = 0,
            smart_journaling_enabled = false,
            subscription_end_date = NOW(),
            updated_at = NOW()
        WHERE user_id = expired_user.user_id;
        
        expired_count := expired_count + 1;
    END LOOP;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Grace Period Expiry Handler (3-day grace period)
CREATE OR REPLACE FUNCTION check_and_handle_grace_period_expiry()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
    expired_user RECORD;
BEGIN
    -- Find expired grace periods (3 days after payment failure)
    FOR expired_user IN 
        SELECT user_id
        FROM user_subscriptions_new
        WHERE billing_issue = true
        AND grace_period_end_date < NOW()
    LOOP
        -- Revert to seeker tier
        UPDATE user_subscriptions_new
        SET tier = 'seeker',
            subscription_display_name = 'siFia Seeker',
            playbooks_limit = 0,
            devotionals_limit = 0,
            playbooks_used = 0,
            devotionals_used = 0,
            smart_journaling_enabled = false,
            billing_issue = false,
            grace_period_end_date = NULL,
            subscription_end_date = NOW(),
            updated_at = NOW()
        WHERE user_id = expired_user.user_id;
        
        expired_count := expired_count + 1;
    END LOOP;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Sample Queries for Testing

-- Check trial eligibility for a user
-- SELECT can_start_trial('user-id-here');

-- View all active trials
-- SELECT user_id, trial_chosen_tier, trial_end_date 
-- FROM user_subscriptions_new 
-- WHERE tier = 'free_trial' 
-- AND trial_end_date > NOW();

-- View users in grace period
-- SELECT user_id, grace_period_end_date 
-- FROM user_subscriptions_new 
-- WHERE billing_issue = true 
-- AND grace_period_end_date > NOW();

-- Run expired trial cleanup
-- SELECT check_and_handle_expired_trials();

-- Run grace period cleanup
-- SELECT check_and_handle_grace_period_expiry();
