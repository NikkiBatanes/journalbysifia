-- Comprehensive Database Schema Restoration Script
-- Run this in your Supabase SQL editor to restore all missing columns

-- ========================================
-- 1. Fix generation_queue table
-- ========================================
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

-- ========================================
-- 2. Fix playbooks table
-- ========================================
ALTER TABLE playbooks 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS truth_in_love TEXT,
ADD COLUMN IF NOT EXISTS action_steps JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS affirmations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS bible_verse JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS direct_challenge TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ========================================
-- 3. Verify the schema fixes
-- ========================================

-- Check generation_queue columns
SELECT 'generation_queue columns:' as table_info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'generation_queue' 
ORDER BY ordinal_position;

-- Check playbooks columns  
SELECT 'playbooks columns:' as table_info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'playbooks' 
ORDER BY ordinal_position;

-- ========================================
-- 4. Optional: Clean up any orphaned data
-- ========================================

-- Remove any queue items that might be stuck in processing
UPDATE generation_queue 
SET status = 'failed', 
    error_message = 'Reset due to schema restoration',
    updated_at = NOW()
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '1 hour';

-- ========================================
-- 5. Success message
-- ========================================
SELECT 'Database schema restoration completed successfully!' as status;
