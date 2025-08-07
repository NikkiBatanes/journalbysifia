-- Fix Missing User Profile for Completed Onboarding User
-- Run this in Supabase SQL Editor to create your missing user profile

-- First, let's check what users exist in auth.users but not in user_profiles
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data,
  au.created_at,
  CASE WHEN up.id IS NULL THEN 'MISSING PROFILE' ELSE 'HAS PROFILE' END as profile_status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;

-- Create user profile for authenticated users who don't have one
-- Replace 'YOUR_USER_ID' with your actual user ID from the query above
-- Or run the INSERT with the dynamic query below

-- Option 1: Manual insert (replace YOUR_USER_ID and YOUR_EMAIL)
/*
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  avatar_url,
  country_code,
  timezone,
  locale,
  onboarding_completed,
  created_at,
  updated_at
) VALUES (
  'YOUR_USER_ID',  -- Replace with your actual user ID
  'YOUR_EMAIL',    -- Replace with your actual email
  'Your Name',     -- Replace with your actual name
  NULL,            -- Avatar URL (optional)
  'US',
  'UTC',
  'en',
  true,            -- Set to true since you completed onboarding
  NOW(),
  NOW()
);
*/

-- Option 2: Automatic insert for all missing profiles (sets onboarding_completed = true)
-- Use this if you want to mark all missing profiles as completed
INSERT INTO user_profiles (
  id,
  email,
  onboarding_completed
)
SELECT 
  au.id,
  au.email,
  true as onboarding_completed  -- Set to true since you completed onboarding
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;

-- Verify the insert worked
SELECT 
  id,
  email,
  onboarding_completed
FROM user_profiles
ORDER BY id DESC
LIMIT 5;
