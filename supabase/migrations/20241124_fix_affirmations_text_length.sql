-- Fix affirmations text length constraint
-- Increase the maximum length for affirmation text to accommodate longer affirmations

-- First, drop the existing check constraint if it exists
ALTER TABLE playbook_affirmations DROP CONSTRAINT IF EXISTS affirmations_text_length;

-- Add a new check constraint with a higher limit (1000 characters)
-- This should be sufficient for most affirmation texts while preventing abuse
ALTER TABLE playbook_affirmations 
ADD CONSTRAINT affirmations_text_length 
CHECK (length(text) <= 1000);

-- Add comment to document the change
COMMENT ON CONSTRAINT affirmations_text_length ON playbook_affirmations IS 'Ensures affirmation text does not exceed 1000 characters (increased from previous limit)';
