-- =====================================================
-- SIFIA SAFE MIGRATION SCRIPT
-- =====================================================
-- This script safely adds new tables and columns without
-- conflicting with existing database objects
-- =====================================================

-- Enable necessary extensions (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. SAFE TABLE CREATION WITH IF NOT EXISTS
-- =====================================================

-- User profiles table (safe creation)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  country_code TEXT DEFAULT 'US',
  timezone TEXT DEFAULT 'UTC',
  locale TEXT DEFAULT 'en',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing user_profiles (if they don't exist)
DO $$ 
BEGIN
  -- Add country_code if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_profiles' AND column_name = 'country_code') THEN
    ALTER TABLE user_profiles ADD COLUMN country_code TEXT DEFAULT 'US';
  END IF;
  
  -- Add timezone if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_profiles' AND column_name = 'timezone') THEN
    ALTER TABLE user_profiles ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;
  
  -- Add locale if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_profiles' AND column_name = 'locale') THEN
    ALTER TABLE user_profiles ADD COLUMN locale TEXT DEFAULT 'en';
  END IF;
  
  -- Add onboarding_completed if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE user_profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Subscriptions table with safe column additions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to subscriptions table
DO $$ 
BEGIN
  -- Add tier constraint if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'subscriptions_tier_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check 
    CHECK (tier IN ('free_trial', 'starter', 'growth', 'transformation', 'family'));
  END IF;
  
  -- Add status constraint if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'subscriptions_status_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check 
    CHECK (status IN ('active', 'trial_expired', 'cancelled', 'past_due', 'paused'));
  END IF;
  
  -- Add trial_ends_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add trial_started_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'trial_started_at') THEN
    ALTER TABLE subscriptions ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add amount if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'amount') THEN
    ALTER TABLE subscriptions ADD COLUMN amount INTEGER;
  END IF;
  
  -- Add currency if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'currency') THEN
    ALTER TABLE subscriptions ADD COLUMN currency TEXT DEFAULT 'usd';
  END IF;
  
  -- Add interval_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'interval_type') THEN
    ALTER TABLE subscriptions ADD COLUMN interval_type TEXT;
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_interval_check 
    CHECK (interval_type IN ('month', 'year'));
  END IF;
  
  -- Add market if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'market') THEN
    ALTER TABLE subscriptions ADD COLUMN market TEXT DEFAULT 'US';
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_market_check 
    CHECK (market IN ('US', 'PH'));
  END IF;
  
  -- Add pricing_variant if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'pricing_variant') THEN
    ALTER TABLE subscriptions ADD COLUMN pricing_variant TEXT DEFAULT 'standard';
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_variant_check 
    CHECK (pricing_variant IN ('standard', 'control', 'variant'));
  END IF;
  
  -- Add family columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'family_owner_id') THEN
    ALTER TABLE subscriptions ADD COLUMN family_owner_id UUID REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'family_members') THEN
    ALTER TABLE subscriptions ADD COLUMN family_members JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'max_family_members') THEN
    ALTER TABLE subscriptions ADD COLUMN max_family_members INTEGER DEFAULT 0;
  END IF;
  
  -- Add payment provider columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_customer_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'paymongo_subscription_id') THEN
    ALTER TABLE subscriptions ADD COLUMN paymongo_subscription_id TEXT;
  END IF;
  
  -- Add billing period columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'current_period_start') THEN
    ALTER TABLE subscriptions ADD COLUMN current_period_start TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'current_period_end') THEN
    ALTER TABLE subscriptions ADD COLUMN current_period_end TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'cancelled_at') THEN
    ALTER TABLE subscriptions ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  playbooks_generated INTEGER DEFAULT 0,
  devotionals_generated INTEGER DEFAULT 0,
  journal_entries INTEGER DEFAULT 0,
  smart_journal_entries INTEGER DEFAULT 0,
  openai_tokens_used INTEGER DEFAULT 0,
  api_calls_made INTEGER DEFAULT 0,
  intelligence_queries INTEGER DEFAULT 0,
  template_uses JSONB DEFAULT '{}'::jsonb,
  export_count INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  reset_period TEXT DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to usage_tracking if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'usage_tracking_reset_period_check') THEN
    ALTER TABLE usage_tracking ADD CONSTRAINT usage_tracking_reset_period_check 
    CHECK (reset_period IN ('monthly', 'yearly'));
  END IF;
END $$;

