-- Migration: Add devotional tracking columns to reflection_entries table
-- Date: 2025-08-23
-- Purpose: Add columns to track devotional questions for journaling functionality

-- Add devotional tracking columns to reflection_entries table
ALTER TABLE public.reflection_entries 
ADD COLUMN IF NOT EXISTS devotional_id UUID,
ADD COLUMN IF NOT EXISTS devotional_title TEXT,
ADD COLUMN IF NOT EXISTS day_number INTEGER,
ADD COLUMN IF NOT EXISTS day_title TEXT,
ADD COLUMN IF NOT EXISTS total_days INTEGER,
ADD COLUMN IF NOT EXISTS question_number INTEGER,
ADD COLUMN IF NOT EXISTS question_text TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reflection_entries_devotional_id ON public.reflection_entries(devotional_id);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_day_number ON public.reflection_entries(day_number);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_question_number ON public.reflection_entries(question_number);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_devotional_question ON public.reflection_entries(devotional_id, day_number, question_number);

-- Add comments for documentation
COMMENT ON COLUMN public.reflection_entries.devotional_id IS 'UUID of the devotional this reflection belongs to';
COMMENT ON COLUMN public.reflection_entries.devotional_title IS 'Title of the devotional this reflection belongs to';
COMMENT ON COLUMN public.reflection_entries.day_number IS 'Day number within the devotional (1-based)';
COMMENT ON COLUMN public.reflection_entries.day_title IS 'Title of the specific day';
COMMENT ON COLUMN public.reflection_entries.total_days IS 'Total number of days in the devotional';
COMMENT ON COLUMN public.reflection_entries.question_number IS 'Question number within the day (1-based)';
COMMENT ON COLUMN public.reflection_entries.question_text IS 'The actual question text that was journaled';
