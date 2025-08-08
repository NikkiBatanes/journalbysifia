-- Complete Subscription + Intelligence Database Schema
-- siFia Application - Enterprise Grade Implementation
-- Created: 2025-08-05

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUMS AND TYPES
-- =============================================

-- Subscription tiers with intelligence levels
-- Use DO block to handle existing types gracefully
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM (
      'free_trial',      -- 3-day trial with full features
      'basic',           -- FREE freemium model - limited features, no intelligence
      'starter',         -- $6.99/month - Basic intelligence
      'growth',          -- $12.99/month - Enhanced intelligence
      'transformation',  -- $24.99/month - Advanced intelligence + priority
      'family',          -- $34.99/month - All features for family
      'starter_annual',  -- Annual starter plan
      'growth_annual',   -- Annual growth plan
      'transformation_annual', -- Annual transformation plan
      'family_annual'    -- Annual family plan
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'active', 
    'canceled', 
    'past_due', 
    'unpaid', 
    'trialing', 
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE generation_type AS ENUM (
    'playbook', 
    'devotional', 
    'expansion', 
    'regeneration'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE queue_status AS ENUM (
    'pending', 
    'processing', 
    'completed', 
    'failed', 
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE intelligence_level AS ENUM (
    'basic',     -- Free/Starter: No intelligence
    'enhanced',  -- Lite: Basic personalization
    'advanced'   -- Pro/Family/Enterprise: Full intelligence
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- SUBSCRIPTION TABLES
-- =============================================

-- User subscriptions with intelligence features
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free_trial',
  status subscription_status NOT NULL DEFAULT 'trialing',
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  price_id TEXT,
  
  -- Dates
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  
  -- Pending billing (for trial-to-paid conversion)
  pending_tier subscription_tier,
  pending_price_cents INTEGER,
  pending_currency TEXT DEFAULT 'usd',
  pending_interval TEXT, -- 'month' or 'year'
  
  -- Intelligence features by tier
  intelligence_enabled BOOLEAN DEFAULT false,
  advanced_analytics BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  export_features BOOLEAN DEFAULT false,
  
  -- Family plan specific
  family_owner_id UUID REFERENCES auth.users(id),
  family_members UUID[] DEFAULT '{}',
  max_family_members INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Simple usage tracking (what users see)
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- YYYY-MM format
  
  -- Simple counters for users (what they see)
  playbooks_used INTEGER DEFAULT 0,
  devotionals_used INTEGER DEFAULT 0,
  
  -- Internal tracking (hidden from users)
  ai_tokens_used INTEGER DEFAULT 0,
  ai_cost_cents INTEGER DEFAULT 0, -- Cost in cents
  intelligence_score FLOAT DEFAULT 0,
  
  -- Export and feature usage
  exports_used INTEGER DEFAULT 0,
  api_calls_used INTEGER DEFAULT 0,
  last_export_date TIMESTAMPTZ,
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period)
);

-- Billing history for transparency
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id),
  
  -- Billing details
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL, -- paid, failed, pending, refunded
  
  -- Stripe integration
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_method TEXT,
  
  -- Dates
  billing_date TIMESTAMPTZ NOT NULL,
  next_billing_date TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INTELLIGENCE SYSTEM TABLES
-- =============================================

-- User intelligence profiles (LOCAL PROCESSING)
CREATE TABLE IF NOT EXISTS user_intelligence_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic profile data (LOCAL ANALYSIS)
  spiritual_maturity TEXT DEFAULT 'beginner', -- beginner, growing, mature
  learning_style TEXT DEFAULT 'balanced', -- visual, auditory, reading, kinesthetic, balanced
  preferred_challenge_level TEXT DEFAULT 'moderate', -- gentle, moderate, intense
  communication_style TEXT DEFAULT 'balanced', -- direct, gentle, encouraging, balanced
  
  -- Success patterns (LOCAL TRACKING)
  successful_playbook_types TEXT[] DEFAULT '{}',
  successful_devotional_types TEXT[] DEFAULT '{}',
  optimal_action_step_count INTEGER DEFAULT 5,
  preferred_content_length TEXT DEFAULT 'medium', -- short, medium, long
  
  -- Engagement patterns (LOCAL ANALYTICS)
  best_engagement_times INTEGER[] DEFAULT '{}', -- hours of day (0-23)
  typical_session_length INTEGER DEFAULT 15, -- minutes
  preferred_session_frequency INTEGER DEFAULT 3, -- times per week
  
  -- Completion patterns (LOCAL CALCULATION)
  average_completion_rate FLOAT DEFAULT 0, -- 0.0 to 1.0
  consistency_score FLOAT DEFAULT 0, -- 0.0 to 1.0
  engagement_depth_score FLOAT DEFAULT 0, -- 0.0 to 1.0
  
  -- Growth tracking (LOCAL ANALYSIS)
  focus_areas TEXT[] DEFAULT '{}', -- areas user focuses on
  growth_areas TEXT[] DEFAULT '{}', -- areas needing improvement
  strength_areas TEXT[] DEFAULT '{}', -- user's strong areas
  
  -- Personalization preferences (USER INPUT + LEARNING)
  preferred_bible_versions TEXT[] DEFAULT '{"NIV"}',
  favorite_topics TEXT[] DEFAULT '{}',
  avoided_topics TEXT[] DEFAULT '{}',
  
  -- Intelligence metadata
  confidence_score FLOAT DEFAULT 0, -- How confident we are in this profile
  data_points_count INTEGER DEFAULT 0, -- Number of interactions analyzed
  last_analysis TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Behavior tracking for intelligence (LOCAL ANALYTICS)
-- Note: user_behavior_events table already exists, so we'll add missing columns if needed

-- Add missing columns to existing user_behavior_events table
DO $$
BEGIN
  -- Add event_category column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'event_category') THEN
    ALTER TABLE user_behavior_events ADD COLUMN event_category TEXT DEFAULT 'engagement';
  END IF;
  
  -- Add playbook_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'playbook_id') THEN
    ALTER TABLE user_behavior_events ADD COLUMN playbook_id UUID;
  END IF;
  
  -- Add devotional_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'devotional_id') THEN
    ALTER TABLE user_behavior_events ADD COLUMN devotional_id UUID;
  END IF;
  
  -- Add journal_entry_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'journal_entry_id') THEN
    ALTER TABLE user_behavior_events ADD COLUMN journal_entry_id UUID;
  END IF;
  
  -- Add sequence_number column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'sequence_number') THEN
    ALTER TABLE user_behavior_events ADD COLUMN sequence_number INTEGER;
  END IF;
  
  -- Add duration_seconds column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'duration_seconds') THEN
    ALTER TABLE user_behavior_events ADD COLUMN duration_seconds INTEGER;
  END IF;
  
  -- Add engagement_score column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'engagement_score') THEN
    ALTER TABLE user_behavior_events ADD COLUMN engagement_score FLOAT DEFAULT 0;
  END IF;
  
  -- Add success_indicator column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_behavior_events' 
                 AND column_name = 'success_indicator') THEN
    ALTER TABLE user_behavior_events ADD COLUMN success_indicator BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for user_behavior_events if they don't exist
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_type ON user_behavior_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_category ON user_behavior_events (event_category);
CREATE INDEX IF NOT EXISTS idx_behavior_events_created ON user_behavior_events (created_at);

