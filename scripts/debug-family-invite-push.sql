-- Debug script for family invitation push notifications
-- Run this to see what's happening with family invite notifications

-- 1. Check if notification was created in notifications table
SELECT 
  id,
  user_id,
  notification_type,
  title,
  message,
  is_read,
  created_at
FROM notifications
WHERE notification_type = 'family_invitation'
  AND user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if push notification was queued
SELECT 
  id,
  user_id,
  type,
  title,
  message,
  status,
  priority,
  scheduled_for,
  attempts,
  created_at,
  last_attempt_at,
  error_message
FROM notification_queue
WHERE type = 'family_invitation'
  AND user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check user's device tokens
SELECT 
  id,
  user_id,
  device_token,
  platform,
  is_active,
  created_at,
  last_used_at
FROM user_devices
WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
  AND is_active = true;

-- 4. Check notification preferences
SELECT 
  user_id,
  family_invitation_enabled,
  push_enabled,
  quiet_hours_enabled,
  quiet_hours_start,
  quiet_hours_end,
  timezone
FROM notification_preferences
WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277';

-- 5. Check delivery logs for family invitations
SELECT 
  id,
  notification_id,
  user_id,
  device_id,
  status,
  platform,
  created_at,
  delivered_at,
  error_message
FROM notification_delivery_log
WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
  AND notification_id IN (
    SELECT id FROM notification_queue 
    WHERE type = 'family_invitation' 
      AND user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
  )
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check if cron job is running
SELECT 
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname LIKE '%notification%';

-- 7. Check recent cron job runs
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE '%notification%'
)
ORDER BY start_time DESC
LIMIT 10;
