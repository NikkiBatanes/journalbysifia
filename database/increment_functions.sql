-- Database functions for incrementing usage counters
-- Created: 2025-08-20

-- Function to increment usage counters in user_subscriptions_new table
CREATE OR REPLACE FUNCTION increment_usage_counter(
  p_user_id TEXT,
  p_field TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    UPDATE user_subscriptions_new 
    SET %I = COALESCE(%I, 0) + 1,
        updated_at = NOW()
    WHERE user_id = $1
  ', p_field, p_field) 
  USING p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage tracking counters
CREATE OR REPLACE FUNCTION increment_usage_tracking(
  p_user_id TEXT,
  p_subscription_id TEXT,
  p_field TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    INSERT INTO subscription_usage_tracking (
      user_id, 
      subscription_id, 
      %I, 
      tracking_period_start,
      updated_at
    ) VALUES (
      $1, 
      $2, 
      1, 
      DATE_TRUNC(''month'', NOW()),
      NOW()
    )
    ON CONFLICT (user_id, subscription_id, tracking_period_start) 
    DO UPDATE SET 
      %I = COALESCE(subscription_usage_tracking.%I, 0) + 1,
      updated_at = NOW()
  ', p_field, p_field, p_field)
  USING p_user_id, p_subscription_id;
END;
$$ LANGUAGE plpgsql;
