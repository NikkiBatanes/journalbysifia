-- ========================================
-- PLAYBOOK SYSTEM DATABASE SCHEMA
-- Industry Standard Data Management
-- ========================================
-- Run this script in Supabase SQL Editor to create playbook tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. PLAYBOOKS TABLE (MAIN)
-- ========================================
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    user_input TEXT NOT NULL,
    
    -- Truth in Love section
    truth_in_love_text TEXT NOT NULL,
    truth_in_love_summary TEXT NOT NULL,
    
    -- Bible verse
    bible_verse_text TEXT NOT NULL,
    bible_verse_reference TEXT NOT NULL,
    
    -- Direct challenge (can be string or structured)
    direct_challenge TEXT,
    challenge_cta TEXT,
    
    -- Progress tracking
    progress DECIMAL(3,2) DEFAULT 0.00 CHECK (progress >= 0 AND progress <= 1),
    total_tasks INTEGER DEFAULT 0,
    status TEXT DEFAULT 'inProgress' CHECK (status IN ('inProgress', 'completed')),
    
    -- Profile and metadata
    profile_image TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Playbooks indexes
CREATE INDEX IF NOT EXISTS idx_playbooks_user_id ON playbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON playbooks(status);
CREATE INDEX IF NOT EXISTS idx_playbooks_created_at ON playbooks(created_at);
CREATE INDEX IF NOT EXISTS idx_playbooks_user_status ON playbooks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_playbooks_progress ON playbooks(progress);

-- Playbooks RLS
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own playbooks" ON playbooks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own playbooks" ON playbooks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playbooks" ON playbooks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playbooks" ON playbooks
    FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- 2. PLAYBOOK ACTION STEPS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_action_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    step_order INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Action steps indexes
CREATE INDEX IF NOT EXISTS idx_action_steps_playbook_id ON playbook_action_steps(playbook_id);
CREATE INDEX IF NOT EXISTS idx_action_steps_step_order ON playbook_action_steps(step_order);
CREATE INDEX IF NOT EXISTS idx_action_steps_completed ON playbook_action_steps(completed);
CREATE INDEX IF NOT EXISTS idx_action_steps_playbook_order ON playbook_action_steps(playbook_id, step_order);

-- Action steps RLS
ALTER TABLE playbook_action_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view action steps of their playbooks" ON playbook_action_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_action_steps.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert action steps to their playbooks" ON playbook_action_steps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_action_steps.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update action steps of their playbooks" ON playbook_action_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_action_steps.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete action steps of their playbooks" ON playbook_action_steps
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_action_steps.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

-- ========================================
-- 3. PLAYBOOK SUB TASKS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_sub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_step_id UUID NOT NULL REFERENCES playbook_action_steps(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    task_order INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Sub tasks indexes
CREATE INDEX IF NOT EXISTS idx_sub_tasks_action_step_id ON playbook_sub_tasks(action_step_id);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_task_order ON playbook_sub_tasks(task_order);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_completed ON playbook_sub_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_step_order ON playbook_sub_tasks(action_step_id, task_order);

-- Sub tasks RLS
ALTER TABLE playbook_sub_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sub tasks of their action steps" ON playbook_sub_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert sub tasks to their action steps" ON playbook_sub_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update sub tasks of their action steps" ON playbook_sub_tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete sub tasks of their action steps" ON playbook_sub_tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

-- ========================================
-- 4. PLAYBOOK AFFIRMATIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS playbook_affirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    affirmation_order INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Affirmations indexes
CREATE INDEX IF NOT EXISTS idx_affirmations_playbook_id ON playbook_affirmations(playbook_id);
CREATE INDEX IF NOT EXISTS idx_affirmations_order ON playbook_affirmations(affirmation_order);
CREATE INDEX IF NOT EXISTS idx_affirmations_completed ON playbook_affirmations(completed);
CREATE INDEX IF NOT EXISTS idx_affirmations_playbook_order ON playbook_affirmations(playbook_id, affirmation_order);

-- Affirmations RLS
ALTER TABLE playbook_affirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view affirmations of their playbooks" ON playbook_affirmations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_affirmations.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert affirmations to their playbooks" ON playbook_affirmations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_affirmations.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update affirmations of their playbooks" ON playbook_affirmations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_affirmations.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete affirmations of their playbooks" ON playbook_affirmations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM playbooks 
            WHERE playbooks.id = playbook_affirmations.playbook_id 
            AND playbooks.user_id = auth.uid()
        )
    );

-- ========================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ========================================

-- Generic function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Playbooks trigger
CREATE TRIGGER trigger_update_playbooks_updated_at
    BEFORE UPDATE ON playbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Action steps trigger
CREATE TRIGGER trigger_update_action_steps_updated_at
    BEFORE UPDATE ON playbook_action_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sub tasks trigger
CREATE TRIGGER trigger_update_sub_tasks_updated_at
    BEFORE UPDATE ON playbook_sub_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Affirmations trigger
CREATE TRIGGER trigger_update_affirmations_updated_at
    BEFORE UPDATE ON playbook_affirmations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- FUNCTIONS FOR PLAYBOOK PROGRESS CALCULATION
-- ========================================

-- Function to update playbook progress when action steps change
CREATE OR REPLACE FUNCTION update_playbook_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_steps INTEGER;
    completed_steps INTEGER;
    total_subtasks INTEGER;
    completed_subtasks INTEGER;
    new_progress DECIMAL(3,2);
    new_status TEXT;
    playbook_id_var UUID;
