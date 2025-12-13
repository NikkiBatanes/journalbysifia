-- Add last_usage_reset column to track monthly resets for annual subscriptions
-- This enables monthly usage resets (playbooks/devotionals) while billing remains annual

ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS last_usage_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set existing records to their updated_at date as starting point
UPDATE user_subscriptions_new 
SET last_usage_reset = updated_at 
WHERE last_usage_reset IS NULL;

-- Create index for efficient reset checks
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_last_usage_reset 
ON user_subscriptions_new(last_usage_reset);

-- Add comment for documentation
COMMENT ON COLUMN user_subscriptions_new.last_usage_reset IS 
'Tracks when usage counters (playbooks_used, devotionals_used) were last reset. Used for monthly resets on annual subscriptions.';
