-- Safe Migration Script for Existing Database
-- Handles existing tables and creates only what's missing
-- Created: 2025-08-20

-- Enable necessary extensions (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create new enums only if they don't exist
DO $$ BEGIN
    CREATE TYPE subscription_tier_new AS ENUM (
        'seeker',           -- Freemium: 0/0 limits after trial, 1 playbook during onboarding
        'free_trial',       -- 2/2 free for 3 days
        'spark',            -- 8 playbooks/devotionals + smart journaling
        'growth',           -- 20 playbooks/devotionals
        'transformation',   -- Unlimited (no dashboard counts)
        'family'            -- Unlimited for up to 6 members
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM (
        'active',
        'cancelled', 
        'expired',
        'pending_payment',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_platform AS ENUM (
        'apple',
        'google',
        'local_test'  -- For local testing without app store
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE family_role AS ENUM (
        'admin',
        'parent',
        'teen',
        'child'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_subscriptions_new table (main subscription table)
CREATE TABLE IF NOT EXISTS user_subscriptions_new (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Subscription tier and status
    tier subscription_tier_new NOT NULL DEFAULT 'seeker',
    status subscription_status NOT NULL DEFAULT 'active',
    
    -- Usage limits and tracking
    playbooks_limit integer NOT NULL DEFAULT 0,
    devotionals_limit integer NOT NULL DEFAULT 0,
    playbooks_used integer NOT NULL DEFAULT 0,
    devotionals_used integer NOT NULL DEFAULT 0,
    smart_journaling_enabled boolean NOT NULL DEFAULT false,
    
    -- Trial information
    trial_start_date timestamptz,
    trial_end_date timestamptz,
    
    -- Subscription dates
    subscription_start_date timestamptz,
    subscription_end_date timestamptz,
    
    -- Payment platform info
    platform payment_platform DEFAULT 'local_test',
    platform_subscription_id text,
    platform_transaction_id text,
    
    -- Billing
    billing_cycle text CHECK (billing_cycle IN ('monthly', 'annual')),
    next_billing_date timestamptz,
    
    -- Metadata
    metadata jsonb DEFAULT '{}',
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(user_id),
    CHECK (playbooks_used >= 0),
    CHECK (devotionals_used >= 0),
    CHECK (playbooks_limit >= 0),
    CHECK (devotionals_limit >= 0)
);

-- Create family_subscription_groups table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS family_subscription_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_name text NOT NULL,
    max_members integer NOT NULL DEFAULT 6,
    current_members integer NOT NULL DEFAULT 1,
    
    -- Payment info
    platform payment_platform DEFAULT 'local_test',
    platform_subscription_id text,
    
    status subscription_status NOT NULL DEFAULT 'active',
    metadata jsonb DEFAULT '{}',
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CHECK (current_members <= max_members),
    CHECK (current_members >= 0),
    CHECK (max_members > 0)
);

-- Create family_members table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS family_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id uuid NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role family_role NOT NULL DEFAULT 'child',
    joined_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(family_group_id, user_id)
);

-- Update existing discount_codes table or create if it doesn't exist
DO $$
BEGIN
    -- Check if discount_codes table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'discount_codes') THEN
        -- Add missing columns to existing table
        BEGIN
            ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS discount_percentage numeric;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
        
        BEGIN
            ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT now();
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
        
        BEGIN
            ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS valid_until timestamptz DEFAULT (now() + interval '30 days');
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
        
        BEGIN
            ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_uses integer DEFAULT 1;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
        
        BEGIN
            ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS generated_for_user_id uuid REFERENCES auth.users(id);
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
        
        BEGIN
            ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS trigger_event text DEFAULT 'manual';
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
    ELSE
        -- Create new discount_codes table
        CREATE TABLE discount_codes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            code text NOT NULL UNIQUE,
            discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
            discount_value numeric NOT NULL,
            discount_percentage numeric, -- For compatibility
            
            applicable_tiers text[] DEFAULT ARRAY['spark', 'growth', 'transformation', 'family'],
            
            valid_from timestamptz NOT NULL DEFAULT now(),
            valid_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
            
            max_uses integer DEFAULT 1,
            times_used integer DEFAULT 0,
            
            is_dynamic boolean DEFAULT false,
            generated_for_user_id uuid REFERENCES auth.users(id),
            trigger_event text DEFAULT 'manual',
            
            is_active boolean DEFAULT true,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            
            CHECK (times_used <= max_uses),
            CHECK (discount_value > 0)
        );
    END IF;
END
$$;

-- Create subscription_usage_tracking table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS subscription_usage_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Usage counters
    playbooks_generated integer NOT NULL DEFAULT 0,
    devotionals_generated integer NOT NULL DEFAULT 0,
    smart_journal_entries integer NOT NULL DEFAULT 0,
    export_count integer NOT NULL DEFAULT 0,
    
    -- Tracking period
    tracking_period_start timestamptz NOT NULL DEFAULT now(),
    last_reset_date timestamptz NOT NULL DEFAULT now(),
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_user_id ON user_subscriptions_new(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_tier ON user_subscriptions_new(tier);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_status ON user_subscriptions_new(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_trial_end ON user_subscriptions_new(trial_end_date) WHERE trial_end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_family_subscription_groups_admin ON family_subscription_groups(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_group_id ON family_members(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_valid_until ON discount_codes(valid_until);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

-- Row Level Security (RLS) policies
ALTER TABLE user_subscriptions_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_subscription_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions_new
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions_new;
CREATE POLICY "Users can view own subscription" ON user_subscriptions_new
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions_new;
CREATE POLICY "Users can update own subscription" ON user_subscriptions_new
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for family_subscription_groups
DROP POLICY IF EXISTS "Family admin can manage group" ON family_subscription_groups;
CREATE POLICY "Family admin can manage group" ON family_subscription_groups
    FOR ALL USING (auth.uid() = admin_user_id);

DROP POLICY IF EXISTS "Family members can view group" ON family_subscription_groups;
CREATE POLICY "Family members can view group" ON family_subscription_groups
    FOR SELECT USING (
        id IN (
            SELECT family_group_id FROM family_members 
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for family_members
DROP POLICY IF EXISTS "Family admin can manage members" ON family_members;
CREATE POLICY "Family admin can manage members" ON family_members
    FOR ALL USING (
        family_group_id IN (
            SELECT id FROM family_subscription_groups 
            WHERE admin_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view own family membership" ON family_members;
CREATE POLICY "Users can view own family membership" ON family_members
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for subscription_usage_tracking
DROP POLICY IF EXISTS "Users can view own usage tracking" ON subscription_usage_tracking;
CREATE POLICY "Users can view own usage tracking" ON subscription_usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage tracking" ON subscription_usage_tracking;
CREATE POLICY "Users can update own usage tracking" ON subscription_usage_tracking
    FOR UPDATE USING (auth.uid() = user_id);

-- Database functions
CREATE OR REPLACE FUNCTION create_default_seeker_subscription(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_id uuid;
BEGIN
    -- Check if subscription already exists
    SELECT id INTO subscription_id 
    FROM user_subscriptions_new 
    WHERE user_id = target_user_id;
    
    IF subscription_id IS NOT NULL THEN
        RETURN subscription_id;
    END IF;
    
    -- Create new seeker subscription
    INSERT INTO user_subscriptions_new (
        user_id,
        tier,
        status,
        playbooks_limit,
        devotionals_limit,
        playbooks_used,
        devotionals_used,
        smart_journaling_enabled
    ) VALUES (
        target_user_id,
        'seeker',
        'active',
        0,  -- Seeker has 0/0 limits after trial
        0,
        0,
        0,
        false
    ) RETURNING id INTO subscription_id;
    
    -- Create usage tracking record
    INSERT INTO subscription_usage_tracking (user_id)
    VALUES (target_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN subscription_id;
END;
$$;

CREATE OR REPLACE FUNCTION start_free_trial(target_user_id uuid, duration_days integer DEFAULT 3)
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
            trial_end_date
        ) VALUES (
            target_user_id,
            'free_trial',
            'active',
            2,
            2,
            now(),
            trial_end
        ) RETURNING id INTO subscription_id;
        
        -- Create usage tracking record
        INSERT INTO subscription_usage_tracking (user_id)
        VALUES (target_user_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    RETURN subscription_id;
END;
$$;

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

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_user_subscriptions_new_updated_at ON user_subscriptions_new;
CREATE TRIGGER update_user_subscriptions_new_updated_at 
    BEFORE UPDATE ON user_subscriptions_new 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_subscription_groups_updated_at ON family_subscription_groups;
CREATE TRIGGER update_family_subscription_groups_updated_at 
    BEFORE UPDATE ON family_subscription_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_usage_tracking_updated_at ON subscription_usage_tracking;
CREATE TRIGGER update_subscription_usage_tracking_updated_at 
    BEFORE UPDATE ON subscription_usage_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON user_subscriptions_new TO authenticated;
GRANT SELECT, INSERT, UPDATE ON family_subscription_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_members TO authenticated;
GRANT SELECT ON discount_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON subscription_usage_tracking TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_default_seeker_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION start_free_trial(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_handle_expired_trials() TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Safe migration completed successfully!';
    RAISE NOTICE 'New subscription system tables and functions are ready.';
END
$$;
