-- ========================================
-- COMPLETE DATABASE SCHEMA FOR SIFIA APP
-- Industry Standard Data Management
-- ========================================
-- Run this script in Supabase SQL Editor to create all required tables
-- Includes all tables, indexes, functions, and security policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 1. JOURNAL ENTRIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS journal_entries (
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

-- Indexes for journal entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(selected_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_type ON journal_entries(content_type);

-- ========================================
-- 2. REFLECTION ENTRIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS reflection_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'reflection',
    tags TEXT[],
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reflection entries
CREATE INDEX IF NOT EXISTS idx_reflection_entries_user_id ON reflection_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_created_at ON reflection_entries(created_at DESC);

-- ========================================
-- 3. TIME BLOCKS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    category TEXT,
    color TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_time > start_time)
);

-- Indexes for time blocks
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks(start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_end_time ON time_blocks(end_time);

-- ========================================
-- 4. PRAYERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS prayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_answered BOOLEAN DEFAULT FALSE,
    answered_at TIMESTAMPTZ,
    answered_notes TEXT,
    requested_by TEXT,
    category TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for prayers
CREATE INDEX IF NOT EXISTS idx_prayers_user_id ON prayers(user_id);
CREATE INDEX IF NOT EXISTS idx_prayers_is_answered ON prayers(is_answered);
CREATE INDEX IF NOT EXISTS idx_prayers_created_at ON prayers(created_at DESC);

-- ========================================
-- 5. PLAYBOOKS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    cover_image_url TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration_minutes INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for playbooks
CREATE INDEX IF NOT EXISTS idx_playbooks_user_id ON playbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);

-- ========================================
-- 6. DEVOTIONALS TABLE (UPDATED)
-- ========================================
CREATE TABLE IF NOT EXISTS devotionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic information
    title TEXT NOT NULL,
    description TEXT,
    
    -- Category and classification
    category TEXT NOT NULL DEFAULT 'Growth' CHECK (category IN (
        'Prayer', 'Growth', 'Healing', 'Wisdom', 'Relationships', 
        'Purpose', 'Career', 'Finances', 'Mental Health', 'Parenting', 'Health'
    )),
    categories TEXT[] DEFAULT ARRAY['Growth'],
    
    -- Playbook relationship
    playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    playbook_title TEXT,
    
    -- Progress tracking
    total_days INTEGER NOT NULL DEFAULT 7 CHECK (total_days > 0),
    current_day INTEGER NOT NULL DEFAULT 1 CHECK (current_day >= 1),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Content structure
    days JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- User feedback
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    rated_at TIMESTAMPTZ,
    feedback TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for devotionals
