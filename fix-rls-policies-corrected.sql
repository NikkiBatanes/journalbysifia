-- CORRECTED RLS Policy Fix for All Tables
-- This fixes RLS policy violations with correct column names

-- ========================================
-- 1. USER PROFILES
-- ========================================

-- Add INSERT policy for user_profiles (if not exists)
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ========================================
-- 2. PRAYERS TABLE (CORRECTED)
-- ========================================

-- Drop existing policy and create specific ones
DROP POLICY IF EXISTS "Users can manage own prayers" ON prayers;

-- Allow users to view their own prayers
CREATE POLICY "Users can view own prayers" ON prayers
FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own prayers
CREATE POLICY "Users can insert own prayers" ON prayers
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own prayers
CREATE POLICY "Users can update own prayers" ON prayers
FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own prayers
CREATE POLICY "Users can delete own prayers" ON prayers
FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- 3. DEVOTIONALS TABLE
-- ========================================

-- Check if devotionals table exists first
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'devotionals') THEN
        -- Drop existing policy and create specific ones
        DROP POLICY IF EXISTS "Users can manage own devotionals" ON devotionals;

        -- Allow users to view their own devotionals
        EXECUTE 'CREATE POLICY "Users can view own devotionals" ON devotionals FOR SELECT USING (auth.uid() = user_id)';

        -- Allow users to insert their own devotionals
        EXECUTE 'CREATE POLICY "Users can insert own devotionals" ON devotionals FOR INSERT WITH CHECK (auth.uid() = user_id)';

        -- Allow users to update their own devotionals
        EXECUTE 'CREATE POLICY "Users can update own devotionals" ON devotionals FOR UPDATE USING (auth.uid() = user_id)';

        -- Allow users to delete their own devotionals
        EXECUTE 'CREATE POLICY "Users can delete own devotionals" ON devotionals FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ========================================
-- 4. JOURNAL ENTRIES TABLE (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can manage own journal entries" ON journal_entries;
        
        -- Create specific policies
        EXECUTE 'CREATE POLICY "Users can view own journal entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can insert own journal entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can update own journal entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can delete own journal entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ========================================
-- 5. PRAYER LOGS TABLE (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prayer_logs') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can manage own prayer logs" ON prayer_logs;
        
        -- Create specific policies
        EXECUTE 'CREATE POLICY "Users can view own prayer logs" ON prayer_logs FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can insert own prayer logs" ON prayer_logs FOR INSERT WITH CHECK (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can update own prayer logs" ON prayer_logs FOR UPDATE USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can delete own prayer logs" ON prayer_logs FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ========================================
-- 6. GOALS TABLE (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'goals') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can manage own goals" ON goals;
        
        -- Create specific policies
        EXECUTE 'CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ========================================
-- 7. ACTIVITY LOGS TABLE (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can manage own activity logs" ON activity_logs;
        
        -- Create specific policies
        EXECUTE 'CREATE POLICY "Users can view own activity logs" ON activity_logs FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can insert own activity logs" ON activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can update own activity logs" ON activity_logs FOR UPDATE USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can delete own activity logs" ON activity_logs FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ========================================
-- 8. ENABLE RLS ON TABLES (if not enabled)
-- ========================================

-- Enable RLS on prayers table
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on devotionals table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'devotionals') THEN
        EXECUTE 'ALTER TABLE devotionals ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ========================================
-- VERIFICATION
-- ========================================

-- List all policies for verification
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'prayers', 'devotionals', 'journal_entries', 'prayer_logs', 'goals', 'activity_logs')
ORDER BY tablename, cmd;
