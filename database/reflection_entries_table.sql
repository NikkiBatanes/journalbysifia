-- Create reflection_entries table for storing reflection log entries
CREATE TABLE IF NOT EXISTS reflection_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'reflection',
    type TEXT CHECK (type IN ('free', 'guided')) DEFAULT 'free',
    source TEXT, -- 'devotional' or null for regular reflections
    selected_date DATE NOT NULL,
    
    -- Devotional metadata (when source = 'devotional')
    devotional_title TEXT,
    day_number INTEGER,
    day_title TEXT,
    total_days INTEGER,
    question_number INTEGER,
    
    -- Version field for conflict resolution
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT reflection_entries_user_date_idx UNIQUE (user_id, selected_date, id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reflection_entries_user_id ON reflection_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_selected_date ON reflection_entries(selected_date);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_user_date ON reflection_entries(user_id, selected_date);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_source ON reflection_entries(source);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_type ON reflection_entries(type);

-- Enable Row Level Security (RLS)
ALTER TABLE reflection_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own reflection entries" ON reflection_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reflection entries" ON reflection_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reflection entries" ON reflection_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reflection entries" ON reflection_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_reflection_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reflection_entries_updated_at
    BEFORE UPDATE ON reflection_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_reflection_entries_updated_at();
