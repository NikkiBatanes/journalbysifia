-- Fix script for journal_entries table duplicate issues
-- Run this in Supabase SQL Editor

-- Step 1: Check if table exists and show current structure
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
        RAISE NOTICE 'journal_entries table exists';
    ELSE
        RAISE NOTICE 'journal_entries table does NOT exist - need to create it';
    END IF;
END $$;

-- Step 2: Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('gratitude', 'todo', 'today_win', 'looking_forward', 'todays_focus')),
    content TEXT NOT NULL,
    selected_date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Find and remove any duplicate entries (keeping the most recent)
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY user_id, selected_date, content_type, content ORDER BY created_at DESC) as rn
    FROM journal_entries
),
to_delete AS (
    SELECT id FROM duplicates WHERE rn > 1
)
DELETE FROM journal_entries 
WHERE id IN (SELECT id FROM to_delete);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_selected_date ON journal_entries(selected_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_content_type ON journal_entries(content_type);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, selected_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date_type ON journal_entries(user_id, selected_date, content_type);

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
DROP POLICY IF EXISTS "Users can view their own journal entries" ON journal_entries;
CREATE POLICY "Users can view their own journal entries" ON journal_entries
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own journal entries" ON journal_entries;
CREATE POLICY "Users can insert their own journal entries" ON journal_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own journal entries" ON journal_entries;
CREATE POLICY "Users can update their own journal entries" ON journal_entries
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own journal entries" ON journal_entries;
CREATE POLICY "Users can delete their own journal entries" ON journal_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Step 7: Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Show final table info
SELECT 
    'journal_entries' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT content_type) as content_types
FROM journal_entries;

-- Show any remaining potential duplicates
SELECT 
    user_id, 
    selected_date, 
    content_type, 
    content,
    COUNT(*) as duplicate_count
FROM journal_entries 
GROUP BY user_id, selected_date, content_type, content
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