-- User events table
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  page_url TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content library table
CREATE TABLE IF NOT EXISTS content_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  prompt_used TEXT,
  ai_model TEXT DEFAULT 'gpt-4',
  tokens_used INTEGER DEFAULT 0,
  generation_time_ms INTEGER,
  intelligence_level TEXT,
  personalization_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE,
  export_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints to content_library if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'content_library_content_type_check') THEN
    ALTER TABLE content_library ADD CONSTRAINT content_library_content_type_check 
    CHECK (content_type IN ('playbook', 'devotional', 'journal_entry'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'content_library_intelligence_level_check') THEN
    ALTER TABLE content_library ADD CONSTRAINT content_library_intelligence_level_check 
    CHECK (intelligence_level IN ('basic', 'enhanced', 'advanced'));
  END IF;
END $$;

-- Journal templates table
CREATE TABLE IF NOT EXISTS journal_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  prompts JSONB NOT NULL,
  structure JSONB DEFAULT '{}'::jsonb,
  is_premium BOOLEAN DEFAULT FALSE,
  required_tier TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  estimated_time_minutes INTEGER,
  difficulty_level TEXT,
  usage_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints to journal_templates if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'journal_templates_required_tier_check') THEN
    ALTER TABLE journal_templates ADD CONSTRAINT journal_templates_required_tier_check 
    CHECK (required_tier IN ('starter', 'growth', 'transformation', 'family'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'journal_templates_difficulty_check') THEN
    ALTER TABLE journal_templates ADD CONSTRAINT journal_templates_difficulty_check 
    CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced'));
  END IF;
END $$;

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  provider_customer_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  failure_code TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints to payment_transactions if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'payment_transactions_status_check') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_status_check 
    CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'payment_transactions_provider_check') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_provider_check 
    CHECK (provider IN ('stripe', 'paymongo', 'gcash', 'paymaya'));
  END IF;
END $$;

-- A/B test assignments table
CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_name TEXT NOT NULL,
  variant TEXT NOT NULL,
  market TEXT DEFAULT 'US',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  conversion_event TEXT,
  converted_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'ab_test_assignments_user_test_unique') THEN
    ALTER TABLE ab_test_assignments ADD CONSTRAINT ab_test_assignments_user_test_unique 
    UNIQUE(user_id, test_name);
  END IF;
END $$;

-- =====================================================
-- 2. ENABLE RLS (SAFE)
-- =====================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. CREATE RLS POLICIES (WITH DROP IF EXISTS)
-- =====================================================

-- User profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = family_owner_id OR
    auth.uid()::text = ANY(SELECT jsonb_array_elements_text(family_members))
  );

DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;
CREATE POLICY "Users can update own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = family_owner_id);

DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;
CREATE POLICY "Users can insert own subscription" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usage tracking policies
DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON usage_tracking;
CREATE POLICY "Users can update own usage" ON usage_tracking
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own usage" ON usage_tracking;
CREATE POLICY "Users can insert own usage" ON usage_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User events policies
DROP POLICY IF EXISTS "Users can view own events" ON user_events;
CREATE POLICY "Users can view own events" ON user_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own events" ON user_events;
CREATE POLICY "Users can insert own events" ON user_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Content library policies
DROP POLICY IF EXISTS "Users can manage own content" ON content_library;
CREATE POLICY "Users can manage own content" ON content_library
  FOR ALL USING (auth.uid() = user_id);

-- Journal templates policies
DROP POLICY IF EXISTS "Everyone can view templates" ON journal_templates;
CREATE POLICY "Everyone can view templates" ON journal_templates
  FOR SELECT USING (true);

