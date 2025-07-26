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
-- 1. JOURNAL ENTRIES
-- ========================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN (
        'gratitude', 'todo', 'today_win', 'looking_forward', 'todays_focus'
    )),
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
-- 2. PLAYBOOKS
-- ========================================
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    truth_in_love JSONB,
    bible_verse JSONB,
    direct_challenge JSONB,
    challenge_cta TEXT,
    status TEXT CHECK (status IN ('ongoing', 'completed', 'paused')) DEFAULT 'ongoing',
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
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON playbooks(status);

-- ========================================
-- 3. PLAYBOOK ACTION STEPS
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_action_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for action steps
CREATE INDEX IF NOT EXISTS idx_playbook_action_steps_playbook_id ON playbook_action_steps(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_action_steps_order ON playbook_action_steps(playbook_id, order_index);

-- ========================================
-- 4. PLAYBOOK SUB-TASKS
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_sub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_step_id UUID NOT NULL REFERENCES playbook_action_steps(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sub-tasks
CREATE INDEX IF NOT EXISTS idx_playbook_sub_tasks_action_step_id ON playbook_sub_tasks(action_step_id);
CREATE INDEX IF NOT EXISTS idx_playbook_sub_tasks_order ON playbook_sub_tasks(action_step_id, order_index);

-- ========================================
-- 5. PLAYBOOK AFFIRMATIONS
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_affirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for affirmations
CREATE INDEX IF NOT EXISTS idx_playbook_affirmations_playbook_id ON playbook_affirmations(playbook_id);

-- ========================================
-- 6. PRAYERS
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
-- 7. DEVOTIONALS
-- ========================================
CREATE TABLE IF NOT EXISTS devotionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Growth',
    categories TEXT[] DEFAULT ARRAY['Growth'],
    total_days INTEGER NOT NULL DEFAULT 7,
    current_day INTEGER NOT NULL DEFAULT 1,
    progress INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    days JSONB NOT NULL DEFAULT '[]'::jsonb,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    rated_at TIMESTAMPTZ,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CHECK (current_day >= 1 AND current_day <= total_days),
    CHECK (progress >= 0 AND progress <= 100)
);

-- Indexes for devotionals
CREATE INDEX IF NOT EXISTS idx_devotionals_user_id ON devotionals(user_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_playbook_id ON devotionals(playbook_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_completed ON devotionals(completed);
CREATE INDEX IF NOT EXISTS idx_devotionals_created_at ON devotionals(created_at DESC);

-- ========================================
-- 8. USER SETTINGS
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

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate devotional progress
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

-- Calculate playbook progress
CREATE OR REPLACE FUNCTION calculate_playbook_progress(playbook_uuid UUID)
RETURNS TABLE (
    completed_tasks BIGINT,
    total_tasks BIGINT,
    progress_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH task_counts AS (
        SELECT 
            COUNT(CASE WHEN pas.completed = TRUE THEN 1 END) AS completed,
            COUNT(*) AS total
        FROM playbook_action_steps pas
        WHERE pas.playbook_id = playbook_uuid
        
        UNION ALL
        
        SELECT 
            COUNT(CASE WHEN pst.completed = TRUE THEN 1 END) AS completed,
            COUNT(*) AS total
        FROM playbook_sub_tasks pst
        JOIN playbook_action_steps pas ON pst.action_step_id = pas.id
        WHERE pas.playbook_id = playbook_uuid
        
        UNION ALL
        
        SELECT 
            COUNT(CASE WHEN pa.completed = TRUE THEN 1 END) AS completed,
            COUNT(*) AS total
        FROM playbook_affirmations pa
        WHERE pa.playbook_id = playbook_uuid
    )
    SELECT 
        SUM(completed)::BIGINT,
        SUM(total)::BIGINT,
        CASE 
            WHEN SUM(total) = 0 THEN 0
            ELSE ROUND((SUM(completed) * 100.0) / SUM(total), 2)
        END AS progress_percentage
    FROM task_counts;
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

-- ========================================
-- VIEWS
-- ========================================

-- Playbooks with progress view
CREATE OR REPLACE VIEW playbooks_with_progress AS
SELECT 
    p.*,
    COALESCE(t.completed_tasks, 0) AS completed_tasks,
    COALESCE(t.total_tasks, 0) AS total_tasks,
    COALESCE(t.progress_percentage, 0) AS progress_percentage
FROM playbooks p
LEFT JOIN LATERAL (
    SELECT * FROM calculate_playbook_progress(p.id)
) t ON true;

-- Devotional analytics view
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

-- Playbooks Policies
CREATE POLICY "Users can manage own playbooks" ON playbooks
    USING (auth.uid() = user_id);

CREATE POLICY "Public playbooks are viewable" ON playbooks
    FOR SELECT USING (is_public = true);

-- Action Steps Policies
CREATE POLICY "Users can manage own action steps" ON playbook_action_steps
    USING (EXISTS (
        SELECT 1 FROM playbooks p 
        WHERE p.id = playbook_action_steps.playbook_id 
        AND p.user_id = auth.uid()
    ));

-- Sub-tasks Policies
CREATE POLICY "Users can manage own sub-tasks" ON playbook_sub_tasks
    USING (EXISTS (
        SELECT 1 FROM playbook_action_steps pas
        JOIN playbooks p ON pas.playbook_id = p.id
        WHERE pas.id = playbook_sub_tasks.action_step_id
        AND p.user_id = auth.uid()
    ));

-- Affirmations Policies
CREATE POLICY "Users can manage own affirmations" ON playbook_affirmations
    USING (EXISTS (
        SELECT 1 FROM playbooks p 
        WHERE p.id = playbook_affirmations.playbook_id 
        AND p.user_id = auth.uid()
    ));

-- Prayers Policies
CREATE POLICY "Users can manage own prayers" ON prayers
    USING (auth.uid() = user_id OR is_public = true);

-- Devotionals Policies
CREATE POLICY "Users can manage own devotionals" ON devotionals
    USING (auth.uid() = user_id);

-- User Settings Policies
CREATE POLICY "Users can manage own settings" ON user_settings
    USING (auth.uid() = user_id);

-- ========================================
-- PERMISSIONS
-- ========================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Tables
GRANT SELECT, INSERT, UPDATE, DELETE ON 
    journal_entries, 
    playbooks,
    playbook_action_steps,
    playbook_sub_tasks,
    playbook_affirmations,
    prayers,
    devotionals,
    user_settings
TO authenticated;

-- Sequences (for auto-incrementing IDs if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Views
GRANT SELECT ON 
    playbooks_with_progress,
    devotional_analytics
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
    RAISE NOTICE 'Created all tables with RLS and proper indexing.';
    RAISE NOTICE 'All tables have update_at triggers.';
    RAISE NOTICE 'Row Level Security (RLS) is enabled on all tables.';
    RAISE NOTICE '========================================';
END;
$$;
