-- Temporarily disable the problematic trigger to allow user registration
-- This will let us handle user profile creation in the application code instead

-- Drop the trigger that's causing the database error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Also drop the function to be safe
DROP FUNCTION IF EXISTS handle_new_user();

-- This will allow Supabase auth.signUp() to work without trying to create user profiles
-- We'll handle profile creation in the React Native app using the createUserProfileIfNeeded function
