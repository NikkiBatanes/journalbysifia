-- Update user metadata with test name
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || 
  jsonb_build_object(
    'first_name', 'TestUser',
    'last_name', 'Apple',
    'full_name', 'TestUser Apple'
  )
WHERE id = 'e50fc94b-0920-481a-b69b-d84756ee08e5';

-- Verify the update
SELECT 
  id,
  email,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users 
WHERE id = 'e50fc94b-0920-481a-b69b-d84756ee08e5';
