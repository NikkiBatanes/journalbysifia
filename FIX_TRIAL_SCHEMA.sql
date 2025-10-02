-- Fix for trial_chosen_tier schema cache error
-- Run this in your Supabase SQL Editor

-- Step 1: Add the trial_chosen_tier column if it doesn't exist
ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS trial_chosen_tier text;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN user_subscriptions_new.trial_chosen_tier IS 'The plan user chose during trial signup (growth, spark, transformation)';

-- Step 3: Update existing trial subscriptions to have a default value
UPDATE user_subscriptions_new 
SET trial_chosen_tier = 'growth'
WHERE tier = 'free_trial' 
AND trial_chosen_tier IS NULL;

-- Step 4: Verify the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_subscriptions_new'
AND column_name = 'trial_chosen_tier';

-- Step 5: Test query to ensure it works
SELECT user_id, tier, trial_chosen_tier, trial_start_date, trial_end_date
FROM user_subscriptions_new 
WHERE tier = 'free_trial'
LIMIT 5;
