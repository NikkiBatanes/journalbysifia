-- Add is_onboarding column to generation_queue table
-- This allows tracking which generations are from onboarding (free) vs regular usage

ALTER TABLE generation_queue 
ADD COLUMN IF NOT EXISTS is_onboarding BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN generation_queue.is_onboarding IS 'Whether this is an onboarding generation (free and does not count toward usage limits)';

-- Update existing records to be non-onboarding by default
UPDATE generation_queue 
SET is_onboarding = false 
WHERE is_onboarding IS NULL;
