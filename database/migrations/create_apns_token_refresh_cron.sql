-- Create cron job to refresh APNs JWT token every 50 minutes
-- Apple recommends tokens be < 60 minutes old

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists
SELECT cron.unschedule('refresh-apns-token') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-apns-token'
);

-- Create new cron job to run every 50 minutes
SELECT cron.schedule(
  'refresh-apns-token',
  '*/50 * * * *', -- Every 50 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/refresh-apns-token',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify the cron job was created
SELECT jobname, schedule, active, nodename 
FROM cron.job 
WHERE jobname = 'refresh-apns-token';
