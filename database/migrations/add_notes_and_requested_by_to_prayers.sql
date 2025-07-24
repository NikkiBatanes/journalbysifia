-- Migration: Add missing columns to prayers table
-- Date: 2025-01-25
-- Description: Add notes and requested_by columns that are missing from the actual database

-- Add notes column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prayers' AND column_name = 'notes') THEN
        ALTER TABLE prayers ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Add requested_by column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prayers' AND column_name = 'requested_by') THEN
        ALTER TABLE prayers ADD COLUMN requested_by TEXT;
    END IF;
END $$;

-- Add comment to document the change
COMMENT ON COLUMN prayers.notes IS 'Additional notes for prayers';
COMMENT ON COLUMN prayers.requested_by IS 'Who requested this prayer (for prayer requests)';
