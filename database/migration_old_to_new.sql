-- Migration Script: Old Subscription System to New Subscription System
-- Safe migration for local development environment
-- Created: 2025-08-20

-- Step 1: Backup existing subscription data (if tables exist)
DO $$
BEGIN
    -- Create backup tables if original tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        CREATE TABLE subscriptions_backup AS SELECT * FROM subscriptions;
        RAISE NOTICE 'Created backup: subscriptions_backup';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
        CREATE TABLE user_subscriptions_backup AS SELECT * FROM user_subscriptions;
        RAISE NOTICE 'Created backup: user_subscriptions_backup';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_tracking') THEN
        CREATE TABLE usage_tracking_backup AS SELECT * FROM usage_tracking;
        RAISE NOTICE 'Created backup: usage_tracking_backup';
    END IF;
END $$;

-- Step 2: Apply new subscription schema
\i new_subscription_schema.sql

-- Step 3: Migrate existing user data to new system
DO $$
DECLARE
    user_record RECORD;
    subscription_id UUID;
BEGIN
    -- Migrate all existing users to seeker tier by default
    FOR user_record IN 
        SELECT id FROM user_profiles 
        WHERE NOT EXISTS (
            SELECT 1 FROM user_subscriptions_new WHERE user_id = user_profiles.id
        )
    LOOP
        -- Create default seeker subscription for each user
        SELECT create_default_seeker_subscription(user_record.id) INTO subscription_id;
        RAISE NOTICE 'Created seeker subscription % for user %', subscription_id, user_record.id;
    END LOOP;
    
    RAISE NOTICE 'Migration completed: All users now have seeker subscriptions';
END $$;

-- Step 4: Migrate existing subscription data (if old tables exist)
DO $$
DECLARE
    old_sub_record RECORD;
    new_tier subscription_tier_new;
    tier_limits RECORD;
BEGIN
    -- Only run if old subscription table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions_backup') THEN
        
        FOR old_sub_record IN SELECT * FROM subscriptions_backup WHERE status = 'active' LOOP
            -- Map old tiers to new tiers
            new_tier := CASE 
                WHEN old_sub_record.tier = 'free_trial' THEN 'free_trial'::subscription_tier_new
                WHEN old_sub_record.tier = 'basic' THEN 'spark'::subscription_tier_new
                WHEN old_sub_record.tier = 'starter' THEN 'spark'::subscription_tier_new
                WHEN old_sub_record.tier = 'growth' THEN 'growth'::subscription_tier_new
                WHEN old_sub_record.tier = 'transformation' THEN 'transformation'::subscription_tier_new
                WHEN old_sub_record.tier = 'family' THEN 'family'::subscription_tier_new
                ELSE 'seeker'::subscription_tier_new
            END;
            
            -- Get limits for the new tier
            SELECT * INTO tier_limits FROM get_tier_limits(new_tier);
            
            -- Update user's subscription
            UPDATE user_subscriptions_new 
            SET 
                tier = new_tier,
                status = CASE old_sub_record.status
                    WHEN 'active' THEN 'active'::subscription_status
                    WHEN 'cancelled' THEN 'cancelled'::subscription_status
                    WHEN 'expired' THEN 'expired'::subscription_status
                    ELSE 'active'::subscription_status
                END,
                playbooks_limit = tier_limits.playbooks_limit,
                devotionals_limit = tier_limits.devotionals_limit,
                smart_journaling_enabled = tier_limits.smart_journaling_enabled,
                subscription_start_date = old_sub_record.created_at,
                platform = 'local_test'::payment_platform,
                updated_at = NOW()
            WHERE user_id = old_sub_record.user_id;
            
            RAISE NOTICE 'Migrated subscription for user % from % to %', 
                old_sub_record.user_id, old_sub_record.tier, new_tier;
        END LOOP;
        
        RAISE NOTICE 'Completed migration of existing subscription data';
    ELSE
        RAISE NOTICE 'No existing subscription data to migrate';
    END IF;
END $$;

-- Step 5: Clean up old subscription tables (commented out for safety)
-- Uncomment these lines after verifying migration success

-- DROP TABLE IF EXISTS subscriptions CASCADE;
-- DROP TABLE IF EXISTS user_subscriptions CASCADE; 
-- DROP TABLE IF EXISTS usage_tracking CASCADE;

-- Step 6: Drop old subscription_tier enum if it exists
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
--         DROP TYPE subscription_tier CASCADE;
--         RAISE NOTICE 'Dropped old subscription_tier enum';
--     END IF;
-- END $$;

-- Step 7: Create view for backward compatibility (temporary)
CREATE OR REPLACE VIEW subscriptions_compatibility AS
SELECT 
    id,
    user_id,
    tier::text as tier,
    status::text as status,
    playbooks_limit,
    devotionals_limit,
    smart_journaling_enabled,
    created_at,
    updated_at
FROM user_subscriptions_new;

-- Grant permissions on compatibility view
GRANT SELECT ON subscriptions_compatibility TO authenticated;

-- Step 8: Verification queries
DO $$
DECLARE
    total_users INTEGER;
    total_subscriptions INTEGER;
    seeker_count INTEGER;
    trial_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM user_profiles;
    SELECT COUNT(*) INTO total_subscriptions FROM user_subscriptions_new;
    SELECT COUNT(*) INTO seeker_count FROM user_subscriptions_new WHERE tier = 'seeker';
    SELECT COUNT(*) INTO trial_count FROM user_subscriptions_new WHERE tier = 'free_trial';
    
    RAISE NOTICE 'Migration Verification:';
    RAISE NOTICE 'Total users: %', total_users;
    RAISE NOTICE 'Total subscriptions: %', total_subscriptions;
    RAISE NOTICE 'Seeker subscriptions: %', seeker_count;
    RAISE NOTICE 'Trial subscriptions: %', trial_count;
    
    IF total_users = total_subscriptions THEN
        RAISE NOTICE 'SUCCESS: All users have subscriptions';
    ELSE
        RAISE WARNING 'WARNING: User/subscription count mismatch';
    END IF;
END $$;

-- Final success message
SELECT 'Migration completed successfully! All users now have new subscription system.' as migration_status;
