-- Add test name to user_profiles for current user
UPDATE user_profiles 
SET 
  first_name = 'Nikki',
  last_name = 'Mae',
  full_name = 'Nikki Mae',
  updated_at = now()
WHERE id = '4e31989a-7192-4935-a5d3-4ac2cb38f123';

-- Verify
SELECT id, email, first_name, last_name, full_name 
FROM user_profiles 
WHERE id = '4e31989a-7192-4935-a5d3-4ac2cb38f123';
