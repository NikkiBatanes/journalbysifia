-- Update tier limits for Spark and Growth subscriptions
-- Spark: 8 -> 10 playbooks/devotionals
-- Growth: 20 -> 25 playbooks/devotionals

-- Update Spark subscriptions (both monthly and annual)
UPDATE user_subscriptions_new
SET 
  playbooks_limit = 10,
  devotionals_limit = 10,
  updated_at = NOW()
WHERE tier IN ('spark', 'spark_annual')
  AND playbooks_limit = 8;

-- Update Growth subscriptions (both monthly and annual)
UPDATE user_subscriptions_new
SET 
  playbooks_limit = 25,
  devotionals_limit = 25,
  updated_at = NOW()
WHERE tier IN ('growth', 'growth_annual')
  AND playbooks_limit = 20;

-- Update free trial limits based on trial_chosen_tier
-- Spark trial: 5/5 (already correct)
-- Growth trial: 15/15 (already correct)  
-- Transformation trial: 25/25 (already correct)
-- No changes needed for trials

-- Log the update
SELECT 
  tier,
  COUNT(*) as updated_count,
  playbooks_limit,
  devotionals_limit
FROM user_subscriptions_new
WHERE tier IN ('spark', 'spark_annual', 'growth', 'growth_annual')
GROUP BY tier, playbooks_limit, devotionals_limit;
