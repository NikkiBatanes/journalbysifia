-- Fix RLS Policies for siFia App
-- Run these commands in your Supabase SQL Editor

-- 0. Clean up duplicate entries and invalid content_types first
DO $$
BEGIN
  -- Remove entries with invalid content_types
  DELETE FROM journal_entries 
  WHERE content_type NOT IN ('gratitude', 'todo', 'today_win', 'looking_forward', 'todays_focus', 'reflection_log');
  
  -- Remove duplicate entries (keep the most recent one for each user/date/content_type combination)
  DELETE FROM journal_entries a
  USING journal_entries b
  WHERE a.id < b.id
    AND a.user_id = b.user_id
    AND a.selected_date = b.selected_date
    AND a.content_type = b.content_type;
    
  RAISE NOTICE 'Cleanup completed: removed invalid content_types and duplicates';
END $$;

-- 1. Update content_type constraint to include all valid types
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_content_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_content_type_check 
  CHECK (content_type IN ('gratitude', 'todo', 'today_win', 'looking_forward', 'todays_focus', 'reflection_log'));

-- 2. Enable RLS on all tables (if not already enabled)
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