CREATE INDEX IF NOT EXISTS idx_devotionals_user_id ON devotionals(user_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_category ON devotionals(category);
CREATE INDEX IF NOT EXISTS idx_devotionals_playbook_id ON devotionals(playbook_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_completed ON devotionals(completed);
CREATE INDEX IF NOT EXISTS idx_devotionals_progress ON devotionals(progress);
CREATE INDEX IF NOT EXISTS idx_devotionals_created_at ON devotionals(created_at DESC);

-- ========================================
-- 7. PLAYBOOK ACTION STEPS
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_action_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    step_order INTEGER NOT NULL,
    estimated_duration_minutes INTEGER,
    is_required BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for action steps
CREATE INDEX IF NOT EXISTS idx_playbook_action_steps_playbook_id ON playbook_action_steps(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_action_steps_step_order ON playbook_action_steps(playbook_id, step_order);

-- ========================================
-- 8. PLAYBOOK AFFIRMATIONS
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_affirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    affirmation_order INTEGER NOT NULL,
    category TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for affirmations
CREATE INDEX IF NOT EXISTS idx_playbook_affirmations_playbook_id ON playbook_affirmations(playbook_id);

-- ========================================
-- 9. PLAYBOOK BIBLE VERSES
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_bible_verses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    verse_text TEXT NOT NULL,
    reference TEXT NOT NULL,
    verse_order INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bible verses
CREATE INDEX IF NOT EXISTS idx_playbook_bible_verses_playbook_id ON playbook_bible_verses(playbook_id);

-- ========================================
-- 10. PLAYBOOK CHALLENGES
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    challenge_text TEXT NOT NULL,
    challenge_order INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for challenges
CREATE INDEX IF NOT EXISTS idx_playbook_challenges_playbook_id ON playbook_challenges(playbook_id);

-- ========================================
-- 11. USER PROGRESS
-- ========================================
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- 'playbook', 'devotional', etc.
    entity_id UUID NOT NULL,
    progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entity_type, entity_id)
);

-- Indexes for user progress
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_entity ON user_progress(entity_type, entity_id);

-- ========================================
-- 12. USER SETTINGS
-- ========================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate devotional progress
CREATE OR REPLACE FUNCTION calculate_devotional_progress(devotional_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_days_count INTEGER;
    completed_days_count INTEGER;
    calculated_progress INTEGER;
BEGIN
    -- Get total days
    SELECT total_days INTO total_days_count
    FROM devotionals 
    WHERE id = devotional_id;
    
    -- Count completed days from JSON
    SELECT COUNT(*)::INTEGER INTO completed_days_count
    FROM devotionals,
         jsonb_array_elements(days) AS day_elem
    WHERE id = devotional_id
      AND (day_elem->>'completed')::boolean = true;
    
    -- Calculate progress percentage
    IF total_days_count > 0 THEN
        calculated_progress := ROUND((completed_days_count::DECIMAL / total_days_count::DECIMAL) * 100);
    ELSE
        calculated_progress := 0;
    END IF;
    
    -- Update the devotional record
    UPDATE devotionals 
    SET progress = calculated_progress,
        current_day = LEAST(completed_days_count + 1, total_days_count)
    WHERE id = devotional_id;
    
    RETURN calculated_progress;
END;
$$ LANGUAGE plpgsql;

-- Function to create devotional from playbook
CREATE OR REPLACE FUNCTION create_devotional_from_playbook(
    p_user_id UUID,
    p_playbook_id UUID,
    p_title TEXT,
    p_description TEXT DEFAULT '',
    p_category TEXT DEFAULT 'Growth',
    p_duration INTEGER DEFAULT 7
)
RETURNS UUID AS $$
DECLARE
    new_devotional_id UUID;
    playbook_title_cache TEXT;
BEGIN
    -- Get playbook title for caching
    SELECT title INTO playbook_title_cache
    FROM playbooks 
    WHERE id = p_playbook_id;
    
    -- Create the devotional
    INSERT INTO devotionals (
        user_id,
        title,
        description,
        category,
        categories,
        playbook_id,
        playbook_title,
        total_days,
        days
    ) VALUES (
        p_user_id,
        p_title,
        p_description,
        p_category,
        ARRAY[p_category],
        p_playbook_id,
        playbook_title_cache,
        p_duration,
        -- Generate empty days structure
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'dayNumber', day_num,
                    'title', 'Day ' || day_num,
                    'content', '',
                    'reflection', '',
                    'reflectionQuestions', '[]'::jsonb,
                    'prayer', '',
                    'scripture', jsonb_build_object('text', '', 'reference', ''),
                    'completed', false,
                    'completedAt', null
                )
            )
            FROM generate_series(1, p_duration) AS day_num
        )
    )
    RETURNING id INTO new_devotional_id;
    
    RETURN new_devotional_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark devotional day as complete
CREATE OR REPLACE FUNCTION mark_devotional_day_complete(
    p_devotional_id UUID,
    p_day_number INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    updated_days JSONB;
BEGIN
    -- Update the specific day in the days array
    UPDATE devotionals
    SET days = (
        SELECT jsonb_agg(
            CASE 
                WHEN (elem->>'dayNumber')::INTEGER = p_day_number 
                THEN elem || jsonb_build_object('completed', true, 'completedAt', NOW())
                ELSE elem
            END
        )
        FROM jsonb_array_elements(days) AS elem
    )
    WHERE id = p_devotional_id
      AND auth.uid() = user_id;
    
    -- Recalculate progress
    PERFORM calculate_devotional_progress(p_devotional_id);
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS
-- ========================================

-- Create update triggers for all tables with updated_at
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_timestamp ON %I', 
                      t.table_name, t.table_name);
        EXECUTE format('CREATE TRIGGER update_%s_timestamp
                      BEFORE UPDATE ON %I
                      FOR EACH ROW EXECUTE FUNCTION update_timestamp()',
                      t.table_name, t.table_name);
    END LOOP;
