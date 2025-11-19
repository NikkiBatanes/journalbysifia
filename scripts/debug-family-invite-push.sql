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
  sent_at,
  error_message,
  created_at,
  updated_at
FROM notification_queue
WHERE type = 'family_invitation'
  AND user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check user's device tokens
SELECT 
  id,
  user_id,
  token,
  platform,
  device_id,
  is_active,
  created_at,
  updated_at
FROM device_tokens
WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
  AND is_active = true;

-- 4. Check notification preferences
SELECT 
  user_id,
  notification_type,
  prayer_reminders,
  playbook_steps,
  devotional_reminders,
  journal_prompts,
  milestone_celebrations,
  trial_notifications,
  streak_alerts,
  quiet_hours_enabled,
  quiet_hours_start,
  quiet_hours_end,
  timezone,
  created_at
FROM notification_preferences
WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277';

-- 5. Check delivery logs for family invitations
SELECT 
  id,
  user_id,
  device_token_id,
  status,
  error_code,
  error_message,
  created_at
FROM notification_delivery_log
WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
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
