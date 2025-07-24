-- Migration: Add devotional metadata columns to reflection_entries table
-- This adds the missing columns needed for devotional reflection entries

-- Add missing columns to reflection_entries table
ALTER TABLE reflection_entries 
ADD COLUMN IF NOT EXISTS prompt TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array of tags
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS devotional_title TEXT,
ADD COLUMN IF NOT EXISTS day_number INTEGER,
ADD COLUMN IF NOT EXISTS day_title TEXT,
ADD COLUMN IF NOT EXISTS total_days INTEGER,
ADD COLUMN IF NOT EXISTS question_number INTEGER;

-- Add indexes for better query performance on devotional reflections
CREATE INDEX IF NOT EXISTS idx_reflection_entries_source ON reflection_entries(source);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_devotional_title ON reflection_entries(devotional_title);
CREATE INDEX IF NOT EXISTS idx_reflection_entries_day_number ON reflection_entries(day_number);

-- Add a comment to document the purpose of these columns
COMMENT ON COLUMN reflection_entries.source IS 'Source of the reflection entry (e.g., devotional)';
COMMENT ON COLUMN reflection_entries.devotional_title IS 'Title of the devotional this reflection belongs to';
COMMENT ON COLUMN reflection_entries.day_number IS 'Day number within the devotional';
COMMENT ON COLUMN reflection_entries.day_title IS 'Title of the specific day in the devotional';
COMMENT ON COLUMN reflection_entries.total_days IS 'Total number of days in the devotional';
COMMENT ON COLUMN reflection_entries.question_number IS 'Question number within the day (if applicable)';
