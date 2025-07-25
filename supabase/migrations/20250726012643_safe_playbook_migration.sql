-- Safe Migration: Create Playbook System Tables (Handles Existing Tables)
-- Created: 2025-07-26T01:26:43+08:00
-- Description: Safely creates normalized playbook system tables, handling existing structures

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (with CASCADE to handle dependencies)
-- This is safe because we're creating a new normalized structure
DROP TABLE IF EXISTS playbook_affirmations CASCADE;
DROP TABLE IF EXISTS playbook_sub_tasks CASCADE;
DROP TABLE IF EXISTS playbook_action_steps CASCADE;

-- Backup existing playbooks table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'playbooks' AND table_schema = 'public') THEN
        -- Create backup table
        EXECUTE 'CREATE TABLE playbooks_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS') || ' AS SELECT * FROM playbooks';
        RAISE NOTICE 'Existing playbooks table backed up';
        
        -- Drop the existing table
        DROP TABLE playbooks CASCADE;
        RAISE NOTICE 'Existing playbooks table dropped';
    END IF;
END $$;

-- Create playbooks table with new structure
CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    truth_in_love JSONB,
    bible_verse JSONB,
    direct_challenge JSONB,
    challenge_cta TEXT,
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'paused')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT playbooks_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
    CONSTRAINT playbooks_user_id_not_null CHECK (user_id IS NOT NULL)
);

-- Create playbook_action_steps table
CREATE TABLE playbook_action_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT action_steps_text_length CHECK (char_length(text) >= 1 AND char_length(text) <= 500),
    CONSTRAINT action_steps_order_index_positive CHECK (order_index >= 0),
    
    -- Unique constraint for order within playbook
    UNIQUE(playbook_id, order_index)
);

-- Create playbook_sub_tasks table
CREATE TABLE playbook_sub_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_step_id UUID NOT NULL REFERENCES playbook_action_steps(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT sub_tasks_text_length CHECK (char_length(text) >= 1 AND char_length(text) <= 300),
    CONSTRAINT sub_tasks_order_index_positive CHECK (order_index >= 0),
    
    -- Unique constraint for order within action step
    UNIQUE(action_step_id, order_index)
);

-- Create playbook_affirmations table
CREATE TABLE playbook_affirmations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT affirmations_text_length CHECK (char_length(text) >= 1 AND char_length(text) <= 300),
    CONSTRAINT affirmations_order_index_positive CHECK (order_index >= 0),
    
    -- Unique constraint for order within playbook
    UNIQUE(playbook_id, order_index)
);

-- Create indexes for performance
CREATE INDEX idx_playbooks_user_id ON playbooks(user_id);
CREATE INDEX idx_playbooks_status ON playbooks(status);
CREATE INDEX idx_playbooks_created_at ON playbooks(created_at DESC);
CREATE INDEX idx_playbooks_user_status ON playbooks(user_id, status);

CREATE INDEX idx_action_steps_playbook_id ON playbook_action_steps(playbook_id);
CREATE INDEX idx_action_steps_order ON playbook_action_steps(playbook_id, order_index);
CREATE INDEX idx_action_steps_completed ON playbook_action_steps(completed);

CREATE INDEX idx_sub_tasks_action_step_id ON playbook_sub_tasks(action_step_id);
CREATE INDEX idx_sub_tasks_order ON playbook_sub_tasks(action_step_id, order_index);
CREATE INDEX idx_sub_tasks_completed ON playbook_sub_tasks(completed);

CREATE INDEX idx_affirmations_playbook_id ON playbook_affirmations(playbook_id);
CREATE INDEX idx_affirmations_order ON playbook_affirmations(playbook_id, order_index);
CREATE INDEX idx_affirmations_completed ON playbook_affirmations(completed);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_playbooks_updated_at 
    BEFORE UPDATE ON playbooks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_steps_updated_at 
    BEFORE UPDATE ON playbook_action_steps 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_tasks_updated_at 
    BEFORE UPDATE ON playbook_sub_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affirmations_updated_at 
    BEFORE UPDATE ON playbook_affirmations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate playbook progress
CREATE OR REPLACE FUNCTION calculate_playbook_progress(playbook_uuid UUID)
RETURNS TABLE(
    completed_tasks INTEGER,
    total_tasks INTEGER,
    progress_percentage NUMERIC
) AS $$
DECLARE
    completed_count INTEGER := 0;
    total_count INTEGER := 0;
    step_record RECORD;
    subtask_count INTEGER;
    completed_subtask_count INTEGER;
