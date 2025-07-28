-- Fix RLS Policy for user_profiles table
-- Add missing INSERT policy to allow users to create their own profiles

-- Add INSERT policy for user_profiles
CREATE POLICY "Users can insert their own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Verify the policies are in place
\d+ user_profiles;
