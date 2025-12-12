-- Add annual tier variants to subscription_tier_new enum
-- CRITICAL: Run this immediately to fix purchase failures

-- Step 1: Add new enum values for annual tiers
ALTER TYPE subscription_tier_new ADD VALUE IF NOT EXISTS 'spark_annual';
ALTER TYPE subscription_tier_new ADD VALUE IF NOT EXISTS 'growth_annual';
ALTER TYPE subscription_tier_new ADD VALUE IF NOT EXISTS 'transformation_annual';
ALTER TYPE subscription_tier_new ADD VALUE IF NOT EXISTS 'family_annual';

-- Step 2: Update the trial_chosen_tier CHECK constraint to include annual variants
ALTER TABLE user_subscriptions_new 
DROP CONSTRAINT IF EXISTS user_subscriptions_new_trial_chosen_tier_check;

ALTER TABLE user_subscriptions_new 
ADD CONSTRAINT user_subscriptions_new_trial_chosen_tier_check 
CHECK (trial_chosen_tier IN ('spark', 'spark_annual', 'growth', 'growth_annual', 'transformation', 'transformation_annual', 'family', 'family_annual'));

-- Verify the changes
SELECT unnest(enum_range(NULL::subscription_tier_new)) AS tier;