-- Payment transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON payment_transactions;
CREATE POLICY "Users can view own transactions" ON payment_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- A/B test assignments policies
DROP POLICY IF EXISTS "Users can view own test assignments" ON ab_test_assignments;
CREATE POLICY "Users can view own test assignments" ON ab_test_assignments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own test assignments" ON ab_test_assignments;
CREATE POLICY "Users can insert own test assignments" ON ab_test_assignments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. CREATE FUNCTIONS (WITH OR REPLACE)
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Handle new user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Start trial automatically
  INSERT INTO subscriptions (
    user_id,
    tier,
    status,
    trial_started_at,
    trial_ends_at,
    market
  ) VALUES (
    NEW.id,
    'free_trial',
    'active',
    NOW(),
    NOW() + INTERVAL '3 days',
    COALESCE(NEW.raw_user_meta_data->>'country', 'US')
  );
  
  -- Initialize usage tracking
  INSERT INTO usage_tracking (user_id, subscription_id)
  SELECT NEW.id, s.id FROM subscriptions s WHERE s.user_id = NEW.id;
  
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Other utility functions
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE usage_tracking 
  SET 
    playbooks_generated = 0,
    devotionals_generated = 0,
    journal_entries = 0,
    smart_journal_entries = 0,
    openai_tokens_used = 0,
    api_calls_made = 0,
    intelligence_queries = 0,
    export_count = 0,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE 
    reset_period = 'monthly' 
    AND last_reset_date < DATE_TRUNC('month', CURRENT_DATE);
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION check_trial_expirations()
RETURNS void AS $$
BEGIN
  UPDATE subscriptions 
  SET 
    status = 'trial_expired',
    updated_at = NOW()
  WHERE 
    tier = 'free_trial' 
    AND status = 'active'
    AND trial_ends_at < NOW();
END;
$$ language 'plpgsql';

-- =====================================================
-- 5. CREATE TRIGGERS (DROP IF EXISTS FIRST)
-- =====================================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
DROP TRIGGER IF EXISTS update_content_library_updated_at ON content_library;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_library_updated_at BEFORE UPDATE ON content_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 6. CREATE INDEXES (IF NOT EXISTS)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends_at ON subscriptions(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_family_owner ON subscriptions(family_owner_id);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_reset_date ON usage_tracking(last_reset_date);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at);

CREATE INDEX IF NOT EXISTS idx_content_library_user_id ON content_library(user_id);
CREATE INDEX IF NOT EXISTS idx_content_library_type ON content_library(content_type);
CREATE INDEX IF NOT EXISTS idx_content_library_created_at ON content_library(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(provider);

-- =====================================================
-- 7. INSERT JOURNAL TEMPLATES (SAFE)
-- =====================================================

-- Only insert if templates don't exist
INSERT INTO journal_templates (name, description, category, prompts, is_premium, required_tier, tags, estimated_time_minutes)
SELECT * FROM (VALUES
  ('Daily Gratitude', 'Express thankfulness for God''s blessings', 'gratitude', 
   '[{"question": "What are three things you''re grateful for today?", "type": "text"}, {"question": "How did you see God''s hand in your day?", "type": "text"}]'::jsonb, 
   false, null, ARRAY['gratitude', 'daily', 'blessings'], 5),
  
  ('Simple Prayer', 'A basic prayer and reflection template', 'prayer', 
   '[{"question": "What would you like to pray about today?", "type": "text"}, {"question": "How can you trust God with this concern?", "type": "text"}]'::jsonb, 
   false, null, ARRAY['prayer', 'simple', 'trust'], 5),
  
  ('Bible Verse Reflection', 'Reflect on a Bible verse', 'bible_study', 
   '[{"question": "What Bible verse spoke to you today?", "type": "text"}, {"question": "What is God teaching you through this verse?", "type": "text"}]'::jsonb, 
   false, null, ARRAY['bible', 'reflection', 'learning'], 10),
  
  ('Deep Prayer Journey', 'Comprehensive prayer and meditation guide', 'prayer', 
   '[{"question": "Begin with praise - what attributes of God do you want to worship?", "type": "text"}, {"question": "Confession - what do you need to bring before God?", "type": "text"}, {"question": "Thanksgiving - what specific blessings can you thank God for?", "type": "text"}, {"question": "Supplication - what requests do you have for yourself and others?", "type": "text"}]'::jsonb, 
   true, 'starter', ARRAY['prayer', 'comprehensive', 'ACTS'], 15),
  
  ('Spiritual Warfare', 'Prayers for protection and spiritual battles', 'prayer', 
   '[{"question": "What spiritual battles are you facing?", "type": "text"}, {"question": "How can you put on the armor of God today?", "type": "text"}, {"question": "What scriptures will you declare over your situation?", "type": "text"}]'::jsonb, 
   true, 'starter', ARRAY['spiritual_warfare', 'protection', 'armor'], 12)
) AS new_templates(name, description, category, prompts, is_premium, required_tier, tags, estimated_time_minutes)
WHERE NOT EXISTS (
  SELECT 1 FROM journal_templates WHERE journal_templates.name = new_templates.name
);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ siFia database migration completed successfully!';
  RAISE NOTICE '📊 All tables, functions, and policies are now up to date.';
  RAISE NOTICE '🚀 Ready for siFia trial and subscription system!';
END $$;
