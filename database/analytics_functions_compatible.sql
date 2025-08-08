-- Analytics Functions Compatible with Existing siFia Schema
-- This version works with the current database structure

-- First, create the subscription_tier type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM (
        'free_trial', 'basic', 'starter', 'growth', 'transformation', 'family'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to increment usage tracking safely (compatible with existing usage_tracking table)
CREATE OR REPLACE FUNCTION increment_usage_tracking(
  target_user_id UUID,
  target_period TEXT,
  field_name TEXT,
  increment_by INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update usage tracking record using existing schema
  INSERT INTO usage_tracking (
    user_id, 
    subscription_id,
    playbooks_generated,
    devotionals_generated,
    export_count,
    api_calls_made,
    last_reset_date,
    updated_at
  )
  VALUES (
    target_user_id,
    (SELECT id FROM subscriptions WHERE user_id = target_user_id AND status = 'active' LIMIT 1),
    CASE WHEN field_name = 'playbooks_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'devotionals_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'exports_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'api_calls_used' THEN increment_by ELSE 0 END,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (user_id, subscription_id)
  DO UPDATE SET
    playbooks_generated = CASE WHEN field_name = 'playbooks_used' THEN usage_tracking.playbooks_generated + increment_by ELSE usage_tracking.playbooks_generated END,
    devotionals_generated = CASE WHEN field_name = 'devotionals_used' THEN usage_tracking.devotionals_generated + increment_by ELSE usage_tracking.devotionals_generated END,
    export_count = CASE WHEN field_name = 'exports_used' THEN usage_tracking.export_count + increment_by ELSE usage_tracking.export_count END,
    api_calls_made = CASE WHEN field_name = 'api_calls_used' THEN usage_tracking.api_calls_made + increment_by ELSE usage_tracking.api_calls_made END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscription analytics (compatible with existing subscriptions table)
CREATE OR REPLACE FUNCTION get_subscription_analytics(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  tier TEXT,
  total_users BIGINT,
  active_users BIGINT,
  churn_rate NUMERIC,
  average_revenue NUMERIC,
  feature_usage JSONB,
  conversion_rate NUMERIC,
  retention_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH subscription_stats AS (
    SELECT 
      s.tier,
      COUNT(*) as total_users,
      COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_users,
      COUNT(CASE WHEN s.status = 'cancelled' AND s.updated_at BETWEEN start_date AND end_date THEN 1 END) as churned_users
    FROM subscriptions s
    WHERE s.created_at <= end_date
    GROUP BY s.tier
  ),
  revenue_stats AS (
    SELECT 
      s.tier,
      AVG(COALESCE(s.amount, 0)) / 100.0 as avg_revenue -- Convert cents to dollars
    FROM subscriptions s
    WHERE s.status = 'active'
    GROUP BY s.tier
  ),
  feature_usage_stats AS (
    SELECT 
      s.tier,
      jsonb_build_object(
        'playbooks_used', COALESCE(AVG(ut.playbooks_generated), 0),
        'devotionals_used', COALESCE(AVG(ut.devotionals_generated), 0),
        'exports_used', COALESCE(AVG(ut.export_count), 0),
        'api_calls_used', COALESCE(AVG(ut.api_calls_made), 0)
      ) as feature_usage
    FROM subscriptions s
    LEFT JOIN usage_tracking ut ON s.user_id = ut.user_id 
      AND ut.last_reset_date >= start_date::date
    GROUP BY s.tier
  ),
  conversion_stats AS (
    SELECT 
      s.tier,
      COUNT(CASE WHEN s.created_at BETWEEN start_date AND end_date THEN 1 END)::NUMERIC / 
      NULLIF(COUNT(CASE WHEN s.tier = 'free_trial' AND s.created_at BETWEEN start_date - INTERVAL '30 days' AND start_date THEN 1 END), 0) as conversion_rate
    FROM subscriptions s
    GROUP BY s.tier
  )
  SELECT 
    ss.tier::TEXT,
    ss.total_users,
    ss.active_users,
    CASE WHEN ss.total_users > 0 THEN (ss.churned_users::NUMERIC / ss.total_users * 100) ELSE 0 END as churn_rate,
    COALESCE(rs.avg_revenue, 0) as average_revenue,
    COALESCE(fus.feature_usage, '{}'::jsonb) as feature_usage,
    COALESCE(cs.conversion_rate * 100, 0) as conversion_rate,
    CASE WHEN ss.total_users > 0 THEN ((ss.active_users::NUMERIC / ss.total_users) * 100) ELSE 0 END as retention_rate
  FROM subscription_stats ss
  LEFT JOIN revenue_stats rs ON ss.tier = rs.tier
  LEFT JOIN feature_usage_stats fus ON ss.tier = fus.tier
  LEFT JOIN conversion_stats cs ON ss.tier = cs.tier
  ORDER BY ss.tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate retention risk (compatible with existing schema)
CREATE OR REPLACE FUNCTION calculate_retention_risk(
  target_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  risk_score INTEGER,
  risk_factors TEXT[],
  recommended_actions TEXT[],
  last_engagement TIMESTAMPTZ,
  value_score INTEGER,
  tier_history JSONB
) AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_risk_factors TEXT[] := ARRAY[]::TEXT[];
  v_recommended_actions TEXT[] := ARRAY[]::TEXT[];
  v_last_engagement TIMESTAMPTZ;
  v_value_score INTEGER := 0;
  v_tier_history JSONB;
  v_current_tier TEXT;
  v_days_since_last_activity INTEGER;
  v_usage_count INTEGER;
BEGIN
  -- Get current subscription info
  SELECT s.tier INTO v_current_tier
  FROM subscriptions s
  WHERE s.user_id = target_user_id AND s.status = 'active'
  LIMIT 1;

  -- Get last engagement from user_events table
  SELECT MAX(ue.created_at) INTO v_last_engagement
  FROM user_events ue
  WHERE ue.user_id = target_user_id;

  -- If no user_events, try user_behavior_events
  IF v_last_engagement IS NULL THEN
    SELECT MAX(ube.created_at) INTO v_last_engagement
    FROM user_behavior_events ube
    WHERE ube.user_id = target_user_id;
  END IF;

  -- Calculate days since last activity
  v_days_since_last_activity := COALESCE(EXTRACT(DAY FROM NOW() - v_last_engagement), 999);

  -- Get usage count from usage_tracking
  SELECT COALESCE(playbooks_generated + devotionals_generated + export_count, 0) INTO v_usage_count
  FROM usage_tracking
  WHERE user_id = target_user_id
  LIMIT 1;

  -- Calculate base risk score
  v_risk_score := 0;

  -- Risk factor: Days since last activity
  IF v_days_since_last_activity > 14 THEN
    v_risk_score := v_risk_score + 30;
    v_risk_factors := array_append(v_risk_factors, 'inactive_for_2_weeks');
    v_recommended_actions := array_append(v_recommended_actions, 'send_re_engagement_email');
  ELSIF v_days_since_last_activity > 7 THEN
    v_risk_score := v_risk_score + 15;
    v_risk_factors := array_append(v_risk_factors, 'inactive_for_1_week');
    v_recommended_actions := array_append(v_recommended_actions, 'send_gentle_reminder');
  END IF;

  -- Risk factor: Low usage
  IF v_usage_count = 0 THEN
    v_risk_score := v_risk_score + 25;
    v_risk_factors := array_append(v_risk_factors, 'no_usage');
    v_recommended_actions := array_append(v_recommended_actions, 'offer_onboarding_help');
  ELSIF v_usage_count < 3 THEN
    v_risk_score := v_risk_score + 10;
    v_risk_factors := array_append(v_risk_factors, 'low_usage');
  END IF;

  -- Risk factor: Free trial user
  IF v_current_tier = 'free_trial' THEN
    v_risk_score := v_risk_score + 15;
    v_risk_factors := array_append(v_risk_factors, 'free_trial_user');
    v_recommended_actions := array_append(v_recommended_actions, 'show_upgrade_benefits');
  END IF;

  -- Calculate value score (inverse of risk, plus positive factors)
  v_value_score := 100 - v_risk_score;

  -- Positive factors for value score
  IF v_usage_count > 10 THEN
    v_value_score := v_value_score + 20;
  END IF;

  IF v_current_tier IN ('transformation', 'family') THEN
    v_value_score := v_value_score + 15;
  END IF;

  -- Cap scores
  v_risk_score := LEAST(v_risk_score, 100);
  v_value_score := GREATEST(LEAST(v_value_score, 100), 0);

  -- Build tier history from subscriptions
  SELECT jsonb_agg(
    jsonb_build_object(
      'tier', s.tier,
      'start_date', s.created_at,
      'end_date', s.updated_at
    ) ORDER BY s.created_at
  ) INTO v_tier_history
  FROM subscriptions s
  WHERE s.user_id = target_user_id;

  -- Return results
  RETURN QUERY SELECT 
    target_user_id,
    v_risk_score,
    v_risk_factors,
    v_recommended_actions,
    v_last_engagement,
    v_value_score,
    COALESCE(v_tier_history, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get feature analytics (compatible with existing schema)
CREATE OR REPLACE FUNCTION get_feature_analytics(
  feature_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  feature_name TEXT,
  total_usage BIGINT,
  unique_users BIGINT,
  average_usage_per_user NUMERIC,
  usage_by_tier JSONB,
  average_load_time NUMERIC,
  error_rate NUMERIC,
  satisfaction_score NUMERIC,
  trials_triggered BIGINT,
  upgrades_generated BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH feature_events AS (
    SELECT 
      ue.event_name as feature_name,
      ue.user_id,
      s.tier,
      1 as usage_count
    FROM user_events ue
    LEFT JOIN subscriptions s ON ue.user_id = s.user_id AND s.status = 'active'
    WHERE ue.created_at >= NOW() - INTERVAL '30 days'
      AND (feature_filter IS NULL OR ue.event_name = feature_filter)
    
    UNION ALL
    
    -- Add data from user_behavior_events if available
    SELECT 
      ube.event_type as feature_name,
      ube.user_id,
      s.tier,
      1 as usage_count
    FROM user_behavior_events ube
    LEFT JOIN subscriptions s ON ube.user_id = s.user_id AND s.status = 'active'
    WHERE ube.created_at >= NOW() - INTERVAL '30 days'
      AND (feature_filter IS NULL OR ube.event_type = feature_filter)
  ),
  usage_stats AS (
    SELECT 
      fe.feature_name,
      COUNT(*) as total_usage,
      COUNT(DISTINCT fe.user_id) as unique_users,
      COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT fe.user_id), 0) as avg_usage_per_user,
      jsonb_object_agg(
        COALESCE(fe.tier, 'unknown'),
        COUNT(*)
      ) as usage_by_tier
    FROM feature_events fe
    GROUP BY fe.feature_name
  ),
  subscription_changes AS (
    SELECT 
      COUNT(CASE WHEN tier != 'free_trial' AND created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as upgrades_generated
    FROM subscriptions
  )
  SELECT 
    us.feature_name::TEXT,
    us.total_usage,
    us.unique_users,
    us.avg_usage_per_user,
    us.usage_by_tier,
    0::NUMERIC as average_load_time, -- Placeholder
    0::NUMERIC as error_rate, -- Placeholder
    75::NUMERIC as satisfaction_score, -- Placeholder
    0::BIGINT as trials_triggered, -- Placeholder
    sc.upgrades_generated,
    CASE 
      WHEN us.total_usage > 0 THEN (sc.upgrades_generated::NUMERIC / us.total_usage * 100)
      ELSE 0 
    END as conversion_rate
  FROM usage_stats us
  CROSS JOIN subscription_changes sc
  WHERE us.feature_name IS NOT NULL
  ORDER BY us.total_usage DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get dashboard metrics (compatible with existing schema)
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  date_range_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  metric_name TEXT,
  current_value NUMERIC,
  previous_value NUMERIC,
  change_percentage NUMERIC,
  trend TEXT
) AS $$
DECLARE
  current_start_date TIMESTAMPTZ := NOW() - (date_range_days || ' days')::INTERVAL;
  current_end_date TIMESTAMPTZ := NOW();
  previous_start_date TIMESTAMPTZ := NOW() - (date_range_days * 2 || ' days')::INTERVAL;
  previous_end_date TIMESTAMPTZ := NOW() - (date_range_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH current_metrics AS (
    SELECT 
      'total_active_subscriptions' as metric,
      COUNT(*)::NUMERIC as value
    FROM subscriptions
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
      'monthly_recurring_revenue',
      SUM(COALESCE(amount, 0))::NUMERIC / 100.0 -- Convert cents to dollars
    FROM subscriptions
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
      'new_subscriptions',
      COUNT(*)::NUMERIC
    FROM subscriptions
    WHERE created_at >= current_start_date
    
    UNION ALL
    
    SELECT 
      'total_users',
      COUNT(DISTINCT user_id)::NUMERIC
    FROM subscriptions
    
    UNION ALL
    
    SELECT 
      'total_playbooks',
      COUNT(*)::NUMERIC
    FROM playbooks
    WHERE created_at >= current_start_date
    
    UNION ALL
    
    SELECT 
      'total_devotionals',
      COUNT(*)::NUMERIC
    FROM devotionals
    WHERE created_at >= current_start_date
  ),
  previous_metrics AS (
    SELECT 
      'total_active_subscriptions' as metric,
      COUNT(*)::NUMERIC as value
    FROM subscriptions
    WHERE status = 'active' AND created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'monthly_recurring_revenue',
      SUM(COALESCE(amount, 0))::NUMERIC / 100.0
    FROM subscriptions
    WHERE status = 'active' AND created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'new_subscriptions',
      COUNT(*)::NUMERIC
    FROM subscriptions
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
    
    UNION ALL
    
    SELECT 
      'total_users',
      COUNT(DISTINCT user_id)::NUMERIC
    FROM subscriptions
    WHERE created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'total_playbooks',
      COUNT(*)::NUMERIC
    FROM playbooks
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
    
    UNION ALL
    
    SELECT 
      'total_devotionals',
      COUNT(*)::NUMERIC
    FROM devotionals
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
  )
  SELECT 
    cm.metric::TEXT,
    COALESCE(cm.value, 0),
    COALESCE(pm.value, 0),
    CASE 
      WHEN pm.value = 0 OR pm.value IS NULL THEN 0
      ELSE ((cm.value - pm.value) / pm.value * 100)
    END,
    CASE 
      WHEN pm.value = 0 OR pm.value IS NULL THEN 'no_data'
      WHEN cm.value > pm.value THEN 'up'
      WHEN cm.value < pm.value THEN 'down'
      ELSE 'stable'
    END::TEXT
  FROM current_metrics cm
  LEFT JOIN previous_metrics pm ON cm.metric = pm.metric
  ORDER BY cm.metric;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_usage_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_retention_risk TO authenticated;
GRANT EXECUTE ON FUNCTION get_feature_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO authenticated;
