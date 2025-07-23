-- ========================================
-- COMPLETE DATABASE SETUP FOR SIFIA APP
-- ========================================
-- Run this script in Supabase SQL Editor to create all required tables

-- 1. JOURNAL ENTRIES TABLE
-- ========================
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

-- Journal entries indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_selected_date ON journal_entries(selected_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_content_type ON journal_entries(content_type);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, selected_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date_type ON journal_entries(user_id, selected_date, content_type);

-- Journal entries RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journal entries" ON journal_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own journal entries" ON journal_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journal entries" ON journal_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal entries" ON journal_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Journal entries trigger
CREATE OR REPLACE FUNCTION update_journal_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_journal_entries_updated_at();

-- 2. REFLECTION ENTRIES TABLE
-- ===========================
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reflection entries indexes
CREATE INDEX IF NOT EXISTS idx_reflection_entries_user_id ON reflection_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_selected_date ON reflection_entries(selected_date);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_user_date ON reflection_entries(user_id, selected_date);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_source ON reflection_entries(source);

-- Reflection entries RLS
ALTER TABLE reflection_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reflection entries" ON reflection_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reflection entries" ON reflection_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reflection entries" ON reflection_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reflection entries" ON reflection_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Reflection entries trigger
CREATE OR REPLACE FUNCTION update_reflection_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reflection_entries_updated_at
    BEFORE UPDATE ON reflection_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_reflection_entries_updated_at();

-- 3. TIME BLOCKS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    selected_date DATE NOT NULL,
    repeat_rule JSONB,
    repeat_until DATE,
    timezone TEXT DEFAULT 'UTC',
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT time_blocks_time_check CHECK (end_time > start_time)
);

-- Time blocks indexes
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_selected_date ON time_blocks(selected_date);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date ON time_blocks(user_id, selected_date);
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks(start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_end_time ON time_blocks(end_time);

-- Time blocks RLS
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time blocks" ON time_blocks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time blocks" ON time_blocks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time blocks" ON time_blocks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time blocks" ON time_blocks
    FOR DELETE USING (auth.uid() = user_id);

-- Time blocks trigger
CREATE OR REPLACE FUNCTION update_time_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_time_blocks_updated_at
    BEFORE UPDATE ON time_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_time_blocks_updated_at();

-- 4. PRAYERS TABLE (if not exists)
-- ================================
CREATE TABLE IF NOT EXISTS prayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('adoration', 'confession', 'thanksgiving', 'supplication', 'people')),
    content TEXT NOT NULL,
    selected_date DATE NOT NULL,
    is_answered BOOLEAN DEFAULT FALSE,
    answered_at TIMESTAMPTZ,
    person_name TEXT, -- for people prayers
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prayers indexes
CREATE INDEX IF NOT EXISTS idx_prayers_user_id ON prayers(user_id);
CREATE INDEX IF NOT EXISTS idx_prayers_selected_date ON prayers(selected_date);
CREATE INDEX IF NOT EXISTS idx_prayers_user_date ON prayers(user_id, selected_date);
CREATE INDEX IF NOT EXISTS idx_prayers_type ON prayers(type);

-- Prayers RLS
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prayers" ON prayers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prayers" ON prayers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prayers" ON prayers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prayers" ON prayers
    FOR DELETE USING (auth.uid() = user_id);

-- Prayers trigger
CREATE OR REPLACE FUNCTION update_prayers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_prayers_updated_at
    BEFORE UPDATE ON prayers
    FOR EACH ROW
    EXECUTE FUNCTION update_prayers_updated_at();

-- ========================================
-- SETUP COMPLETE
-- ========================================
-- All tables created with proper:
-- - Primary keys and foreign keys
-- - Indexes for performance
-- - Row Level Security (RLS) policies
-- - Triggers for automatic timestamps
-- - Data validation constraints
-- ========================================
