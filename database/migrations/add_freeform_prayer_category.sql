-- Migration: Add 'freeform' to prayers journal_category check constraint
-- Date: 2025-07-30
-- Description: Allows 'freeform' as a valid journal_category value for prayers table

-- First, let's check the current constraint
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'prayers_journal_category_check';

-- Drop the existing check constraint
ALTER TABLE prayers DROP CONSTRAINT IF EXISTS prayers_journal_category_check;

-- Add the new check constraint that includes 'freeform'
ALTER TABLE prayers ADD CONSTRAINT prayers_journal_category_check 
    CHECK (journal_category IN ('adoration', 'confession', 'thanksgiving', 'supplication', 'freeform'));

-- Verify the constraint was added correctly
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'prayers_journal_category_check';
