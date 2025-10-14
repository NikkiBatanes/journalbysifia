-- Verification script for subscription_display_name implementation
-- Run this AFTER executing add_subscription_display_name.sql

-- 1. Verify column exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions_new' 
AND column_name = 'subscription_display_name';

-- Expected: Should return one row showing TEXT column

-- 2. Check all existing subscriptions have display names
SELECT 
    tier,
    trial_chosen_tier,
    subscription_display_name,
    COUNT(*) as count
FROM user_subscriptions_new
GROUP BY tier, trial_chosen_tier, subscription_display_name
ORDER BY tier, trial_chosen_tier;

-- Expected: All records should have non-null subscription_display_name

-- 3. Verify trial subscriptions show tier-specific names
SELECT 
    user_id,
    tier,
    trial_chosen_tier,
    subscription_display_name,
    trial_start_date,
    trial_end_date
FROM user_subscriptions_new
WHERE tier = 'free_trial'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: subscription_display_name should be like "siFia Spark Trial", "siFia Growth Trial", etc.

-- 4. Verify paid subscriptions have correct names
SELECT 
    user_id,
    tier,
    subscription_display_name,
    status,
    created_at
FROM user_subscriptions_new
WHERE tier IN ('spark', 'growth', 'transformation', 'family')
ORDER BY created_at DESC
LIMIT 5;

-- Expected: subscription_display_name should be like "siFia Spark", "siFia Growth", etc.

-- 5. Verify seeker subscriptions
SELECT 
    user_id,
    tier,
    subscription_display_name,
    created_at
FROM user_subscriptions_new
WHERE tier = 'seeker'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: subscription_display_name should be "siFia Seeker"

-- 6. Check for any NULL display names (should be none)
SELECT 
    COUNT(*) as null_display_names
FROM user_subscriptions_new
WHERE subscription_display_name IS NULL;

-- Expected: 0

-- 7. Summary statistics
SELECT 
    'Total Subscriptions' as metric,
    COUNT(*) as value
FROM user_subscriptions_new
UNION ALL
SELECT 
    'With Display Names' as metric,
    COUNT(*) as value
FROM user_subscriptions_new
WHERE subscription_display_name IS NOT NULL
UNION ALL
SELECT 
    'Active Trials' as metric,
    COUNT(*) as value
FROM user_subscriptions_new
WHERE tier = 'free_trial' 
AND trial_end_date > NOW()
UNION ALL
SELECT 
    'Paid Subscriptions' as metric,
    COUNT(*) as value
FROM user_subscriptions_new
WHERE tier IN ('spark', 'growth', 'transformation', 'family');

-- Expected: All subscriptions should have display names
