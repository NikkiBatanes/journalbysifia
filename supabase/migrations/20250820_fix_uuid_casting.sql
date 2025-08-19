-- Fix UUID casting in increment functions
-- Created: 2025-08-20

-- Drop and recreate increment_usage_counter with proper UUID casting
DROP FUNCTION IF EXISTS increment_usage_counter(TEXT, TEXT);

CREATE OR REPLACE FUNCTION increment_usage_counter(
  p_user_id TEXT,
  p_field TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    UPDATE user_subscriptions_new 
    SET %I = COALESCE(%I, 0) + 1,
        updated_at = NOW()
    WHERE user_id = $1::uuid
  ', p_field, p_field) 
  USING p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate increment_usage_tracking with proper UUID casting
DROP FUNCTION IF EXISTS increment_usage_tracking(TEXT, TEXT, TEXT);

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
      $1::uuid, 
      $2::uuid, 
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
