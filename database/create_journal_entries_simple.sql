-- Simple script to create journal_entries table
-- Run this in Supabase SQL Editor if you're getting "multiple rows returned" errors

-- Drop and recreate the table to ensure clean state
DROP TABLE IF EXISTS journal_entries CASCADE;

-- Create journal_entries table
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('gratitude', 'todo', 'today_win', 'looking_forward', 'todays_focus')),
    content TEXT NOT NULL,
    selected_date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_selected_date ON journal_entries(selected_date);
CREATE INDEX idx_journal_entries_content_type ON journal_entries(content_type);
CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, selected_date);

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own journal entries" ON journal_entries
    FOR ALL USING (auth.uid() = user_id);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify table was created
SELECT 'journal_entries table created successfully' as status;
