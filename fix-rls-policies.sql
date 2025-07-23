-- Fix RLS Policies for siFia App
-- Run these commands in your Supabase SQL Editor

-- 1. Enable RLS on all tables (if not already enabled)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE devotionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any) to start fresh
DROP POLICY IF EXISTS "Users can manage their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can view their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can update their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete their own journal entries" ON journal_entries;

DROP POLICY IF EXISTS "Users can manage their own prayers" ON prayers;
DROP POLICY IF EXISTS "Users can view their own prayers" ON prayers;
DROP POLICY IF EXISTS "Users can insert their own prayers" ON prayers;
DROP POLICY IF EXISTS "Users can update their own prayers" ON prayers;
DROP POLICY IF EXISTS "Users can delete their own prayers" ON prayers;

DROP POLICY IF EXISTS "Users can manage their own devotionals" ON devotionals;
DROP POLICY IF EXISTS "Users can view their own devotionals" ON devotionals;
DROP POLICY IF EXISTS "Users can insert their own devotionals" ON devotionals;
DROP POLICY IF EXISTS "Users can update their own devotionals" ON devotionals;
DROP POLICY IF EXISTS "Users can delete their own devotionals" ON devotionals;

DROP POLICY IF EXISTS "Users can manage their own playbooks" ON playbooks;
DROP POLICY IF EXISTS "Users can view their own playbooks" ON playbooks;
DROP POLICY IF EXISTS "Users can insert their own playbooks" ON playbooks;
DROP POLICY IF EXISTS "Users can update their own playbooks" ON playbooks;
DROP POLICY IF EXISTS "Users can delete their own playbooks" ON playbooks;

-- 3. Create comprehensive policies for journal_entries
CREATE POLICY "Users can view their own journal entries" ON journal_entries
    FOR SELECT USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert their own journal entries" ON journal_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update their own journal entries" ON journal_entries
    FOR UPDATE USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete their own journal entries" ON journal_entries
    FOR DELETE USING (auth.uid() = user_id::uuid);

-- 4. Create comprehensive policies for prayers
CREATE POLICY "Users can view their own prayers" ON prayers
    FOR SELECT USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert their own prayers" ON prayers
    FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update their own prayers" ON prayers
    FOR UPDATE USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete their own prayers" ON prayers
    FOR DELETE USING (auth.uid() = user_id::uuid);

-- 5. Create comprehensive policies for devotionals
CREATE POLICY "Users can view their own devotionals" ON devotionals
    FOR SELECT USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert their own devotionals" ON devotionals
    FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update their own devotionals" ON devotionals
    FOR UPDATE USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete their own devotionals" ON devotionals
    FOR DELETE USING (auth.uid() = user_id::uuid);

-- 6. Create comprehensive policies for playbooks
CREATE POLICY "Users can view their own playbooks" ON playbooks
    FOR SELECT USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert their own playbooks" ON playbooks
    FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update their own playbooks" ON playbooks
    FOR UPDATE USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete their own playbooks" ON playbooks
    FOR DELETE USING (auth.uid() = user_id::uuid);

-- 7. Verify policies are created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('journal_entries', 'prayers', 'devotionals', 'playbooks')
ORDER BY tablename, policyname;
