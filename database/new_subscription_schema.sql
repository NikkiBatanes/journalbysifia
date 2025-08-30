-- New Subscription System Database Schema
-- Designed for local testing without app store dependencies
-- Created: 2025-08-20

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- New subscription tiers enum
CREATE TYPE subscription_tier_new AS ENUM (
    'seeker',           -- Freemium: 0/0 limits after trial, 1 playbook during onboarding
    'free_trial',       -- 2/2 free for 3 days
    'spark',            -- 8 playbooks/devotionals + smart journaling
    'growth',           -- 20 playbooks/devotionals
    'transformation',   -- Unlimited (no dashboard counts)
    'family'            -- Unlimited for up to 6 members
);

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM (
    'active',
    'cancelled', 
    'expired',
    'pending_payment',
    'suspended'
);

-- Payment platform enum (for future app store integration)
CREATE TYPE payment_platform AS ENUM (
    'apple',
    'google',
    'local_test'  -- For local testing without app store
);

-- Family role enum
CREATE TYPE family_role AS ENUM (
    'admin',
    'member'
);

-- Main subscriptions table
CREATE TABLE user_subscriptions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    tier subscription_tier_new NOT NULL DEFAULT 'seeker',
    status subscription_status NOT NULL DEFAULT 'active',
    
    -- Trial and subscription dates
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    trial_chosen_tier subscription_tier_new, -- The plan user chose during trial signup
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    
    -- Payment integration (for future app store integration)
    platform payment_platform DEFAULT 'local_test',
    platform_subscription_id TEXT, -- Apple/Google subscription ID
    platform_transaction_id TEXT,
    platform_receipt_data JSONB, -- Store receipt data
    
    -- Family subscription support
    family_group_id UUID, -- Links family members
    family_role family_role DEFAULT 'member',
    
    -- Usage limits and tracking
    playbooks_limit INTEGER NOT NULL DEFAULT 0,
    devotionals_limit INTEGER NOT NULL DEFAULT 0,
    playbooks_used INTEGER NOT NULL DEFAULT 0,
    devotionals_used INTEGER NOT NULL DEFAULT 0,
    smart_journaling_enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Discount codes
    discount_code TEXT,
    discount_applied_amount DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id), -- One subscription per user
    CHECK (trial_end_date IS NULL OR trial_end_date > trial_start_date),
    CHECK (subscription_end_date IS NULL OR subscription_end_date > subscription_start_date),
    CHECK (playbooks_used >= 0 AND playbooks_used <= playbooks_limit),
    CHECK (devotionals_used >= 0 AND devotionals_used <= devotionals_limit)
);

-- Family subscription groups table
CREATE TABLE family_subscription_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    max_members INTEGER NOT NULL DEFAULT 6,
    current_members INTEGER NOT NULL DEFAULT 1,
    
    -- Payment info (for future app store integration)
    platform payment_platform DEFAULT 'local_test',
    platform_subscription_id TEXT,
    
    status subscription_status NOT NULL DEFAULT 'active',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CHECK (current_members <= max_members),
    CHECK (current_members >= 1)
);

-- Discount codes table
CREATE TABLE discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    
    -- Discount configuration
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    
    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0,
    
    -- Applicable tiers
    applicable_tiers subscription_tier_new[],
    
    -- Dynamic discount settings
    is_dynamic BOOLEAN NOT NULL DEFAULT false,
    generated_for_user_id UUID REFERENCES user_profiles(id),
    trigger_event TEXT, -- 'cancellation', 'trial_end', etc.
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
    CHECK (discount_amount IS NULL OR discount_amount >= 0),
    CHECK (current_uses <= max_uses OR max_uses IS NULL),
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Usage tracking table (for analytics and limits)
CREATE TABLE subscription_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES user_subscriptions_new(id) ON DELETE CASCADE,
    
    -- Usage counters
    playbooks_generated INTEGER NOT NULL DEFAULT 0,
    devotionals_generated INTEGER NOT NULL DEFAULT 0,
    smart_journal_entries INTEGER NOT NULL DEFAULT 0,
    export_count INTEGER NOT NULL DEFAULT 0,
    
    -- Tracking period
    tracking_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, subscription_id, tracking_period_start)
);

-- Indexes for performance
CREATE INDEX idx_user_subscriptions_new_user_id ON user_subscriptions_new(user_id);
CREATE INDEX idx_user_subscriptions_new_tier ON user_subscriptions_new(tier);
CREATE INDEX idx_user_subscriptions_new_status ON user_subscriptions_new(status);
CREATE INDEX idx_user_subscriptions_new_family_group ON user_subscriptions_new(family_group_id);
CREATE INDEX idx_user_subscriptions_new_trial_end ON user_subscriptions_new(trial_end_date) WHERE trial_end_date IS NOT NULL;
CREATE INDEX idx_user_subscriptions_new_subscription_end ON user_subscriptions_new(subscription_end_date) WHERE subscription_end_date IS NOT NULL;

CREATE INDEX idx_family_groups_admin ON family_subscription_groups(admin_user_id);
CREATE INDEX idx_family_groups_status ON family_subscription_groups(status);

CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_valid_until ON discount_codes(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX idx_discount_codes_generated_for ON discount_codes(generated_for_user_id) WHERE generated_for_user_id IS NOT NULL;

CREATE INDEX idx_usage_tracking_user_subscription ON subscription_usage_tracking(user_id, subscription_id);
CREATE INDEX idx_usage_tracking_period ON subscription_usage_tracking(tracking_period_start);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_subscriptions_new_updated_at 
    BEFORE UPDATE ON user_subscriptions_new 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_groups_updated_at 
    BEFORE UPDATE ON family_subscription_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at 
    BEFORE UPDATE ON subscription_usage_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get tier limits
CREATE OR REPLACE FUNCTION get_tier_limits(tier_name subscription_tier_new)
RETURNS TABLE (
    playbooks_limit INTEGER,
    devotionals_limit INTEGER,
    smart_journaling_enabled BOOLEAN,
    show_dashboard_counts BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE tier_name
            WHEN 'seeker' THEN 0
            WHEN 'free_trial' THEN 2
            WHEN 'spark' THEN 8
            WHEN 'growth' THEN 20
            WHEN 'transformation' THEN -1  -- Unlimited
            WHEN 'family' THEN -1          -- Unlimited
        END as playbooks_limit,
        CASE tier_name
            WHEN 'seeker' THEN 0
            WHEN 'free_trial' THEN 2
            WHEN 'spark' THEN 8
            WHEN 'growth' THEN 20
            WHEN 'transformation' THEN -1  -- Unlimited
            WHEN 'family' THEN -1          -- Unlimited
        END as devotionals_limit,
        CASE tier_name
            WHEN 'spark' THEN true
            WHEN 'growth' THEN true
            WHEN 'transformation' THEN true
            WHEN 'family' THEN true
            ELSE false
        END as smart_journaling_enabled,
        CASE tier_name
            WHEN 'spark' THEN true
            WHEN 'growth' THEN true
            ELSE false  -- No counts/badges for transformation and family
        END as show_dashboard_counts;
END;
$$ LANGUAGE plpgsql;

-- Function to create default seeker subscription for new users
CREATE OR REPLACE FUNCTION create_default_seeker_subscription(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
    subscription_id UUID;
    tier_limits RECORD;
BEGIN
    -- Get tier limits for seeker
    SELECT * INTO tier_limits FROM get_tier_limits('seeker');
    
    -- Create seeker subscription
    INSERT INTO user_subscriptions_new (
        user_id,
        tier,
        status,
        playbooks_limit,
        devotionals_limit,
        smart_journaling_enabled,
        platform
    ) VALUES (
        target_user_id,
        'seeker',
        'active',
        tier_limits.playbooks_limit,
        tier_limits.devotionals_limit,
        tier_limits.smart_journaling_enabled,
        'local_test'
    ) RETURNING id INTO subscription_id;
    
    -- Create usage tracking record
    INSERT INTO subscription_usage_tracking (
        user_id,
        subscription_id
    ) VALUES (
        target_user_id,
        subscription_id
    );
    
    RETURN subscription_id;
END;
$$ LANGUAGE plpgsql;

-- Function to start free trial (during onboarding)
CREATE OR REPLACE FUNCTION start_free_trial(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
    subscription_id UUID;
    tier_limits RECORD;
BEGIN
    -- Get tier limits for free trial
    SELECT * INTO tier_limits FROM get_tier_limits('free_trial');
    
    -- Update existing seeker subscription to trial
    UPDATE user_subscriptions_new 
    SET 
        tier = 'free_trial',
        status = 'active',
        trial_start_date = NOW(),
        trial_end_date = NOW() + INTERVAL '3 days',
        playbooks_limit = tier_limits.playbooks_limit,
        devotionals_limit = tier_limits.devotionals_limit,
        smart_journaling_enabled = tier_limits.smart_journaling_enabled,
        updated_at = NOW()
    WHERE user_id = target_user_id
    RETURNING id INTO subscription_id;
    
    RETURN subscription_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if trial has expired and downgrade to seeker
CREATE OR REPLACE FUNCTION check_and_handle_expired_trials()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
    tier_limits RECORD;
BEGIN
    -- Get seeker tier limits
    SELECT * INTO tier_limits FROM get_tier_limits('seeker');
    
    -- Update expired trials to seeker
    UPDATE user_subscriptions_new 
    SET 
        tier = 'seeker',
        status = 'active',
        playbooks_limit = tier_limits.playbooks_limit,
        devotionals_limit = tier_limits.devotionals_limit,
        smart_journaling_enabled = tier_limits.smart_journaling_enabled,
        playbooks_used = 0,  -- Reset usage
        devotionals_used = 0,
        updated_at = NOW()
    WHERE 
        tier = 'free_trial' 
        AND trial_end_date IS NOT NULL 
        AND trial_end_date < NOW()
        AND status = 'active';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE user_subscriptions_new IS 'New subscription system - one subscription per user with tier-based limits';
COMMENT ON TABLE family_subscription_groups IS 'Family subscription management for up to 6 members';
COMMENT ON TABLE discount_codes IS 'Dynamic and static discount codes for subscription offers';
COMMENT ON TABLE subscription_usage_tracking IS 'Track usage against subscription limits';

COMMENT ON TYPE subscription_tier_new IS 'New subscription tiers: seeker (freemium), free_trial (3 days), spark (8), growth (20), transformation/family (unlimited)';
COMMENT ON TYPE payment_platform IS 'Payment platforms: apple, google, local_test (for development)';
