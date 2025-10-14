-- Fix trial subscription limits
-- All trials should have 2/2 limits regardless of chosen tier
-- The chosen tier only applies AFTER they convert to paid

-- Update all active trial subscriptions to have correct 2/2 limits
UPDATE user_subscriptions_new 
SET 
    playbooks_limit = 2,
    devotionals_limit = 2,
    smart_journaling_enabled = true,
    tier = 'free_trial', -- Ensure tier is set to 'free_trial'
    updated_at = NOW()
WHERE tier = 'free_trial'
  AND trial_end_date > NOW() -- Only active trials
  AND (playbooks_limit != 2 OR devotionals_limit != 2); -- Only if limits are wrong

-- Also fix any trials that have the wrong tier set
-- (tier should be 'free_trial', not the chosen tier)
UPDATE user_subscriptions_new 
SET 
    tier = 'free_trial',
    playbooks_limit = 2,
    devotionals_limit = 2,
    smart_journaling_enabled = true,
    updated_at = NOW()
WHERE trial_start_date IS NOT NULL
  AND trial_end_date IS NOT NULL
  AND trial_end_date > NOW() -- Only active trials
  AND tier != 'free_trial'; -- Tier was incorrectly set to chosen tier

-- Show the updated trials
SELECT 
    user_id,
    tier,
    trial_chosen_tier,
    subscription_display_name,
    playbooks_limit,
    devotionals_limit,
    playbooks_used,
    devotionals_used,
    trial_start_date,
    trial_end_date,
    CASE 
        WHEN trial_end_date > NOW() THEN 'ACTIVE'
        ELSE 'EXPIRED'
    END as trial_status
FROM user_subscriptions_new
WHERE trial_start_date IS NOT NULL
ORDER BY trial_start_date DESC
LIMIT 10;

-- Summary of changes
SELECT 
    'Total Trials' as metric,
    COUNT(*) as count
FROM user_subscriptions_new
WHERE trial_start_date IS NOT NULL
UNION ALL
SELECT 
    'Active Trials' as metric,
    COUNT(*) as count
FROM user_subscriptions_new
WHERE tier = 'free_trial' AND trial_end_date > NOW()
UNION ALL
SELECT 
    'Trials with Correct Limits (2/2)' as metric,
    COUNT(*) as count
FROM user_subscriptions_new
WHERE tier = 'free_trial' 
  AND trial_end_date > NOW()
  AND playbooks_limit = 2 
  AND devotionals_limit = 2;
