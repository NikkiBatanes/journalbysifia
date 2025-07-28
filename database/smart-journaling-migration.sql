-- Smart Journaling Migration
-- Phase 1: Add smart journaling columns to existing tables

-- Add smart journaling fields to playbook_sub_tasks table
ALTER TABLE playbook_sub_tasks 
ADD COLUMN IF NOT EXISTS detected_journal_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS is_example BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS example_interactive BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN playbook_sub_tasks.detected_journal_type IS 'AI-detected journal type: prayer, reflection, gratitude, timeblock, todos, win, focus, financial_budgeting, financial_tithing, financial_debt, none';
COMMENT ON COLUMN playbook_sub_tasks.is_example IS 'Whether this subtask is an example for user learning';
COMMENT ON COLUMN playbook_sub_tasks.example_interactive IS 'Whether this example subtask should be interactive';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_playbook_sub_tasks_journal_type 
ON playbook_sub_tasks(detected_journal_type);

-- Update existing records to have default values
UPDATE playbook_sub_tasks 
SET detected_journal_type = 'none'
WHERE detected_journal_type IS NULL;

UPDATE playbook_sub_tasks 
SET is_example = false
WHERE is_example IS NULL;

UPDATE playbook_sub_tasks 
SET example_interactive = false
WHERE example_interactive IS NULL;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'playbook_sub_tasks' 
    AND column_name IN ('detected_journal_type', 'is_example', 'example_interactive')
ORDER BY column_name;
