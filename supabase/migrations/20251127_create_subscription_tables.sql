-- Create user_subscriptions_new table for subscription management
-- This table tracks user subscriptions, tier limits, and usage

CREATE TABLE IF NOT EXISTS user_subscriptions_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Subscription tier and status
  tier TEXT NOT NULL DEFAULT 'seeker' CHECK (tier IN (
    'seeker',
    'free_trial',
    'spark', 'spark_annual',
    'growth', 'growth_annual',
    'transformation', 'transformation_annual'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'refunded')),
  
  -- Display name for UI
  subscription_display_name TEXT NOT NULL DEFAULT 'siFia Seeker',
  
  -- Tier limits
  playbooks_limit INTEGER NOT NULL DEFAULT 2,
  devotionals_limit INTEGER NOT NULL DEFAULT 1,
  smart_journaling_enabled BOOLEAN NOT NULL DEFAULT false,
  show_dashboard_counts BOOLEAN NOT NULL DEFAULT true,
  
  -- Usage tracking
  playbooks_used INTEGER NOT NULL DEFAULT 0,
  devotionals_used INTEGER NOT NULL DEFAULT 0,
  last_usage_reset TIMESTAMPTZ,
  
  -- Trial-specific fields
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  trial_chosen_tier TEXT CHECK (trial_chosen_tier IN (
    'spark', 'spark_annual',
    'growth', 'growth_annual',
    'transformation', 'transformation_annual'
  )),
  trial_converted_date TIMESTAMPTZ,
  trial_cancelled_date TIMESTAMPTZ,
  
  -- Subscription lifecycle
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  auto_renew_enabled BOOLEAN NOT NULL DEFAULT true,
  cancellation_date TIMESTAMPTZ,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  
  -- Platform integration
  platform TEXT,
  platform_subscription_id TEXT,
  platform_transaction_id TEXT,
  original_transaction_id TEXT,
  
  -- Grace period for payment failures
  billing_issue BOOLEAN NOT NULL DEFAULT false,
  grace_period_end_date TIMESTAMPTZ,
  
  -- Discount codes
  discount_code TEXT,
  discount_applied_amount DECIMAL(10, 2),
  discount_percentage INTEGER,
  
  -- Refund tracking
  refund_date TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one subscription per user
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_user_id ON user_subscriptions_new(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_tier ON user_subscriptions_new(tier);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_status ON user_subscriptions_new(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_original_transaction_id ON user_subscriptions_new(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_new_platform_subscription_id ON user_subscriptions_new(platform_subscription_id);

-- Create validated_receipts table for receipt validation logging
CREATE TABLE IF NOT EXISTS validated_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Receipt data
  transaction_id TEXT NOT NULL,
  original_transaction_id TEXT,
  product_id TEXT NOT NULL,
  
  -- Validation result
  is_valid BOOLEAN NOT NULL,
  validation_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Receipt metadata
  receipt_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validated_receipts_user_id ON validated_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_validated_receipts_transaction_id ON validated_receipts(transaction_id);

-- Enable Row Level Security
ALTER TABLE user_subscriptions_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE validated_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_subscriptions_new
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions_new FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions_new FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions_new FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for validated_receipts
CREATE POLICY "Users can view own receipts"
  ON validated_receipts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage receipts"
  ON validated_receipts FOR ALL
  USING (auth.role() = 'service_role');

-- Create RPC function to create default seeker subscription
CREATE OR REPLACE FUNCTION create_default_seeker_subscription(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_subscriptions_new (
    user_id,
    tier,
    status,
    subscription_display_name,
    playbooks_limit,
    devotionals_limit,
    smart_journaling_enabled,
    show_dashboard_counts,
    playbooks_used,
    devotionals_used,
    created_at,
    updated_at
  )
  VALUES (
    target_user_id,
    'seeker',
    'active',
    'siFia Seeker',
    2,
    1,
    false,
    true,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to check and handle expired trials
CREATE OR REPLACE FUNCTION check_and_handle_expired_trials()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Update expired trials to seeker tier
  UPDATE user_subscriptions_new
  SET 
    tier = 'seeker',
    subscription_display_name = 'siFia Seeker',
    playbooks_limit = 2,
    devotionals_limit = 1,
    smart_journaling_enabled = false,
    playbooks_used = 0,
    devotionals_used = 0,
    trial_end_date = NULL,
    trial_start_date = NULL,
    trial_chosen_tier = NULL,
    status = 'active',
    updated_at = NOW()
  WHERE 
    tier = 'free_trial' 
    AND trial_end_date IS NOT NULL 
    AND trial_end_date < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_subscriptions_new_updated_at
  BEFORE UPDATE ON user_subscriptions_new
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for validated_receipts
CREATE TRIGGER update_validated_receipts_updated_at
  BEFORE UPDATE ON validated_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
