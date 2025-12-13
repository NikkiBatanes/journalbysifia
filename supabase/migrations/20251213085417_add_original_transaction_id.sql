-- Add original_transaction_id column for Apple webhook lookups
-- This field stores the FIRST transaction ID and never changes
-- Used to find users during renewals when platform_transaction_id updates

ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;

-- Create index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_original_transaction_id 
ON user_subscriptions_new(original_transaction_id);

-- Add billing_cycle column to track monthly vs annual
ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual'));

-- Add comment for documentation
COMMENT ON COLUMN user_subscriptions_new.original_transaction_id IS 
'Apple original transaction ID - never changes across renewals. Used for webhook user lookup.';

COMMENT ON COLUMN user_subscriptions_new.billing_cycle IS 
'Billing cycle: monthly or annual. Extracted from product ID on purchase.';
