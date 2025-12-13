-- MANUAL DATABASE CHANGES FOR TRIAL FIX
-- Copy and paste each block into Supabase SQL Editor separately

-- ========================================
-- STEP 1: Add original_transaction_id column
-- ========================================
ALTER TABLE user_subscriptions_new 
ADD COLUMN original_transaction_id TEXT;

-- ========================================
-- STEP 2: Create index for webhook lookups
-- ========================================
CREATE INDEX idx_user_subscriptions_original_transaction_id 
ON user_subscriptions_new(original_transaction_id);

-- ========================================
-- STEP 3: Add billing_cycle column
-- ========================================
ALTER TABLE user_subscriptions_new 
ADD COLUMN billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual'));

-- ========================================
-- STEP 4: Add comments (optional)
-- ========================================
COMMENT ON COLUMN user_subscriptions_new.original_transaction_id IS 
'Apple original transaction ID - never changes across renewals. Used for webhook user lookup.';

COMMENT ON COLUMN user_subscriptions_new.billing_cycle IS 
'Billing cycle: monthly or annual. Extracted from product ID on purchase.';

-- ========================================
-- STEP 5: Verify columns were added
-- ========================================
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions_new' 
AND column_name IN ('original_transaction_id', 'billing_cycle')
ORDER BY column_name;
