-- Apply database changes for trial fix
-- Run this in Supabase SQL Editor

-- Add original_transaction_id column for Apple webhook lookups
ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;

-- Create index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_original_transaction_id 
ON user_subscriptions_new(original_transaction_id);

-- Add billing_cycle column to track monthly vs annual
ALTER TABLE user_subscriptions_new 
ADD COLUMN IF NOT EXISTS billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual'));

-- Add comments for documentation
COMMENT ON COLUMN user_subscriptions_new.original_transaction_id IS 
'Apple original transaction ID - never changes across renewals. Used for webhook user lookup.';

COMMENT ON COLUMN user_subscriptions_new.billing_cycle IS 
'Billing cycle: monthly or annual. Extracted from product ID on purchase.';

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions_new' 
AND column_name IN ('original_transaction_id', 'billing_cycle')
ORDER BY column_name;
