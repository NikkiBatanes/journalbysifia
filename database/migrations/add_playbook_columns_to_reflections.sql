-- Migration: Add playbook-specific columns to reflection_entries table
-- Date: 2025-07-29
-- Purpose: Add dedicated columns for playbook metadata instead of using tags and devotional_title

-- Add playbook-specific columns to reflection_entries table
ALTER TABLE public.reflection_entries 
ADD COLUMN IF NOT EXISTS playbook_title TEXT,
ADD COLUMN IF NOT EXISTS playbook_id UUID,
ADD COLUMN IF NOT EXISTS subtask_id UUID;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reflection_entries_playbook_id ON public.reflection_entries(playbook_id);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_subtask_id ON public.reflection_entries(subtask_id);

-- Add comments for documentation
COMMENT ON COLUMN public.reflection_entries.playbook_title IS 'Title of the playbook this reflection belongs to';
COMMENT ON COLUMN public.reflection_entries.playbook_id IS 'UUID of the playbook this reflection belongs to';
COMMENT ON COLUMN public.reflection_entries.subtask_id IS 'UUID of the specific subtask this reflection is for';
