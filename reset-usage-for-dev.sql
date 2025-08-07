-- Reset usage tracking for development testing
-- Run this in Supabase SQL Editor to reset your playbook usage

-- Option 1: Reset all usage tracking records
DELETE FROM usage_tracking WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- Option 2: Reset just playbook counts (if you want to keep other usage data)
UPDATE usage_tracking 
SET 
  playbooks_generated = 0,
  devotionals_generated = 0,
  journal_entries = 0,
  smart_journal_entries = 0,
  openai_tokens_used = 0,
  api_calls_made = 0,
  intelligence_queries = 0,
  export_count = 0,
  last_reset_date = CURRENT_DATE,
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- Replace 'your-email@example.com' with your actual email address
