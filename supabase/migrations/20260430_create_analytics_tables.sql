-- Analytics Dashboard Database Schema
-- Created: 2026-04-30
-- Purpose: Comprehensive analytics tracking for siFia app

-- ============================================
-- ANALYTICS EVENTS TABLE
-- Tracks all user events for detailed analytics
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT,
  properties JSONB DEFAULT '{}',
  session_id TEXT,
  platform TEXT, -- 'ios', 'android', 'web'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_category ON analytics_events(event_category);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING GIN(properties);

-- ============================================
-- USER ACTIVITY DAILY TABLE
-- Aggregated daily user activity metrics
-- ============================================
CREATE TABLE IF NOT EXISTS user_activity_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- App engagement
  app_opens INTEGER DEFAULT 0,
  session_duration_seconds INTEGER DEFAULT 0,
  
  -- Feature usage
  playbook_views INTEGER DEFAULT 0,
  devotional_views INTEGER DEFAULT 0,
  journal_opens INTEGER DEFAULT 0,
  
  -- Journal component usage
  todays_focus_used BOOLEAN DEFAULT false,
  todos_used BOOLEAN DEFAULT false,
  timeblock_used BOOLEAN DEFAULT false,
  prayer_used BOOLEAN DEFAULT false,
  gratitude_used BOOLEAN DEFAULT false,
  reflection_used BOOLEAN DEFAULT false,
  looking_forward_used BOOLEAN DEFAULT false,
  today_win_used BOOLEAN DEFAULT false,
  
  -- Content creation
  playbooks_created INTEGER DEFAULT 0,
  devotionals_created INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);

-- Indexes for user_activity_daily
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_id ON user_activity_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date ON user_activity_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_date ON user_activity_daily(user_id, date);

-- ============================================
-- SUBSCRIPTION ANALYTICS TABLE
-- Tracks subscription lifecycle events
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'signup', 'trial_start', 'trial_conversion', 'upgrade', 'downgrade', 'cancel', 'renewal'
  
  -- Tier information
  from_tier TEXT,
  to_tier TEXT,
  billing_cycle TEXT, -- 'monthly', 'annual'
  
  -- Free access tracking
  free_playbook_used BOOLEAN DEFAULT false,
  free_devotional_used BOOLEAN DEFAULT false,
  
  -- Additional metadata
  platform TEXT, -- 'ios', 'android'
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for subscription_analytics
CREATE INDEX IF NOT EXISTS idx_subscription_analytics_user_id ON subscription_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_analytics_event_type ON subscription_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_analytics_to_tier ON subscription_analytics(to_tier);
CREATE INDEX IF NOT EXISTS idx_subscription_analytics_created_at ON subscription_analytics(created_at DESC);

-- ============================================
-- PAYMENT ANALYTICS TABLE
-- Tracks payment transactions and status
-- ============================================
CREATE TABLE IF NOT EXISTS payment_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction identifiers
  transaction_id TEXT NOT NULL,
  original_transaction_id TEXT,
  product_id TEXT NOT NULL,
  
  -- Payment details
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL, -- 'success', 'failed', 'pending', 'refunded'
  failure_reason TEXT,
  
  -- Platform information
  platform TEXT, -- 'ios', 'android'
  
  -- Renewal tracking
  is_renewal BOOLEAN DEFAULT false,
  renewal_date DATE,
  is_trial BOOLEAN DEFAULT false,
  
  -- Additional metadata
  receipt_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payment_analytics
