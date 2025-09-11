-- Smart Journaling System Migration
-- Phase 1: Database Foundation
-- Generated on: 2025-07-29

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add new columns to existing playbook tables
DO $$
BEGIN
    -- Add example_interactive column to playbook_action_steps
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'playbook_action_steps' AND column_name = 'example_interactive') THEN
        ALTER TABLE public.playbook_action_steps ADD COLUMN example_interactive BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add new columns for smart journaling to playbook_sub_tasks
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'playbook_sub_tasks' AND column_name = 'detected_journal_type') THEN
        ALTER TABLE public.playbook_sub_tasks ADD COLUMN detected_journal_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'playbook_sub_tasks' AND column_name = 'is_example') THEN
        ALTER TABLE public.playbook_sub_tasks ADD COLUMN is_example BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'playbook_sub_tasks' AND column_name = 'example_interactive') THEN
        ALTER TABLE public.playbook_sub_tasks ADD COLUMN example_interactive BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create smart_journal_entries table (different name to avoid conflict with existing journal_entries)
CREATE TABLE IF NOT EXISTS public.smart_journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sub_task_id UUID REFERENCES public.playbook_sub_tasks(id) ON DELETE CASCADE,
    journal_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL
);

-- Create smart_financial_entries table (database ready, components later)
CREATE TABLE IF NOT EXISTS public.smart_financial_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sub_task_id UUID REFERENCES public.playbook_sub_tasks(id) ON DELETE CASCADE,
    entry_type VARCHAR(50) NOT NULL, -- 'tithing', 'savings', 'expenses', 'investment'
    amount DECIMAL(10,2),
    description TEXT,
    category VARCHAR(100),
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL
);


-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_journal_entries_sub_task_id ON public.smart_journal_entries(sub_task_id);
CREATE INDEX IF NOT EXISTS idx_smart_journal_entries_user_id ON public.smart_journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_journal_entries_journal_type ON public.smart_journal_entries(journal_type);
CREATE INDEX IF NOT EXISTS idx_smart_journal_entries_created_at ON public.smart_journal_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smart_financial_entries_sub_task_id ON public.smart_financial_entries(sub_task_id);
CREATE INDEX IF NOT EXISTS idx_smart_financial_entries_user_id ON public.smart_financial_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_financial_entries_entry_type ON public.smart_financial_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_smart_financial_entries_date ON public.smart_financial_entries(date DESC);


CREATE INDEX IF NOT EXISTS idx_playbook_sub_tasks_detected_journal_type ON public.playbook_sub_tasks(detected_journal_type);
CREATE INDEX IF NOT EXISTS idx_playbook_action_steps_example_interactive ON public.playbook_action_steps(example_interactive);

-- Add updated_at trigger for journal_entries
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_smart_journal_entries_updated_at ON public.smart_journal_entries;
CREATE TRIGGER update_smart_journal_entries_updated_at
    BEFORE UPDATE ON public.smart_journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_smart_financial_entries_updated_at ON public.smart_financial_entries;
CREATE TRIGGER update_smart_financial_entries_updated_at
    BEFORE UPDATE ON public.smart_financial_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Note: Triggers for playbook_sub_tasks and playbook_action_steps should already exist
-- If not, add them manually

-- Create enum for journal types (for better type safety)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journal_type_enum') THEN
        CREATE TYPE journal_type_enum AS ENUM (
            'reflection',
            'gratitude', 
            'prayer',
            'timeblock',
            'focus',
            'win',
            'forward',
            'todos',
            'financial_tithing',
            'financial_savings',
            'financial_expenses',
            'financial_investment'
        );
    END IF;
END $$;

-- Update smart_journal_entries table to use enum (optional, for better type safety)
-- ALTER TABLE public.smart_journal_entries ALTER COLUMN journal_type TYPE journal_type_enum USING journal_type::journal_type_enum;

-- Add RLS policies for security
ALTER TABLE public.smart_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_financial_entries ENABLE ROW LEVEL SECURITY;

-- Journal entries policies
CREATE POLICY "Users can view their own smart journal entries" ON public.smart_journal_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own smart journal entries" ON public.smart_journal_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smart journal entries" ON public.smart_journal_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smart journal entries" ON public.smart_journal_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Financial entries policies
CREATE POLICY "Users can view their own smart financial entries" ON public.smart_financial_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own smart financial entries" ON public.smart_financial_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smart financial entries" ON public.smart_financial_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smart financial entries" ON public.smart_financial_entries
    FOR DELETE USING (auth.uid() = user_id);


-- Grant necessary permissions
GRANT ALL ON public.smart_journal_entries TO authenticated;
GRANT ALL ON public.smart_financial_entries TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.smart_journal_entries IS 'Stores all journal entries linked to action step subtasks';
COMMENT ON TABLE public.smart_financial_entries IS 'Stores financial stewardship entries (tithing, savings, expenses, investments)';
COMMENT ON COLUMN public.playbook_sub_tasks.detected_journal_type IS 'AI-detected journal type for smart suggestions';
COMMENT ON COLUMN public.playbook_sub_tasks.is_example IS 'Whether this subtask is an example';
COMMENT ON COLUMN public.playbook_sub_tasks.example_interactive IS 'Whether the example can be interacted with';
COMMENT ON COLUMN public.playbook_action_steps.example_interactive IS 'Whether the action step example can be interacted with';
