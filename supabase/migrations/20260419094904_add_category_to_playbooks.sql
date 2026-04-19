-- Add category column to playbooks table
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS category TEXT;

-- Add index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);
