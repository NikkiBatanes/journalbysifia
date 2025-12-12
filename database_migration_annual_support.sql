-- Migration: Add Annual Subscription Support
-- Date: 2025-12-12
-- Purpose: Update database constraints to support annual subscription tiers

-- Drop the old CHECK constraint on trial_chosen_tier
ALTER TABLE user_subscriptions_new 
DROP CONSTRAINT IF EXISTS user_subscriptions_new_trial_chosen_tier_check;

-- Add new CHECK constraint that includes annual variants
ALTER TABLE user_subscriptions_new 
ADD CONSTRAINT user_subscriptions_new_trial_chosen_tier_check 
CHECK (trial_chosen_tier IN (
  'spark', 
  'spark_annual',
  'growth', 
  'growth_annual',
  'transformation',
  'transformation_annual'
));

-- Verify the migration
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'user_subscriptions_new_trial_chosen_tier_check';

-- Check for any existing records that might need updating
SELECT 
  id,
  user_id,
  tier,
  trial_chosen_tier,
  platform_subscription_id
FROM user_subscriptions_new 
WHERE tier IN ('spark', 'growth', 'transformation')
  AND platform_subscription_id IS NOT NULL
ORDER BY created_at DESC;
