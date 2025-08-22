-- Run this SQL in your Supabase SQL Editor to add devotional tracking columns
-- Copy and paste this entire script into the Supabase dashboard SQL editor

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

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'reflection_entries' 
AND column_name IN ('devotional_id', 'devotional_title', 'day_number', 'day_title', 'total_days', 'question_number', 'question_text')
ORDER BY column_name;
