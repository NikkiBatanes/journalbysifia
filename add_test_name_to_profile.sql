-- Add test name to user_profiles for current user
-- Replace USER_ID with your actual user ID from the logs
UPDATE user_profiles 
SET 
  first_name = 'Nikki',
  last_name = 'Mae',
  full_name = 'Nikki Mae',
  updated_at = now()
WHERE id = '82bbaff1-aac1-4ac3-b51e-e678b7f7fa4f';

-- Also update auth metadata
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || 
  jsonb_build_object(
    'first_name', 'Nikki',
    'last_name', 'Mae',
    'full_name', 'Nikki Mae'
  )
WHERE id = '82bbaff1-aac1-4ac3-b51e-e678b7f7fa4f';

-- Verify
SELECT id, email, first_name, last_name, full_name 
FROM user_profiles 
WHERE id = '82bbaff1-aac1-4ac3-b51e-e678b7f7fa4f';
