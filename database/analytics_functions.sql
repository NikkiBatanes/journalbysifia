-- Analytics and Business Intelligence Functions - Phase 4
-- siFia Application - Advanced Analytics Implementation

-- Function to increment usage tracking safely
CREATE OR REPLACE FUNCTION increment_usage_tracking(
  target_user_id UUID,
  target_period TEXT,
  field_name TEXT,
  increment_by INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update usage tracking record
  INSERT INTO usage_tracking (user_id, period, playbooks_used, devotionals_used, exports_used, api_calls_used, last_updated)
  VALUES (
    target_user_id,
    target_period,
    CASE WHEN field_name = 'playbooks_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'devotionals_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'exports_used' THEN increment_by ELSE 0 END,
    CASE WHEN field_name = 'api_calls_used' THEN increment_by ELSE 0 END,
    NOW()
  )
  ON CONFLICT (user_id, period)
  DO UPDATE SET
    playbooks_used = CASE WHEN field_name = 'playbooks_used' THEN usage_tracking.playbooks_used + increment_by ELSE usage_tracking.playbooks_used END,
    devotionals_used = CASE WHEN field_name = 'devotionals_used' THEN usage_tracking.devotionals_used + increment_by ELSE usage_tracking.devotionals_used END,
    exports_used = CASE WHEN field_name = 'exports_used' THEN usage_tracking.exports_used + increment_by ELSE usage_tracking.exports_used END,
    api_calls_used = CASE WHEN field_name = 'api_calls_used' THEN usage_tracking.api_calls_used + increment_by ELSE usage_tracking.api_calls_used END,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscription analytics
CREATE OR REPLACE FUNCTION get_subscription_analytics(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  tier subscription_tier,
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
    FROM user_subscriptions s
    WHERE s.created_at <= end_date
    GROUP BY s.tier
  ),
  revenue_stats AS (
    SELECT 
      s.tier,
      AVG(
        CASE s.tier
          WHEN 'basic' THEN 999
          WHEN 'starter' THEN 1999
          WHEN 'growth' THEN 3999
          WHEN 'transformation' THEN 7999
          WHEN 'family' THEN 11999
          ELSE 0
        END
      ) as avg_revenue
    FROM user_subscriptions s
    WHERE s.status = 'active'
    GROUP BY s.tier
  ),
  feature_usage_stats AS (
    SELECT 
      s.tier,
      jsonb_build_object(
        'playbooks_used', COALESCE(AVG(ut.playbooks_used), 0),
        'devotionals_used', COALESCE(AVG(ut.devotionals_used), 0),
        'exports_used', COALESCE(AVG(ut.exports_used), 0),
        'api_calls_used', COALESCE(AVG(ut.api_calls_used), 0)
      ) as feature_usage
    FROM user_subscriptions s
    LEFT JOIN usage_tracking ut ON s.user_id = ut.user_id 
      AND ut.period >= TO_CHAR(start_date, 'YYYY-MM')
      AND ut.period <= TO_CHAR(end_date, 'YYYY-MM')
    GROUP BY s.tier
  ),
  conversion_stats AS (
    SELECT 
      s.tier,
      COUNT(CASE WHEN s.created_at BETWEEN start_date AND end_date THEN 1 END)::NUMERIC / 
      NULLIF(COUNT(CASE WHEN s.tier = 'free_trial' AND s.created_at BETWEEN start_date - INTERVAL '30 days' AND start_date THEN 1 END), 0) as conversion_rate
    FROM user_subscriptions s
    GROUP BY s.tier
  )
  SELECT 
    ss.tier,
    ss.total_users,
    ss.active_users,
    CASE WHEN ss.total_users > 0 THEN (ss.churned_users::NUMERIC / ss.total_users * 100) ELSE 0 END as churn_rate,
    COALESCE(rs.avg_revenue / 100.0, 0) as average_revenue,
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

-- Function to calculate retention risk for a user
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
  v_current_tier subscription_tier;
  v_engagement_avg NUMERIC;
  v_days_since_last_activity INTEGER;
  v_usage_trend NUMERIC;
BEGIN
  -- Get current subscription info
  SELECT s.tier INTO v_current_tier
  FROM user_subscriptions s
  WHERE s.user_id = target_user_id AND s.status = 'active'
  LIMIT 1;

  -- Get last engagement
  SELECT MAX(ube.created_at) INTO v_last_engagement
  FROM user_behavior_events ube
  WHERE ube.user_id = target_user_id;

  -- Calculate days since last activity
  v_days_since_last_activity := COALESCE(EXTRACT(DAY FROM NOW() - v_last_engagement), 999);

  -- Calculate average engagement score
  SELECT COALESCE(AVG(ube.engagement_score), 0) INTO v_engagement_avg
  FROM user_behavior_events ube
  WHERE ube.user_id = target_user_id
    AND ube.created_at >= NOW() - INTERVAL '30 days';

  -- Calculate usage trend (comparing last 7 days to previous 7 days)
  WITH recent_usage AS (
    SELECT COUNT(*) as recent_count
    FROM user_behavior_events ube
    WHERE ube.user_id = target_user_id
      AND ube.created_at >= NOW() - INTERVAL '7 days'
  ),
  previous_usage AS (
    SELECT COUNT(*) as previous_count
    FROM user_behavior_events ube
    WHERE ube.user_id = target_user_id
      AND ube.created_at >= NOW() - INTERVAL '14 days'
      AND ube.created_at < NOW() - INTERVAL '7 days'
  )
  SELECT 
    CASE 
      WHEN pu.previous_count = 0 THEN 0
      ELSE (ru.recent_count::NUMERIC / pu.previous_count - 1) * 100
    END INTO v_usage_trend
  FROM recent_usage ru, previous_usage pu;

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

  -- Risk factor: Low engagement score
  IF v_engagement_avg < 0.3 THEN
    v_risk_score := v_risk_score + 25;
    v_risk_factors := array_append(v_risk_factors, 'low_engagement');
    v_recommended_actions := array_append(v_recommended_actions, 'offer_onboarding_help');
  ELSIF v_engagement_avg < 0.5 THEN
    v_risk_score := v_risk_score + 10;
    v_risk_factors := array_append(v_risk_factors, 'moderate_engagement');
  END IF;

  -- Risk factor: Declining usage trend
  IF v_usage_trend < -50 THEN
    v_risk_score := v_risk_score + 20;
    v_risk_factors := array_append(v_risk_factors, 'declining_usage');
    v_recommended_actions := array_append(v_recommended_actions, 'offer_premium_trial');
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
  IF v_engagement_avg > 0.7 THEN
    v_value_score := v_value_score + 20;
  END IF;

  IF v_current_tier IN ('transformation', 'family') THEN
    v_value_score := v_value_score + 15;
  END IF;

  -- Cap scores
  v_risk_score := LEAST(v_risk_score, 100);
  v_value_score := GREATEST(LEAST(v_value_score, 100), 0);

  -- Build tier history
  SELECT jsonb_agg(
    jsonb_build_object(
      'tier', s.tier,
      'start_date', s.created_at,
      'end_date', s.updated_at
    ) ORDER BY s.created_at
  ) INTO v_tier_history
  FROM user_subscriptions s
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

-- Function to get feature analytics
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
      ube.event_data->>'feature_name' as feature_name,
      ube.user_id,
      ube.event_data->>'success' as success,
      ube.event_data->>'duration_ms' as duration_ms,
      s.tier,
      ube.engagement_score
    FROM user_behavior_events ube
    LEFT JOIN user_subscriptions s ON ube.user_id = s.user_id AND s.status = 'active'
    WHERE ube.event_type = 'feature_used'
      AND (feature_filter IS NULL OR ube.event_data->>'feature_name' = feature_filter)
      AND ube.created_at >= NOW() - INTERVAL '30 days'
  ),
  usage_stats AS (
    SELECT 
      fe.feature_name,
      COUNT(*) as total_usage,
      COUNT(DISTINCT fe.user_id) as unique_users,
      COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT fe.user_id), 0) as avg_usage_per_user,
      jsonb_object_agg(
        COALESCE(fe.tier::text, 'unknown'),
        COUNT(*)
      ) as usage_by_tier,
      AVG(CASE WHEN fe.duration_ms ~ '^[0-9]+$' THEN fe.duration_ms::NUMERIC ELSE NULL END) as avg_load_time,
      (COUNT(CASE WHEN fe.success = 'false' THEN 1 END)::NUMERIC / COUNT(*) * 100) as error_rate,
      AVG(fe.engagement_score) * 100 as satisfaction_score
    FROM feature_events fe
    GROUP BY fe.feature_name
  ),
  conversion_stats AS (
    SELECT 
      fe.feature_name,
      COUNT(CASE WHEN re.event_type = 'feature_restriction_hit' THEN 1 END) as trials_triggered,
      COUNT(CASE WHEN re.event_type = 'subscription_upgrade' THEN 1 END) as upgrades_generated
    FROM feature_events fe
    LEFT JOIN retention_events re ON fe.user_id = re.user_id 
      AND re.triggered_at >= fe.created_at - INTERVAL '1 hour'
      AND re.triggered_at <= fe.created_at + INTERVAL '24 hours'
    GROUP BY fe.feature_name
  )
  SELECT 
    us.feature_name::TEXT,
    us.total_usage,
    us.unique_users,
    us.avg_usage_per_user,
    us.usage_by_tier,
    COALESCE(us.avg_load_time, 0),
    COALESCE(us.error_rate, 0),
    COALESCE(us.satisfaction_score, 0),
    COALESCE(cs.trials_triggered, 0),
    COALESCE(cs.upgrades_generated, 0),
    CASE 
      WHEN cs.trials_triggered > 0 THEN (cs.upgrades_generated::NUMERIC / cs.trials_triggered * 100)
      ELSE 0 
    END as conversion_rate
  FROM usage_stats us
  LEFT JOIN conversion_stats cs ON us.feature_name = cs.feature_name
  WHERE us.feature_name IS NOT NULL
  ORDER BY us.total_usage DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user cohort analysis
