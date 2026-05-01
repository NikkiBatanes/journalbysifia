-- Manual Supabase SQL: align subscription limits with the current plan matrix.
-- Trial: Spark 5/5, Growth 15/15, Transformation 25/25
-- Paid: Spark 10/10, Growth 25/25, Transformation 60/60
-- Seeker: 2 playbooks/month, 1 devotional/month
--
-- This file is intentionally outside supabase/migrations so it is not applied
-- automatically by migration tooling. Run it manually in the Supabase SQL editor.

UPDATE user_subscriptions_new
SET
  playbooks_limit = CASE
    WHEN tier = 'seeker' THEN 2
    WHEN tier = 'free_trial' THEN
      CASE REPLACE(COALESCE(trial_chosen_tier::text, 'growth'), '_annual', '')
        WHEN 'spark' THEN 5
        WHEN 'growth' THEN 15
        WHEN 'transformation' THEN 25
        ELSE 15
      END
    WHEN REPLACE(tier::text, '_annual', '') = 'spark' THEN 10
    WHEN REPLACE(tier::text, '_annual', '') = 'growth' THEN 25
    WHEN REPLACE(tier::text, '_annual', '') = 'transformation' THEN 60
    ELSE playbooks_limit
  END,
  devotionals_limit = CASE
    WHEN tier = 'seeker' THEN 1
    WHEN tier = 'free_trial' THEN
      CASE REPLACE(COALESCE(trial_chosen_tier::text, 'growth'), '_annual', '')
        WHEN 'spark' THEN 5
        WHEN 'growth' THEN 15
        WHEN 'transformation' THEN 25
        ELSE 15
      END
    WHEN REPLACE(tier::text, '_annual', '') = 'spark' THEN 10
    WHEN REPLACE(tier::text, '_annual', '') = 'growth' THEN 25
    WHEN REPLACE(tier::text, '_annual', '') = 'transformation' THEN 60
    ELSE devotionals_limit
  END,
  smart_journaling_enabled = true,
  updated_at = NOW()
WHERE tier IN (
  'seeker',
  'free_trial',
  'spark', 'spark_annual',
  'growth', 'growth_annual',
  'transformation', 'transformation_annual'
);

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
    playbooks_used,
    devotionals_used,
    last_usage_reset,
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
    true,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_and_handle_expired_trials()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE user_subscriptions_new
  SET
    tier = 'seeker',
    subscription_display_name = 'siFia Seeker',
    playbooks_limit = 2,
    devotionals_limit = 1,
    smart_journaling_enabled = true,
    playbooks_used = 0,
    devotionals_used = 0,
    last_usage_reset = NOW(),
    trial_end_date = NULL,
    -- keep trial_start_date to prevent users from starting a second free trial
    trial_chosen_tier = NULL,
    billing_cycle = NULL,
    billing_issue = false,
    grace_period_end_date = NULL,
    auto_renew_enabled = false,
    status = 'expired',
    updated_at = NOW()
  WHERE
    tier = 'free_trial'
    AND trial_end_date IS NOT NULL
    AND trial_end_date < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