BEGIN
    -- Count action steps and their sub-tasks
    FOR step_record IN 
        SELECT id, completed 
        FROM playbook_action_steps 
        WHERE playbook_id = playbook_uuid
    LOOP
        -- Check if this step has sub-tasks
        SELECT COUNT(*) INTO subtask_count
        FROM playbook_sub_tasks 
        WHERE action_step_id = step_record.id;
        
        IF subtask_count > 0 THEN
            -- Count sub-tasks for this step
            SELECT COUNT(*) INTO completed_subtask_count
            FROM playbook_sub_tasks 
            WHERE action_step_id = step_record.id AND completed = TRUE;
            
            completed_count := completed_count + completed_subtask_count;
            total_count := total_count + subtask_count;
        ELSE
            -- Count the step itself if no sub-tasks
            IF step_record.completed THEN
                completed_count := completed_count + 1;
            END IF;
            total_count := total_count + 1;
        END IF;
    END LOOP;
    
    -- Count affirmations
    SELECT 
        COUNT(*) FILTER (WHERE completed = TRUE),
        COUNT(*)
    INTO completed_subtask_count, subtask_count
    FROM playbook_affirmations 
    WHERE playbook_id = playbook_uuid;
    
    completed_count := completed_count + completed_subtask_count;
    total_count := total_count + subtask_count;
    
    -- Calculate percentage
    completed_tasks := completed_count;
    total_tasks := total_count;
    
    IF total_count > 0 THEN
        progress_percentage := ROUND((completed_count::NUMERIC / total_count::NUMERIC) * 100, 2);
    ELSE
        progress_percentage := 0;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function to update playbook status based on progress
CREATE OR REPLACE FUNCTION update_playbook_status()
RETURNS TRIGGER AS $$
DECLARE
    progress_data RECORD;
    target_playbook_id UUID;
BEGIN
    -- Get the playbook ID based on the table being updated
    IF TG_TABLE_NAME = 'playbook_action_steps' THEN
        target_playbook_id := NEW.playbook_id;
    ELSIF TG_TABLE_NAME = 'playbook_sub_tasks' THEN
        SELECT playbook_id INTO target_playbook_id 
        FROM playbook_action_steps 
        WHERE id = NEW.action_step_id;
    ELSIF TG_TABLE_NAME = 'playbook_affirmations' THEN
        target_playbook_id := NEW.playbook_id;
    END IF;
    
    -- Get progress for the playbook
    SELECT * INTO progress_data 
    FROM calculate_playbook_progress(target_playbook_id);
    
    -- Update playbook status if 100% complete
    IF progress_data.progress_percentage = 100 THEN
        UPDATE playbooks 
        SET status = 'completed', updated_at = NOW()
        WHERE id = target_playbook_id
        AND status != 'completed';
    ELSIF progress_data.progress_percentage < 100 THEN
        UPDATE playbooks 
        SET status = 'ongoing', updated_at = NOW()
        WHERE id = target_playbook_id
        AND status = 'completed';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic status updates
CREATE TRIGGER trigger_update_playbook_status_action_steps
    AFTER UPDATE OF completed ON playbook_action_steps
    FOR EACH ROW EXECUTE FUNCTION update_playbook_status();

CREATE TRIGGER trigger_update_playbook_status_sub_tasks
    AFTER UPDATE OF completed ON playbook_sub_tasks
    FOR EACH ROW EXECUTE FUNCTION update_playbook_status();

CREATE TRIGGER trigger_update_playbook_status_affirmations
    AFTER UPDATE OF completed ON playbook_affirmations
    FOR EACH ROW EXECUTE FUNCTION update_playbook_status();

-- Enable Row Level Security (RLS)
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_action_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_sub_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_affirmations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for playbooks
CREATE POLICY "Users can view their own playbooks" ON playbooks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own playbooks" ON playbooks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playbooks" ON playbooks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playbooks" ON playbooks
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for action steps
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

-- Create RLS policies for sub-tasks
CREATE POLICY "Users can view sub-tasks of their action steps" ON playbook_sub_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert sub-tasks to their action steps" ON playbook_sub_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update sub-tasks of their action steps" ON playbook_sub_tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete sub-tasks of their action steps" ON playbook_sub_tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM playbook_action_steps pas
            JOIN playbooks p ON p.id = pas.playbook_id
            WHERE pas.id = playbook_sub_tasks.action_step_id 
            AND p.user_id = auth.uid()
        )
    );

-- Create RLS policies for affirmations
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

-- Create view for playbooks with progress
CREATE OR REPLACE VIEW playbooks_with_progress AS
SELECT 
    p.*,
    COALESCE(prog.completed_tasks, 0) as completed_tasks,
    COALESCE(prog.total_tasks, 0) as total_tasks,
    COALESCE(prog.progress_percentage, 0) as progress_percentage
FROM playbooks p
LEFT JOIN LATERAL calculate_playbook_progress(p.id) prog ON true;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON playbooks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON playbook_action_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON playbook_sub_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON playbook_affirmations TO authenticated;
GRANT SELECT ON playbooks_with_progress TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create comments for documentation
COMMENT ON TABLE playbooks IS 'Main playbook table with user-specific spiritual guidance content';
COMMENT ON TABLE playbook_action_steps IS 'Action steps for playbooks, can have sub-tasks';
COMMENT ON TABLE playbook_sub_tasks IS 'Sub-tasks for action steps, providing granular task breakdown';
COMMENT ON TABLE playbook_affirmations IS 'Affirmations associated with playbooks for spiritual reinforcement';
COMMENT ON VIEW playbooks_with_progress IS 'Playbooks with calculated progress metrics';

-- Final success message
SELECT 'Safe playbook system migration completed successfully' as migration_status;