CREATE OR REPLACE FUNCTION get_cohort_analysis(
  cohort_period TEXT DEFAULT 'month' -- 'week', 'month', 'quarter'
)
RETURNS TABLE (
  cohort_period TEXT,
  cohort_size BIGINT,
  period_0 NUMERIC,
  period_1 NUMERIC,
  period_2 NUMERIC,
  period_3 NUMERIC,
  period_4 NUMERIC,
  period_5 NUMERIC,
  period_6 NUMERIC,
  period_7 NUMERIC,
  period_8 NUMERIC,
  period_9 NUMERIC,
  period_10 NUMERIC,
  period_11 NUMERIC
) AS $$
DECLARE
  date_trunc_format TEXT;
  interval_period INTERVAL;
BEGIN
  -- Set format based on cohort period
  CASE cohort_period
    WHEN 'week' THEN 
      date_trunc_format := 'week';
      interval_period := '1 week'::INTERVAL;
    WHEN 'quarter' THEN 
      date_trunc_format := 'quarter';
      interval_period := '3 months'::INTERVAL;
    ELSE 
      date_trunc_format := 'month';
      interval_period := '1 month'::INTERVAL;
  END CASE;

  RETURN QUERY
  WITH user_cohorts AS (
    SELECT 
      s.user_id,
      DATE_TRUNC(date_trunc_format, s.created_at) as cohort_period,
      s.created_at as first_subscription
    FROM user_subscriptions s
    WHERE s.created_at >= NOW() - INTERVAL '12 months'
  ),
  cohort_data AS (
    SELECT 
      uc.cohort_period,
      COUNT(DISTINCT uc.user_id) as cohort_size,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period AND ube.created_at < uc.cohort_period + interval_period THEN uc.user_id END) as period_0_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period AND ube.created_at < uc.cohort_period + interval_period * 2 THEN uc.user_id END) as period_1_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 2 AND ube.created_at < uc.cohort_period + interval_period * 3 THEN uc.user_id END) as period_2_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 3 AND ube.created_at < uc.cohort_period + interval_period * 4 THEN uc.user_id END) as period_3_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 4 AND ube.created_at < uc.cohort_period + interval_period * 5 THEN uc.user_id END) as period_4_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 5 AND ube.created_at < uc.cohort_period + interval_period * 6 THEN uc.user_id END) as period_5_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 6 AND ube.created_at < uc.cohort_period + interval_period * 7 THEN uc.user_id END) as period_6_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 7 AND ube.created_at < uc.cohort_period + interval_period * 8 THEN uc.user_id END) as period_7_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 8 AND ube.created_at < uc.cohort_period + interval_period * 9 THEN uc.user_id END) as period_8_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 9 AND ube.created_at < uc.cohort_period + interval_period * 10 THEN uc.user_id END) as period_9_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 10 AND ube.created_at < uc.cohort_period + interval_period * 11 THEN uc.user_id END) as period_10_users,
      COUNT(DISTINCT CASE WHEN ube.created_at >= uc.cohort_period + interval_period * 11 AND ube.created_at < uc.cohort_period + interval_period * 12 THEN uc.user_id END) as period_11_users
    FROM user_cohorts uc
    LEFT JOIN user_behavior_events ube ON uc.user_id = ube.user_id
    GROUP BY uc.cohort_period
  )
  SELECT 
    cd.cohort_period::TEXT,
    cd.cohort_size,
    (cd.period_0_users::NUMERIC / cd.cohort_size * 100) as period_0,
    (cd.period_1_users::NUMERIC / cd.cohort_size * 100) as period_1,
    (cd.period_2_users::NUMERIC / cd.cohort_size * 100) as period_2,
    (cd.period_3_users::NUMERIC / cd.cohort_size * 100) as period_3,
    (cd.period_4_users::NUMERIC / cd.cohort_size * 100) as period_4,
    (cd.period_5_users::NUMERIC / cd.cohort_size * 100) as period_5,
    (cd.period_6_users::NUMERIC / cd.cohort_size * 100) as period_6,
    (cd.period_7_users::NUMERIC / cd.cohort_size * 100) as period_7,
    (cd.period_8_users::NUMERIC / cd.cohort_size * 100) as period_8,
    (cd.period_9_users::NUMERIC / cd.cohort_size * 100) as period_9,
    (cd.period_10_users::NUMERIC / cd.cohort_size * 100) as period_10,
    (cd.period_11_users::NUMERIC / cd.cohort_size * 100) as period_11
  FROM cohort_data cd
  ORDER BY cd.cohort_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate business intelligence dashboard data
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
    FROM user_subscriptions
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
      'monthly_recurring_revenue',
      SUM(
        CASE tier
          WHEN 'basic' THEN 9.99
          WHEN 'starter' THEN 19.99
          WHEN 'growth' THEN 39.99
          WHEN 'transformation' THEN 79.99
          WHEN 'family' THEN 119.99
          ELSE 0
        END
      )
    FROM user_subscriptions
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
      'new_subscriptions',
      COUNT(*)::NUMERIC
    FROM user_subscriptions
    WHERE created_at >= current_start_date
    
    UNION ALL
    
    SELECT 
      'churn_rate',
      (COUNT(CASE WHEN status = 'cancelled' AND updated_at >= current_start_date THEN 1 END)::NUMERIC / 
       NULLIF(COUNT(*), 0) * 100)
    FROM user_subscriptions
    WHERE created_at < current_start_date
    
    UNION ALL
    
    SELECT 
      'average_engagement_score',
      AVG(engagement_score) * 100
    FROM user_behavior_events
    WHERE created_at >= current_start_date
    
    UNION ALL
    
    SELECT 
      'feature_adoption_rate',
      (COUNT(DISTINCT user_id)::NUMERIC / 
       (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active') * 100)
    FROM user_behavior_events
    WHERE event_type = 'feature_used' 
      AND created_at >= current_start_date
  ),
  previous_metrics AS (
    SELECT 
      'total_active_subscriptions' as metric,
      COUNT(*)::NUMERIC as value
    FROM user_subscriptions
    WHERE status = 'active' AND created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'monthly_recurring_revenue',
      SUM(
        CASE tier
          WHEN 'basic' THEN 9.99
          WHEN 'starter' THEN 19.99
          WHEN 'growth' THEN 39.99
          WHEN 'transformation' THEN 79.99
          WHEN 'family' THEN 119.99
          ELSE 0
        END
      )
    FROM user_subscriptions
    WHERE status = 'active' AND created_at <= previous_end_date
    
    UNION ALL
    
    SELECT 
      'new_subscriptions',
      COUNT(*)::NUMERIC
    FROM user_subscriptions
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
    
    UNION ALL
    
    SELECT 
      'churn_rate',
      (COUNT(CASE WHEN status = 'cancelled' AND updated_at >= previous_start_date AND updated_at < previous_end_date THEN 1 END)::NUMERIC / 
       NULLIF(COUNT(*), 0) * 100)
    FROM user_subscriptions
    WHERE created_at < previous_start_date
    
    UNION ALL
    
    SELECT 
      'average_engagement_score',
      AVG(engagement_score) * 100
    FROM user_behavior_events
    WHERE created_at >= previous_start_date AND created_at < previous_end_date
    
    UNION ALL
    
    SELECT 
      'feature_adoption_rate',
      (COUNT(DISTINCT user_id)::NUMERIC / 
       (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active' AND created_at <= previous_end_date) * 100)
    FROM user_behavior_events
    WHERE event_type = 'feature_used' 
      AND created_at >= previous_start_date 
      AND created_at < previous_end_date
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
GRANT EXECUTE ON FUNCTION get_cohort_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO authenticated;
