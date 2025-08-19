-- Update existing user subscriptions with correct tier limits
-- Created: 2025-08-20 06:47:00

-- Update Spark tier subscriptions
UPDATE user_subscriptions_new 
SET 
  playbooks_limit = 8,
  devotionals_limit = 8,
  smart_journaling_enabled = true,
  updated_at = NOW()
WHERE tier = 'spark';

-- Update Growth tier subscriptions  
UPDATE user_subscriptions_new 
SET 
  playbooks_limit = 20,
  devotionals_limit = 20,
  smart_journaling_enabled = true,
  updated_at = NOW()
WHERE tier = 'growth';

-- Update Transformation tier subscriptions
UPDATE user_subscriptions_new 
SET 
  playbooks_limit = -1,
  devotionals_limit = -1,
  smart_journaling_enabled = true,
  updated_at = NOW()
WHERE tier = 'transformation';

-- Update Family tier subscriptions
UPDATE user_subscriptions_new 
SET 
  playbooks_limit = -1,
  devotionals_limit = -1,
  smart_journaling_enabled = true,
  updated_at = NOW()
WHERE tier = 'family';

-- Update Free Trial subscriptions
UPDATE user_subscriptions_new 
SET 
  playbooks_limit = 2,
  devotionals_limit = 2,
  smart_journaling_enabled = false,
  updated_at = NOW()
WHERE tier = 'free_trial';

-- Update Seeker subscriptions (ensure they have 0/0)
UPDATE user_subscriptions_new 
SET 
  playbooks_limit = 0,
  devotionals_limit = 0,
  smart_journaling_enabled = false,
  updated_at = NOW()
WHERE tier = 'seeker';