END;
$$;

-- Special trigger for devotionals to handle completion
CREATE OR REPLACE FUNCTION update_devotional_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-update completion status based on progress
    IF NEW.progress >= 100 AND NEW.completed = FALSE THEN
        NEW.completed := TRUE;
        NEW.completed_at := NOW();
    ELSIF NEW.progress < 100 AND NEW.completed = TRUE THEN
        NEW.completed := FALSE;
        NEW.completed_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_devotional_completion ON devotionals;
CREATE TRIGGER trigger_devotional_completion
    BEFORE UPDATE ON devotionals
    FOR EACH ROW
    EXECUTE FUNCTION update_devotional_completion();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT IN ('spatial_ref_sys')  -- Exclude PostGIS tables if any
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END;
$$;

-- Journal Entries Policies
CREATE POLICY "Users can manage own journal entries" ON journal_entries
    USING (auth.uid() = user_id);

-- Reflection Entries Policies
CREATE POLICY "Users can manage own reflection entries" ON reflection_entries
    USING (auth.uid() = user_id);

-- Time Blocks Policies
CREATE POLICY "Users can manage own time blocks" ON time_blocks
    USING (auth.uid() = user_id);

-- Prayers Policies
CREATE POLICY "Users can manage own prayers" ON prayers
    USING (auth.uid() = user_id);

-- Playbooks Policies
CREATE POLICY "Users can manage own playbooks" ON playbooks
    USING (auth.uid() = user_id);

CREATE POLICY "Public playbooks are viewable" ON playbooks
    FOR SELECT USING (is_public = true);

-- Devotionals Policies
CREATE POLICY "Users can manage own devotionals" ON devotionals
    USING (auth.uid() = user_id);

-- User Progress Policies
CREATE POLICY "Users can manage own progress" ON user_progress
    USING (auth.uid() = user_id);

-- User Settings Policies
CREATE POLICY "Users can manage own settings" ON user_settings
    USING (auth.uid() = user_id);

-- ========================================
-- SEARCH FUNCTIONALITY
-- ========================================

-- Add search vector to devotionals
ALTER TABLE devotionals ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', 
            COALESCE(title, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(category, '') || ' ' ||
            COALESCE(playbook_title, '')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_devotionals_search ON devotionals USING GIN(search_vector);

-- ========================================
-- VIEWS
-- ========================================

-- View for devotional analytics
CREATE OR REPLACE VIEW devotional_analytics AS
SELECT 
    user_id,
    category,
    COUNT(*) as total_devotionals,
    COUNT(*) FILTER (WHERE completed = true) as completed_devotionals,
    AVG(progress) as avg_progress,
    AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
    COUNT(*) FILTER (WHERE playbook_id IS NOT NULL) as from_playbooks,
    MIN(created_at) as first_devotional,
    MAX(updated_at) as last_activity
FROM devotionals
GROUP BY user_id, category;

-- View for user progress summary
CREATE OR REPLACE VIEW user_progress_summary AS
SELECT 
    up.user_id,
    up.entity_type,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE up.completed = true) as completed_items,
    ROUND(COUNT(*) FILTER (WHERE up.completed = true) * 100.0 / 
          NULLIF(COUNT(*), 0), 1) as completion_percentage,
    MAX(up.updated_at) as last_updated
FROM user_progress up
GROUP BY up.user_id, up.entity_type;

-- ========================================
-- PERMISSIONS
-- ========================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Tables
GRANT SELECT, INSERT, UPDATE, DELETE ON 
    journal_entries, 
    reflection_entries, 
    time_blocks, 
    prayers, 
    playbooks, 
    devotionals,
    playbook_action_steps,
    playbook_affirmations,
    playbook_bible_verses,
    playbook_challenges,
    user_progress,
    user_settings
TO authenticated;

-- Sequences (for auto-incrementing IDs if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Views
GRANT SELECT ON 
    devotional_analytics,
    user_progress_summary
TO authenticated;

-- ========================================
-- FINAL SETUP
-- ========================================

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DATABASE SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created tables with RLS and proper indexing.';
    RAISE NOTICE 'All tables have update_at triggers.';
    RAISE NOTICE 'Row Level Security (RLS) is enabled on all tables.';
    RAISE NOTICE '========================================';
END;
$$;