CREATE INDEX IF NOT EXISTS idx_payment_analytics_user_id ON payment_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_transaction_id ON payment_analytics(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_original_transaction_id ON payment_analytics(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_status ON payment_analytics(status);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_created_at ON payment_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_renewal_date ON payment_analytics(renewal_date);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all analytics tables
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for analytics_events
CREATE POLICY "Service role can manage analytics_events"
  ON analytics_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own analytics_events"
  ON analytics_events FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policies for user_activity_daily
CREATE POLICY "Service role can manage user_activity_daily"
  ON user_activity_daily FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own user_activity_daily"
  ON user_activity_daily FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policies for subscription_analytics
CREATE POLICY "Service role can manage subscription_analytics"
  ON subscription_analytics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own subscription_analytics"
  ON subscription_analytics FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policies for payment_analytics
CREATE POLICY "Service role can manage payment_analytics"
  ON payment_analytics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own payment_analytics"
  ON payment_analytics FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_activity_daily_updated_at
  BEFORE UPDATE ON user_activity_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RPC FUNCTIONS FOR DATA AGGREGATION
-- ============================================

-- Function: Get user signups by date range
CREATE OR REPLACE FUNCTION get_user_signups(start_date DATE, end_date DATE)
RETURNS TABLE(date DATE, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM auth.users
  WHERE created_at >= start_date 
    AND created_at <= end_date + INTERVAL '1 day'
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get conversion funnel metrics
CREATE OR REPLACE FUNCTION get_conversion_funnel(start_date DATE, end_date DATE)
RETURNS TABLE(
  total_signups BIGINT,
  trial_activations BIGINT,
  trial_conversions BIGINT,
  signup_to_trial_rate NUMERIC,
  trial_to_paid_rate NUMERIC
) AS $$
DECLARE
  v_total_signups BIGINT;
  v_trial_activations BIGINT;
  v_trial_conversions BIGINT;
BEGIN
  -- Get total signups
  SELECT COUNT(*) INTO v_total_signups
  FROM auth.users
  WHERE created_at >= start_date AND created_at <= end_date + INTERVAL '1 day';
  
  -- Get trial activations
  SELECT COUNT(*) INTO v_trial_activations
  FROM subscription_analytics
  WHERE event_type = 'trial_start'
    AND created_at >= start_date 
    AND created_at <= end_date + INTERVAL '1 day';
  
  -- Get trial conversions
  SELECT COUNT(*) INTO v_trial_conversions
  FROM subscription_analytics
  WHERE event_type = 'trial_conversion'
    AND created_at >= start_date 
    AND created_at <= end_date + INTERVAL '1 day';
  
  -- Calculate rates
  RETURN QUERY
  SELECT 
    v_total_signups,
    v_trial_activations,
    v_trial_conversions,
    CASE WHEN v_total_signups > 0 THEN 
      ROUND((v_trial_activations::NUMERIC / v_total_signups) * 100, 2) 
    ELSE 0 END,
    CASE WHEN v_trial_activations > 0 THEN 
      ROUND((v_trial_conversions::NUMERIC / v_trial_activations) * 100, 2) 
    ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get subscription breakdown by tier and billing cycle
CREATE OR REPLACE FUNCTION get_subscription_breakdown()
RETURNS TABLE(
  tier TEXT,
  billing_cycle TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tier,
    COALESCE(billing_cycle, 'unknown') as billing_cycle,
    COUNT(*) as count
  FROM user_subscriptions_new
  WHERE status = 'active'
  GROUP BY tier, billing_cycle
  ORDER BY tier, billing_cycle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get daily active users by feature
CREATE OR REPLACE FUNCTION get_daily_active_users(start_date DATE, end_date DATE)
RETURNS TABLE(
  date DATE,
  total_dau BIGINT,
  playbook_users BIGINT,
  devotional_users BIGINT,
  journal_users BIGINT,
  todays_focus_users BIGINT,
  todos_users BIGINT,
  timeblock_users BIGINT,
  prayer_users BIGINT,
  gratitude_users BIGINT,
  reflection_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date,
    COUNT(*) as total_dau,
    SUM(CASE WHEN playbook_views > 0 THEN 1 ELSE 0 END) as playbook_users,
    SUM(CASE WHEN devotional_views > 0 THEN 1 ELSE 0 END) as devotional_users,
    SUM(CASE WHEN journal_opens > 0 THEN 1 ELSE 0 END) as journal_users,
    SUM(CASE WHEN todays_focus_used THEN 1 ELSE 0 END) as todays_focus_users,
    SUM(CASE WHEN todos_used THEN 1 ELSE 0 END) as todos_users,
    SUM(CASE WHEN timeblock_used THEN 1 ELSE 0 END) as timeblock_users,
    SUM(CASE WHEN prayer_used THEN 1 ELSE 0 END) as prayer_users,
    SUM(CASE WHEN gratitude_used THEN 1 ELSE 0 END) as gratitude_users,
    SUM(CASE WHEN reflection_used THEN 1 ELSE 0 END) as reflection_users
  FROM user_activity_daily
  WHERE date >= start_date AND date <= end_date
  GROUP BY date
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get payment analytics
CREATE OR REPLACE FUNCTION get_payment_analytics(start_date DATE, end_date DATE)
RETURNS TABLE(
  total_payments BIGINT,
  successful_payments BIGINT,
  failed_payments BIGINT,
  success_rate NUMERIC,
  total_amount DECIMAL,
  avg_amount DECIMAL
) AS $$
DECLARE
  v_total_payments BIGINT;
  v_successful_payments BIGINT;
  v_failed_payments BIGINT;
  v_total_amount DECIMAL;
BEGIN
  SELECT 
    COUNT(*),
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
    COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0)
  INTO v_total_payments, v_successful_payments, v_failed_payments, v_total_amount
  FROM payment_analytics
  WHERE created_at >= start_date 
    AND created_at <= end_date + INTERVAL '1 day';
  
  RETURN QUERY
  SELECT 
    v_total_payments,
    v_successful_payments,
    v_failed_payments,
    CASE WHEN v_total_payments > 0 THEN 
      ROUND((v_successful_payments::NUMERIC / v_total_payments) * 100, 2) 
    ELSE 0 END,
    v_total_amount,
    CASE WHEN v_successful_payments > 0 THEN 
      ROUND(v_total_amount / v_successful_payments, 2) 
    ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get renewal metrics
CREATE OR REPLACE FUNCTION get_renewal_metrics()
RETURNS TABLE(
  total_subscriptions BIGINT,
  renewed_subscriptions BIGINT,
  renewal_rate NUMERIC,
  upcoming_renewals_7days BIGINT,
  upcoming_renewals_30days BIGINT
) AS $$
DECLARE
  v_total_subscriptions BIGINT;
  v_renewed_subscriptions BIGINT;
BEGIN
  -- Get total active subscriptions
  SELECT COUNT(*) INTO v_total_subscriptions
  FROM user_subscriptions_new
  WHERE status = 'active' 
    AND auto_renew_enabled = true;
  
  -- Get renewed subscriptions (count of users with at least 2 payments)
  SELECT COUNT(DISTINCT user_id) INTO v_renewed_subscriptions
  FROM payment_analytics
  WHERE is_renewal = true;
  
  RETURN QUERY
  SELECT 
    v_total_subscriptions,
    v_renewed_subscriptions,
    CASE WHEN v_total_subscriptions > 0 THEN 
      ROUND((v_renewed_subscriptions::NUMERIC / v_total_subscriptions) * 100, 2) 
    ELSE 0 END,
    (SELECT COUNT(*) FROM user_subscriptions_new 
     WHERE status = 'active' 
       AND auto_renew_enabled = true
       AND subscription_end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'),
    (SELECT COUNT(*) FROM user_subscriptions_new 
     WHERE status = 'active' 
       AND auto_renew_enabled = true
       AND subscription_end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get free access usage
CREATE OR REPLACE FUNCTION get_free_access_usage()
RETURNS TABLE(
  total_free_playbooks_used BIGINT,
  total_free_devotionals_used BIGINT,
  users_with_free_access BIGINT,
  users_converted_from_free BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM subscription_analytics WHERE free_playbook_used = true),
    (SELECT COUNT(*) FROM subscription_analytics WHERE free_devotional_used = true),
    (SELECT COUNT(DISTINCT user_id) FROM subscription_analytics 
     WHERE free_playbook_used = true OR free_devotional_used = true),
    (SELECT COUNT(DISTINCT user_id) FROM subscription_analytics 
     WHERE (free_playbook_used = true OR free_devotional_used = true)
       AND user_id IN (SELECT user_id FROM user_subscriptions_new WHERE tier NOT IN ('seeker', 'free_trial')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Aggregate daily user activity (to be called by cron job)
CREATE OR REPLACE FUNCTION aggregate_daily_activity(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  -- Insert or update daily activity for each user who had events
  INSERT INTO user_activity_daily (user_id, date, app_opens, session_duration_seconds)
  SELECT 
    user_id,
    target_date,
    COUNT(*) FILTER (WHERE event_type = 'app_open') as app_opens,
    SUM((properties->>'session_duration_seconds')::INTEGER) FILTER (WHERE event_type = 'session_end') as session_duration_seconds
  FROM analytics_events
  WHERE DATE(created_at) = target_date
  GROUP BY user_id
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    app_opens = EXCLUDED.app_opens,
    session_duration_seconds = EXCLUDED.session_duration_seconds,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
