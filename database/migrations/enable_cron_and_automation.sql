-- =====================================================
-- NOTIFICATION AUTOMATION SETUP
-- =====================================================
-- This migration enables cron jobs and sets up automated
-- notification processing for the siFia app
-- =====================================================

-- =====================================================
-- 1. Enable pg_cron extension
-- =====================================================
-- Note: This requires superuser privileges
-- Run this in Supabase SQL Editor with service role
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- =====================================================
-- 2. Enable pg_net extension for HTTP requests
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- 3. Create cron job to process notification queue
-- =====================================================
-- Runs every minute to send pending notifications
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url:='https://YOUR_SUPABASE_PROJECT_URL.supabase.co/functions/v1/process-notification-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- 4. Create cron job to generate daily notifications
-- =====================================================
-- Runs at 6:00 AM daily to generate personalized notifications
SELECT cron.schedule(
  'generate-daily-notifications',
  '0 6 * * *', -- 6 AM daily
  $$
  SELECT net.http_post(
    url:='https://YOUR_SUPABASE_PROJECT_URL.supabase.co/functions/v1/generate-personalized-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{"action": "daily_batch"}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- 5. Create cron job to check notification triggers
-- =====================================================
-- Runs every hour to check for streak alerts, challenges, etc.
SELECT cron.schedule(
  'check-notification-triggers',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url:='https://YOUR_SUPABASE_PROJECT_URL.supabase.co/functions/v1/generate-personalized-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{"action": "check_triggers"}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- 6. View scheduled cron jobs
-- =====================================================
-- Run this to verify your cron jobs are set up:
-- SELECT * FROM cron.job;

-- =====================================================
-- 7. View cron job execution history
-- =====================================================
-- Run this to see if cron jobs are running:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- 1. Replace YOUR_SUPABASE_PROJECT_URL with your actual project URL
-- 2. Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
--    (Find in Supabase Dashboard → Settings → API)
-- 3. pg_cron may require enabling in Supabase Dashboard first:
--    Dashboard → Database → Extensions → Enable pg_cron
-- 4. After running this, verify with: SELECT * FROM cron.job;

-- =====================================================
-- TO REMOVE CRON JOBS (if needed):
-- =====================================================
-- SELECT cron.unschedule('process-notification-queue');
-- SELECT cron.unschedule('generate-daily-notifications');
-- SELECT cron.unschedule('check-notification-triggers');

-- =====================================================
-- MANUAL TESTING:
-- =====================================================
-- To manually trigger notification processing:
-- SELECT net.http_post(
--   url:='https://YOUR_SUPABASE_PROJECT_URL.supabase.co/functions/v1/process-notification-queue',
--   headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
-- );
