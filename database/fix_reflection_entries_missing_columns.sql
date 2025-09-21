-- Migration: Add missing columns to reflection_entries table
-- Date: 2025-01-20
-- Purpose: Add devotional_id and question_text columns that are referenced in the code but missing from the database

-- Add missing columns to reflection_entries table
ALTER TABLE public.reflection_entries 
ADD COLUMN IF NOT EXISTS devotional_id UUID,
ADD COLUMN IF NOT EXISTS question_text TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reflection_entries_devotional_id ON public.reflection_entries(devotional_id);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_question_text ON public.reflection_entries USING gin(question_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_devotional_question ON public.reflection_entries(devotional_id, day_number, question_number);

-- Add comments for documentation
COMMENT ON COLUMN public.reflection_entries.devotional_id IS 'UUID of the devotional this reflection belongs to';
COMMENT ON COLUMN public.reflection_entries.question_text IS 'The actual question text that was journaled';

-- Add foreign key constraint for devotional_id (if devotionals table exists)
-- Note: Uncomment this if you have a devotionals table
-- ALTER TABLE public.reflection_entries 
-- ADD CONSTRAINT fk_reflection_entries_devotional_id 
-- FOREIGN KEY (devotional_id) REFERENCES public.devotionals(id) ON DELETE SET NULL;
