-- Fix generation_queue table schema issues
-- Run this in Supabase SQL Editor

-- Check current generation_queue structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'generation_queue' 
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  -- Add additional_params if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'additional_params') THEN
    ALTER TABLE generation_queue ADD COLUMN additional_params JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Add cost_cents if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'cost_cents') THEN
    ALTER TABLE generation_queue ADD COLUMN cost_cents INTEGER DEFAULT 0;
  END IF;
  
  -- Add tokens_used if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'tokens_used') THEN
    ALTER TABLE generation_queue ADD COLUMN tokens_used INTEGER DEFAULT 0;
  END IF;
  
  -- Add intelligence_level if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'intelligence_level') THEN
    ALTER TABLE generation_queue ADD COLUMN intelligence_level TEXT DEFAULT 'basic';
  END IF;
  
  -- Add user_profile_data if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'user_profile_data') THEN
    ALTER TABLE generation_queue ADD COLUMN user_profile_data JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Add personalization_enabled if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'personalization_enabled') THEN
    ALTER TABLE generation_queue ADD COLUMN personalization_enabled BOOLEAN DEFAULT false;
  END IF;
  
  -- Add retry_count if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'retry_count') THEN
    ALTER TABLE generation_queue ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add max_retries if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'generation_queue' AND column_name = 'max_retries') THEN
    ALTER TABLE generation_queue ADD COLUMN max_retries INTEGER DEFAULT 3;
  END IF;
END $$;

-- Check the data type of user_id column first
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'generation_queue' AND column_name = 'user_id';

-- Temporarily disable RLS to avoid conflicts during policy creation
ALTER TABLE generation_queue DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own queue items" ON generation_queue;
DROP POLICY IF EXISTS "Users can view own queue items" ON generation_queue;
DROP POLICY IF EXISTS "Users can update own queue items" ON generation_queue;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON generation_queue;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON generation_queue;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON generation_queue;

-- Re-enable RLS
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;

-- Create simple policies - cast both sides to text for compatibility
CREATE POLICY "Users can insert own queue items" 
  ON generation_queue FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can view own queue items" 
  ON generation_queue FOR SELECT 
  TO authenticated 
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update own queue items" 
  ON generation_queue FOR UPDATE 
  TO authenticated 
  USING (user_id::text = auth.uid()::text);
