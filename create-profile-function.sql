-- Create a secure function to create default user profiles
-- This function bypasses RLS using SECURITY DEFINER

CREATE OR REPLACE FUNCTION create_default_user_profile(
  p_user_id UUID,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_profile_data JSONB;
BEGIN
  -- Insert the default profile
  INSERT INTO user_profiles (
    id,
    email,
    first_name,
    last_name,
    bio,
    avatar_url,
    faith_points,
    growth_level,
    total_faith_points_earned,
    current_streak,
    longest_streak,
    last_activity_date,
    email_verified,
    last_login_at,
    last_active_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    'User',
    '',
    '',
    NULL,
    0,
    'Seedling',
    0,
    0,
    0,
    CURRENT_DATE,
    FALSE,
    NOW(),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING to_jsonb(user_profiles.*) INTO v_profile_data;
  
  RETURN v_profile_data;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating default profile for user %: %', p_user_id, SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_default_user_profile(UUID, TEXT) TO authenticated;
