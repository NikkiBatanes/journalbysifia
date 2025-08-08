-- Fix user database constraints
-- This script creates the missing users table and syncs with auth.users

-- 1. Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;

-- 4. Create policies for users to manage their own data
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Function to sync auth.users with public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger to sync new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Sync existing auth users (this will need to be done manually or via a script)
-- For now, we'll create a function that can be called to sync existing users
CREATE OR REPLACE FUNCTION public.sync_auth_users()
RETURNS TEXT AS $$
DECLARE
  user_record RECORD;
  sync_count INTEGER := 0;
BEGIN
  -- This function needs to be called with elevated privileges
  -- It will sync existing auth.users to public.users
  FOR user_record IN 
    SELECT id, email, created_at, updated_at 
    FROM auth.users 
  LOOP
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (user_record.id, user_record.email, user_record.created_at, user_record.updated_at)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = EXCLUDED.updated_at;
    
    sync_count := sync_count + 1;
  END LOOP;
  
  RETURN 'Synced ' || sync_count || ' users';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- 9. Fix onboarding_progress foreign key constraint if needed
-- First check if the constraint exists and points to the wrong table
DO $$
BEGIN
  -- Drop the problematic foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'onboarding_progress_user_id_fkey' 
    AND table_name = 'onboarding_progress'
  ) THEN
    ALTER TABLE onboarding_progress DROP CONSTRAINT onboarding_progress_user_id_fkey;
  END IF;
  
  -- Add the correct foreign key constraint to public.users
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'onboarding_progress') THEN
    ALTER TABLE onboarding_progress 
    ADD CONSTRAINT onboarding_progress_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 10. Fix user_subscriptions foreign key if needed
DO $$
BEGIN
  -- Check if user_subscriptions table exists and fix its foreign key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
    -- Drop existing constraint if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'user_subscriptions_user_id_fkey' 
      AND table_name = 'user_subscriptions'
    ) THEN
      ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_user_id_fkey;
    END IF;
    
    -- Add correct foreign key constraint
    ALTER TABLE user_subscriptions 
    ADD CONSTRAINT user_subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Success message
SELECT 'User constraints fixed successfully!' as result;