BEGIN
    -- Get playbook_id from the trigger context
    IF TG_TABLE_NAME = 'playbook_action_steps' THEN
        playbook_id_var := COALESCE(NEW.playbook_id, OLD.playbook_id);
    ELSIF TG_TABLE_NAME = 'playbook_sub_tasks' THEN
        SELECT pas.playbook_id INTO playbook_id_var
        FROM playbook_action_steps pas
        WHERE pas.id = COALESCE(NEW.action_step_id, OLD.action_step_id);
    END IF;

    -- Count total and completed action steps
    SELECT COUNT(*), COUNT(*) FILTER (WHERE completed = TRUE)
    INTO total_steps, completed_steps
    FROM playbook_action_steps
    WHERE playbook_id = playbook_id_var;

    -- Count total and completed subtasks
    SELECT COUNT(*), COUNT(*) FILTER (WHERE pst.completed = TRUE)
    INTO total_subtasks, completed_subtasks
    FROM playbook_sub_tasks pst
    JOIN playbook_action_steps pas ON pas.id = pst.action_step_id
    WHERE pas.playbook_id = playbook_id_var;

    -- Calculate progress (steps + subtasks)
    IF (total_steps + total_subtasks) > 0 THEN
        new_progress := (completed_steps + completed_subtasks)::DECIMAL / (total_steps + total_subtasks)::DECIMAL;
    ELSE
        new_progress := 0;
    END IF;

    -- Determine status
    IF new_progress >= 1.0 THEN
        new_status := 'completed';
    ELSE
        new_status := 'inProgress';
    END IF;

    -- Update playbook
    UPDATE playbooks
    SET 
        progress = new_progress,
        total_tasks = total_steps + total_subtasks,
        status = new_status,
        completed_at = CASE WHEN new_status = 'completed' AND status != 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = playbook_id_var;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic progress updates
CREATE TRIGGER trigger_update_playbook_progress_on_action_step_change
    AFTER INSERT OR UPDATE OR DELETE ON playbook_action_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_playbook_progress();

CREATE TRIGGER trigger_update_playbook_progress_on_sub_task_change
    AFTER INSERT OR UPDATE OR DELETE ON playbook_sub_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_playbook_progress();

-- ========================================
-- VIEWS FOR EASY DATA ACCESS
-- ========================================

-- View for complete playbook data with progress
CREATE OR REPLACE VIEW playbooks_with_details AS
SELECT 
    p.*,
    COUNT(pas.id) as total_action_steps,
    COUNT(pas.id) FILTER (WHERE pas.completed = TRUE) as completed_action_steps,
    COUNT(pst.id) as total_sub_tasks,
    COUNT(pst.id) FILTER (WHERE pst.completed = TRUE) as completed_sub_tasks,
    COUNT(pa.id) as total_affirmations,
    COUNT(pa.id) FILTER (WHERE pa.completed = TRUE) as completed_affirmations
FROM playbooks p
LEFT JOIN playbook_action_steps pas ON pas.playbook_id = p.id
LEFT JOIN playbook_sub_tasks pst ON pst.action_step_id = pas.id
LEFT JOIN playbook_affirmations pa ON pa.playbook_id = p.id
GROUP BY p.id;

-- ========================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ========================================

-- Uncomment the following lines to insert sample data for testing

/*
-- Sample playbook
INSERT INTO playbooks (user_id, title, user_input, truth_in_love_text, truth_in_love_summary, bible_verse_text, bible_verse_reference, direct_challenge)
VALUES (
    auth.uid(),
    'Overcoming Anxiety',
    'I struggle with anxiety and worry constantly',
    'God has not given you a spirit of fear, but of power, love, and sound mind.',
    'You are equipped with divine strength to overcome anxiety.',
    'For God has not given us a spirit of fear, but of power, of love and of sound mind.',
    '2 Timothy 1:7',
    'Challenge yourself to replace one anxious thought with a truth from God''s word each day.'
);

-- Sample action steps (you would need to replace the playbook_id with actual UUID)
-- INSERT INTO playbook_action_steps (playbook_id, title, description, step_order)
-- VALUES 
--     ('your-playbook-uuid', 'Daily Scripture Reading', 'Read one verse about God''s peace each morning', 1),
--     ('your-playbook-uuid', 'Prayer Time', 'Spend 10 minutes in prayer when anxiety arises', 2);
*/

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PLAYBOOK SYSTEM SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '- playbooks (with RLS and indexes)';
    RAISE NOTICE '- playbook_action_steps (with RLS and indexes)';
    RAISE NOTICE '- playbook_sub_tasks (with RLS and indexes)';
    RAISE NOTICE '- playbook_affirmations (with RLS and indexes)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created triggers for:';
    RAISE NOTICE '- Automatic updated_at timestamps';
    RAISE NOTICE '- Automatic playbook progress calculation';
    RAISE NOTICE '';
    RAISE NOTICE 'Created views:';
    RAISE NOTICE '- playbooks_with_details (complete playbook data)';
    RAISE NOTICE '';
    RAISE NOTICE 'All tables have Row Level Security (RLS) enabled';
    RAISE NOTICE 'All tables have proper indexes for performance';
    RAISE NOTICE 'Ready for production use!';
    RAISE NOTICE '========================================';
END $$;
