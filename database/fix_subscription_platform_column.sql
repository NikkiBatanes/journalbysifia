-- Fix missing platform column in user_subscriptions_new table
-- This addresses the "Could not find the 'platform' column" error

-- First, check if the table exists and add the column if missing
DO $$ 
BEGIN
    -- Check if platform column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'platform'
    ) THEN
        -- Create payment_platform enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_platform') THEN
            CREATE TYPE payment_platform AS ENUM (
                'apple',
                'google',
                'local_test'
            );
        END IF;
        
        -- Add the platform column
        ALTER TABLE user_subscriptions_new 
        ADD COLUMN platform payment_platform DEFAULT 'local_test';
        
        RAISE NOTICE 'Added platform column to user_subscriptions_new table';
    ELSE
        RAISE NOTICE 'Platform column already exists in user_subscriptions_new table';
    END IF;
    
    -- Also add other potentially missing columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'platform_subscription_id'
    ) THEN
        ALTER TABLE user_subscriptions_new 
        ADD COLUMN platform_subscription_id TEXT;
        
        RAISE NOTICE 'Added platform_subscription_id column';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'platform_transaction_id'
    ) THEN
        ALTER TABLE user_subscriptions_new 
        ADD COLUMN platform_transaction_id TEXT;
        
        RAISE NOTICE 'Added platform_transaction_id column';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'platform_receipt_data'
    ) THEN
        ALTER TABLE user_subscriptions_new 
        ADD COLUMN platform_receipt_data JSONB;
        
        RAISE NOTICE 'Added platform_receipt_data column';
    END IF;
    
END $$;

-- Update any existing records to have the default platform
UPDATE user_subscriptions_new 
SET platform = 'local_test' 
WHERE platform IS NULL;

-- Show the current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions_new' 
ORDER BY ordinal_position;
