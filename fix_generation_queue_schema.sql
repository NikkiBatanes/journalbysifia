-- Fix generation_queue table schema
-- Run this in your Supabase SQL editor to restore missing columns

-- Add missing columns to generation_queue table
ALTER TABLE generation_queue 
ADD COLUMN IF NOT EXISTS result_id UUID,
ADD COLUMN IF NOT EXISTS processing_time_seconds INTEGER,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_cents INTEGER DEFAULT 0;

-- Update any existing completed records to have default values
UPDATE generation_queue 
SET 
  tokens_used = COALESCE(tokens_used, 0),
  cost_cents = COALESCE(cost_cents, 0)
WHERE status = 'completed';

-- Verify the schema fix
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'generation_queue' 
ORDER BY ordinal_position;