-- Content effectiveness tracking (LEARNING SYSTEM)
CREATE TABLE IF NOT EXISTS content_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content identification
  content_type TEXT NOT NULL, -- playbook, devotional
  content_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Effectiveness metrics (LOCAL CALCULATION)
  completion_rate FLOAT DEFAULT 0,
  engagement_score FLOAT DEFAULT 0,
  time_to_complete INTEGER, -- minutes
  user_rating INTEGER, -- 1-5 if provided
  
  -- Success indicators
  completed_successfully BOOLEAN DEFAULT false,
  user_feedback_positive BOOLEAN,
  led_to_further_engagement BOOLEAN DEFAULT false,
  
  -- Learning data for improvement
  difficulty_match_score FLOAT DEFAULT 0, -- How well difficulty matched user
  personalization_effectiveness FLOAT DEFAULT 0,
  
  -- Metadata
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(content_id, user_id)
);

-- =============================================
-- INTELLIGENT QUEUE SYSTEM
-- =============================================

-- Generation queue with intelligence and priority
CREATE TABLE IF NOT EXISTS generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Queue management
  type generation_type NOT NULL,
  priority INTEGER NOT NULL DEFAULT 4, -- 1=family, 2=transformation, 3=growth, 4=starter, 5=basic/free_trial
  status queue_status NOT NULL DEFAULT 'pending',
  
  -- Generation data
  user_input TEXT NOT NULL,
  user_name TEXT NOT NULL,
  additional_params JSONB DEFAULT '{}',
  
  -- Intelligence enhancement
  intelligence_level intelligence_level DEFAULT 'basic',
  user_profile_data JSONB DEFAULT '{}', -- Snapshot of user profile for generation
  personalization_enabled BOOLEAN DEFAULT false,
  
  -- Processing tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Results and errors
  result_id UUID, -- References playbooks or devotionals table
  error_message TEXT,
  processing_time_seconds INTEGER,
  
  -- Cost tracking
  tokens_used INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end ON user_subscriptions(trial_end_date) WHERE trial_end_date IS NOT NULL;

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_period ON usage_tracking(user_id, period);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period);

