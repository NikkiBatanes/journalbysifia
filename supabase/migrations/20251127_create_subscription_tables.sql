-- Create user_subscriptions_new table for subscription management
-- This table replaces the old subscriptions table with the new tier-based system

CREATE TABLE IF NOT EXISTS user_subscriptions_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL DEFAULT 'seeker' CHECK (tier IN ('seeker', 'spark', 'growth', 'transformation', 'family', 'free_trial')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  
  -- Subscription limits based on tier
  playbooks_limit INTEGER NOT NULL DEFAULT 3,
  devotionals_limit INTEGER NOT NULL DEFAULT 1,
  
  -- Usage tracking
  playbooks_used INTEGER NOT NULL DEFAULT 0,
  devotionals_used INTEGER NOT NULL DEFAULT 0,
  
  -- Subscription dates
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  
  -- Platform and subscription identifiers
  platform VARCHAR(20) CHECK (platform IN ('apple', 'google', 'web')),
  platform_subscription_id TEXT,
  
  -- Display and metadata
  subscription_display_name TEXT,
  trial_chosen_tier VARCHAR(50) CHECK (trial_chosen_tier IN ('spark', 'growth', 'transformation', 'family')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id) -- One subscription per user
);

-- Create validated_receipts table for receipt validation logging
CREATE TABLE IF NOT EXISTS validated_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('apple', 'google')),
  receipt_data TEXT NOT NULL,
  validation_response JSONB NOT NULL,
  product_id TEXT,
  transaction_id TEXT,
  expires_date TIMESTAMPTZ,
  is_valid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_user_id ON user_subscriptions_new(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_tier ON user_subscriptions_new(tier);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_status ON user_subscriptions_new(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_platform ON user_subscriptions_new(platform);

CREATE INDEX IF NOT EXISTS idx_validated_receipts_user_id ON validated_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_validated_receipts_platform ON validated_receipts(platform);
CREATE INDEX IF NOT EXISTS idx_validated_receipts_transaction_id ON validated_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_validated_receipts_created_at ON validated_receipts(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE user_subscriptions_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE validated_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions_new
-- Users can read their own subscription
CREATE POLICY "Users can view own subscription" ON user_subscriptions_new
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own subscription
CREATE POLICY "Users can update own subscription" ON user_subscriptions_new
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON user_subscriptions_new
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for validated_receipts
-- Users can read their own receipt validations
CREATE POLICY "Users can view own receipts" ON validated_receipts
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access receipts" ON validated_receipts
  FOR ALL USING (auth.role() = 'service_role');

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_subscriptions_new_updated_at
  BEFORE UPDATE ON user_subscriptions_new
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription for existing users (optional)
-- This can be run manually after migration
INSERT INTO user_subscriptions_new (user_id, tier, status, playbooks_limit, devotionals_limit)
SELECT 
  id,
  'seeker',
  'active',
  3,
  1
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions_new)
AND id IS NOT NULL;