-- Intelligence indexes
CREATE INDEX IF NOT EXISTS idx_user_intelligence_profiles_user_id ON user_intelligence_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_intelligence_profiles_maturity ON user_intelligence_profiles(spiritual_maturity);
CREATE INDEX IF NOT EXISTS idx_user_intelligence_profiles_updated ON user_intelligence_profiles(updated_at DESC);

-- Behavior events indexes
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_id ON user_behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON user_behavior_events(event_type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_category ON user_behavior_events(event_category);
CREATE INDEX IF NOT EXISTS idx_behavior_events_created ON user_behavior_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_session ON user_behavior_events(session_id) WHERE session_id IS NOT NULL;

-- Content effectiveness indexes
CREATE INDEX IF NOT EXISTS idx_content_effectiveness_content ON content_effectiveness(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_effectiveness_user ON content_effectiveness(user_id);
CREATE INDEX IF NOT EXISTS idx_content_effectiveness_completion ON content_effectiveness(completion_rate DESC);

-- Queue indexes
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_priority ON generation_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_generation_queue_user ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_type ON generation_queue(type);
CREATE INDEX IF NOT EXISTS idx_generation_queue_processing ON generation_queue(status, priority, created_at) WHERE status IN ('pending', 'processing');

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_intelligence_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;

-- Subscription policies
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
CREATE POLICY "Users can update own subscription" ON user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Usage tracking policies
DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Billing history policies
DROP POLICY IF EXISTS "Users can view own billing" ON billing_history;
CREATE POLICY "Users can view own billing" ON billing_history
  FOR SELECT USING (auth.uid() = user_id);

-- Intelligence profile policies
DROP POLICY IF EXISTS "Users can view own intelligence profile" ON user_intelligence_profiles;
CREATE POLICY "Users can view own intelligence profile" ON user_intelligence_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own intelligence profile" ON user_intelligence_profiles;
CREATE POLICY "Users can update own intelligence profile" ON user_intelligence_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Behavior events policies
DROP POLICY IF EXISTS "Users can view own behavior events" ON user_behavior_events;
CREATE POLICY "Users can view own behavior events" ON user_behavior_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own behavior events" ON user_behavior_events;
CREATE POLICY "Users can insert own behavior events" ON user_behavior_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Content effectiveness policies
DROP POLICY IF EXISTS "Users can view own content effectiveness" ON content_effectiveness;
CREATE POLICY "Users can view own content effectiveness" ON content_effectiveness
  FOR SELECT USING (auth.uid() = user_id);

-- Queue policies
DROP POLICY IF EXISTS "Users can view own queue items" ON generation_queue;
CREATE POLICY "Users can view own queue items" ON generation_queue
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to increment usage counters
CREATE OR REPLACE FUNCTION increment_usage_counter(
  p_user_id UUID,
  p_period TEXT,
  p_type TEXT,
  p_tokens_used INTEGER DEFAULT 0,
  p_cost_cents INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_tracking (
    user_id, 
    period, 
    playbooks_used, 
    devotionals_used,
    ai_tokens_used,
    ai_cost_cents
  )
  VALUES (
    p_user_id, 
    p_period, 
    CASE WHEN p_type = 'playbook' THEN 1 ELSE 0 END,
    CASE WHEN p_type = 'devotional' THEN 1 ELSE 0 END,
    p_tokens_used,
    p_cost_cents
  )
  ON CONFLICT (user_id, period) 
  DO UPDATE SET
    playbooks_used = CASE 
      WHEN p_type = 'playbook' THEN usage_tracking.playbooks_used + 1 
      ELSE usage_tracking.playbooks_used 
    END,
    devotionals_used = CASE 
      WHEN p_type = 'devotional' THEN usage_tracking.devotionals_used + 1 
      ELSE usage_tracking.devotionals_used 
    END,
    ai_tokens_used = usage_tracking.ai_tokens_used + p_tokens_used,
    ai_cost_cents = usage_tracking.ai_cost_cents + p_cost_cents,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create free trial subscription
CREATE OR REPLACE FUNCTION create_free_trial_subscription(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_trial_end TIMESTAMPTZ;
BEGIN
  v_trial_end := NOW() + INTERVAL '3 days';
  
  INSERT INTO user_subscriptions (
    user_id,
    tier,
    status,
    trial_end_date,
    end_date,
    intelligence_enabled,
    advanced_analytics,
    export_features
  ) VALUES (
    p_user_id,
    'free_trial',
    'trialing',
    v_trial_end,
    v_trial_end,
    false,
    false,
    false
  ) RETURNING id INTO v_subscription_id;
  
  -- Create initial intelligence profile
  INSERT INTO user_intelligence_profiles (user_id) VALUES (p_user_id);
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscription limits
CREATE OR REPLACE FUNCTION get_subscription_limits(p_tier subscription_tier)
RETURNS JSONB AS $$
BEGIN
  RETURN CASE p_tier
    WHEN 'free_trial' THEN '{"playbooks": 2, "devotionals": 2, "exports": 0, "api_calls": 0, "family_members": 0}'::jsonb
    WHEN 'basic' THEN '{"playbooks": 0, "devotionals": 0, "exports": 0, "api_calls": 0, "family_members": 0}'::jsonb
    WHEN 'starter' THEN '{"playbooks": 8, "devotionals": 8, "exports": 0, "api_calls": 0, "family_members": 0}'::jsonb
    WHEN 'growth' THEN '{"playbooks": 20, "devotionals": 20, "exports": 0, "api_calls": 0, "family_members": 0}'::jsonb
    WHEN 'transformation' THEN '{"playbooks": -1, "devotionals": -1, "exports": -1, "api_calls": 1000, "family_members": 0}'::jsonb
    WHEN 'family' THEN '{"playbooks": -1, "devotionals": -1, "exports": -1, "api_calls": 2000, "family_members": 5}'::jsonb
    ELSE '{"playbooks": 0, "devotionals": 0, "exports": 0, "api_calls": 0, "family_members": 0}'::jsonb
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update intelligence profile based on behavior
CREATE OR REPLACE FUNCTION update_intelligence_profile_from_behavior(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_completion_rate FLOAT;
  v_engagement_score FLOAT;
  v_consistency_score FLOAT;
BEGIN
  -- Calculate completion rate from recent behavior
  SELECT 
    COALESCE(AVG(CASE WHEN success_indicator THEN 1.0 ELSE 0.0 END), 0)
  INTO v_completion_rate
  FROM user_behavior_events 
  WHERE user_id = p_user_id 
    AND event_category = 'completion'
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Calculate engagement score
  SELECT 
    COALESCE(AVG(engagement_score), 0)
  INTO v_engagement_score
  FROM user_behavior_events 
  WHERE user_id = p_user_id 
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Calculate consistency (how regularly they use the app)
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT DATE(created_at)) >= 20 THEN 1.0
      WHEN COUNT(DISTINCT DATE(created_at)) >= 10 THEN 0.7
      WHEN COUNT(DISTINCT DATE(created_at)) >= 5 THEN 0.4
      ELSE 0.2
    END
  INTO v_consistency_score
  FROM user_behavior_events 
  WHERE user_id = p_user_id 
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Update intelligence profile
  UPDATE user_intelligence_profiles 
  SET 
    average_completion_rate = v_completion_rate,
    engagement_depth_score = v_engagement_score,
    consistency_score = v_consistency_score,
    confidence_score = LEAST(1.0, (v_completion_rate + v_engagement_score + v_consistency_score) / 3.0),
    data_points_count = (
      SELECT COUNT(*) 
      FROM user_behavior_events 
      WHERE user_id = p_user_id
    ),
    last_analysis = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Insert if doesn't exist
  INSERT INTO user_intelligence_profiles (user_id, average_completion_rate, engagement_depth_score, consistency_score)
  VALUES (p_user_id, v_completion_rate, v_engagement_score, v_consistency_score)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INITIAL DATA SETUP
-- =============================================

-- Create subscription tier pricing reference (for application use)
CREATE TABLE IF NOT EXISTS subscription_pricing (
  tier subscription_tier PRIMARY KEY,
  monthly_price_cents INTEGER NOT NULL,
  annual_price_cents INTEGER,
  stripe_monthly_price_id TEXT,
  stripe_annual_price_id TEXT,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert pricing data
INSERT INTO subscription_pricing (tier, monthly_price_cents, annual_price_cents, features) VALUES
('free_trial', 0, 0, '{"trial_days": 3, "intelligence": true, "priority_support": false}'),
('basic', 0, 0, '{"intelligence": false, "priority_support": false, "export_formats": []}'),
('starter', 699, 4999, '{"intelligence": true, "priority_support": false, "export_formats": ["pdf"]}'),
('growth', 1299, 12999, '{"intelligence": true, "priority_support": false, "export_formats": ["pdf", "docx"]}'),
('transformation', 2499, 24999, '{"intelligence": true, "priority_support": true, "export_formats": ["pdf", "docx", "json"], "api_access": true}'),
('family', 3499, 34999, '{"intelligence": true, "priority_support": true, "export_formats": ["pdf", "docx", "json"], "api_access": true, "family_features": true}');

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE user_subscriptions IS 'Core subscription management with intelligence features enabled by tier';
COMMENT ON TABLE usage_tracking IS 'Simple monthly usage counters that users see, plus internal tracking';
COMMENT ON TABLE user_intelligence_profiles IS 'AI personalization profiles built from local analysis';
COMMENT ON TABLE user_behavior_events IS 'Behavioral tracking for intelligence system - all local processing';
COMMENT ON TABLE generation_queue IS 'Intelligent priority queue for AI generation requests';
COMMENT ON TABLE content_effectiveness IS 'Learning system to improve content generation over time';

COMMENT ON COLUMN user_subscriptions.intelligence_enabled IS 'Whether user has access to AI personalization features';
COMMENT ON COLUMN user_intelligence_profiles.confidence_score IS 'How confident we are in this profile (0.0-1.0)';
COMMENT ON COLUMN generation_queue.priority IS '1=family, 2=transformation, 3=growth, 4=starter, 5=basic/free_trial';
COMMENT ON COLUMN user_behavior_events.engagement_score IS 'Calculated engagement score for this event (0.0-1.0)';

-- Schema version for migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACCESS TIERS SYSTEM TABLES
-- =============================================

-- Expounding content for action steps
CREATE TABLE IF NOT EXISTS expounding_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_step_id UUID NOT NULL,
  subtask_id UUID NOT NULL,
  expanded_content JSONB NOT NULL,
  tier_required subscription_tier NOT NULL DEFAULT 'transformation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Retention events tracking
CREATE TABLE IF NOT EXISTS retention_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'trial_declined', 'trial_cancelled', 'subscription_cancelled'
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  modal_shown BOOLEAN DEFAULT false,
  action_taken TEXT, -- 'accepted', 'declined', 'ignored'
  discount_offered INTEGER, -- percentage discount offered
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for new tables
ALTER TABLE expounding_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view expounding content" ON expounding_content;
CREATE POLICY "Users can view expounding content" ON expounding_content
  FOR SELECT USING (true); -- Public read for all users

DROP POLICY IF EXISTS "Users can view own retention events" ON retention_events;
CREATE POLICY "Users can view own retention events" ON retention_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own retention events" ON retention_events;
CREATE POLICY "Users can insert own retention events" ON retention_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expounding_content_action_step ON expounding_content(action_step_id);
CREATE INDEX IF NOT EXISTS idx_expounding_content_subtask ON expounding_content(subtask_id);
CREATE INDEX IF NOT EXISTS idx_retention_events_user_type ON retention_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_retention_events_triggered ON retention_events(triggered_at);

-- Enhanced expounding tables for step-by-step insights

-- Step-by-step expounding table
CREATE TABLE IF NOT EXISTS step_expounding (
  id text PRIMARY KEY,
  action_step_id uuid REFERENCES playbook_action_steps(id) ON DELETE CASCADE,
  subtask_id uuid REFERENCES playbook_sub_tasks(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number >= 1 AND step_number <= 10),
  step_title text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('spiritual_insight', 'practical_guidance', 'biblical_context', 'reflection_questions', 'step_breakdown')),
  content text NOT NULL,
  scripture_references text[],
  practical_steps text[],
  reflection_questions text[],
  ai_generated boolean DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User questions and AI responses table
CREATE TABLE IF NOT EXISTS user_questions (
  id text PRIMARY KEY,
  action_step_id uuid REFERENCES playbook_action_steps(id) ON DELETE CASCADE,
  subtask_id uuid REFERENCES playbook_sub_tasks(id) ON DELETE CASCADE,
  user_question text NOT NULL,
  ai_response text NOT NULL,
  response_type text NOT NULL CHECK (response_type IN ('clarification', 'deeper_insight', 'practical_help', 'biblical_guidance')),
  related_step_number integer,
  parent_expounding_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful boolean,
  created_at timestamptz DEFAULT now()
);

-- Legacy expounding content table (keeping for backward compatibility)
CREATE TABLE IF NOT EXISTS expounding_content_legacy (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_step_id uuid REFERENCES playbook_action_steps(id) ON DELETE CASCADE,
  subtask_id uuid REFERENCES playbook_sub_tasks(id) ON DELETE CASCADE,
  expanded_content jsonb NOT NULL,
  tier_required subscription_tier NOT NULL DEFAULT 'transformation',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add RLS policies for step expounding
ALTER TABLE step_expounding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own step expounding" ON step_expounding;
CREATE POLICY "Users can view their own step expounding" ON step_expounding
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can insert their own step expounding" ON step_expounding;
CREATE POLICY "Users can insert their own step expounding" ON step_expounding
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own step expounding" ON step_expounding;
CREATE POLICY "Users can update their own step expounding" ON step_expounding
  FOR UPDATE USING (auth.uid() = user_id);

-- Add RLS policies for user questions
ALTER TABLE user_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own questions" ON user_questions;
CREATE POLICY "Users can view their own questions" ON user_questions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own questions" ON user_questions;
CREATE POLICY "Users can insert their own questions" ON user_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own questions" ON user_questions;
CREATE POLICY "Users can update their own questions" ON user_questions
  FOR UPDATE USING (auth.uid() = user_id);

-- Add RLS policies for expounding content
ALTER TABLE expounding_content_legacy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own expounding content" ON expounding_content_legacy;
CREATE POLICY "Users can view their own expounding content" ON expounding_content_legacy
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own expounding content" ON expounding_content_legacy;
CREATE POLICY "Users can insert their own expounding content" ON expounding_content_legacy
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own expounding content" ON expounding_content_legacy;
CREATE POLICY "Users can update their own expounding content" ON expounding_content_legacy
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_step_expounding_action_step ON step_expounding(action_step_id);
CREATE INDEX IF NOT EXISTS idx_step_expounding_subtask ON step_expounding(subtask_id);
CREATE INDEX IF NOT EXISTS idx_step_expounding_user ON step_expounding(user_id);
CREATE INDEX IF NOT EXISTS idx_step_expounding_step_number ON step_expounding(step_number);

CREATE INDEX IF NOT EXISTS idx_user_questions_action_step ON user_questions(action_step_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_subtask ON user_questions(subtask_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_user ON user_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_created ON user_questions(created_at);

CREATE INDEX IF NOT EXISTS idx_expounding_content_legacy_action_step ON expounding_content_legacy(action_step_id);
CREATE INDEX IF NOT EXISTS idx_expounding_content_legacy_subtask ON expounding_content_legacy(subtask_id);
CREATE INDEX IF NOT EXISTS idx_expounding_content_legacy_user ON expounding_content_legacy(user_id);

INSERT INTO schema_version (version, description) VALUES 
(1, 'Initial subscription and intelligence system schema');
