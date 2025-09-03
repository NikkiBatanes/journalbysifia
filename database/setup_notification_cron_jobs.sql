-- =====================================================
-- Supabase Cron Jobs for Notification System
-- =====================================================

-- Enable pg_cron extension (requires superuser privileges)
-- This should be run by a Supabase admin or through the dashboard
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- DAILY NOTIFICATION GENERATION JOBS
-- =====================================================

-- Generate prayer reminders every morning at 7:00 AM UTC
-- This will check for users who haven't prayed yet today
SELECT cron.schedule(
  'prayer-reminders-daily',
  '0 7 * * *',
  $$
  SELECT check_prayer_reminders();
  $$
);

-- Generate devotional reminders every morning at 6:30 AM UTC
-- This ensures devotionals are ready before prayer reminders
SELECT cron.schedule(
  'devotional-reminders-daily',
  '30 6 * * *',
  $$
  SELECT check_devotional_reminders();
  $$
);

-- Generate playbook step reminders every evening at 6:00 PM UTC
-- This reminds users about incomplete action steps
SELECT cron.schedule(
  'playbook-step-reminders-daily',
  '0 18 * * *',
  $$
  SELECT check_playbook_step_reminders();
  $$
);

-- Generate journal prompts every evening at 7:00 PM UTC
-- This encourages reflection at the end of the day
SELECT cron.schedule(
  'journal-prompts-daily',
  '0 19 * * *',
  $$
  INSERT INTO notification_queue (user_id, type, title, message, data, scheduled_for, priority)
  SELECT 
    u.id,
    'journal_prompt',
    'Reflection Time ✍️',
    CASE 
      WHEN u.first_name IS NOT NULL 
      THEN 'Evening reflection, ' || u.first_name || ': How did God show up in your day today?'
      ELSE 'Evening reflection: How did God show up in your day today?'
    END,
    json_build_object(
      'prompt_preview', 'How did God show up in your day today?',
      'prompt_type', 'daily_reflection'
    ),
    NOW() + INTERVAL '1 hour',
    'normal'
  FROM auth.users u
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  WHERE 
    (np.journal_prompts IS NULL OR np.journal_prompts = true)
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq 
      WHERE nq.user_id = u.id 
      AND nq.type = 'journal_prompt' 
      AND nq.scheduled_for::date = CURRENT_DATE
      AND nq.status = 'pending'
    );
  $$
);

-- =====================================================
-- HOURLY NOTIFICATION PROCESSING
-- =====================================================

-- Process notification queue every 15 minutes
-- This ensures timely delivery of scheduled notifications
SELECT cron.schedule(
  'process-notification-queue',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-notification-queue',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- SMART TRIGGER CHECKS
-- =====================================================

-- Check for streak alerts every 2 hours during active hours (8 AM - 10 PM UTC)
-- This catches users at risk of breaking their streaks
SELECT cron.schedule(
  'streak-alerts-check',
  '0 8-22/2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/generate-personalized-notifications',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{"action": "check_triggers"}'::jsonb
  );
  $$
);

-- =====================================================
-- WEEKLY SUMMARY AND CLEANUP
-- =====================================================

-- Generate weekly progress summaries every Sunday at 8:00 AM UTC
SELECT cron.schedule(
  'weekly-progress-summary',
  '0 8 * * 0',
  $$
  INSERT INTO notification_queue (user_id, type, title, message, data, scheduled_for, priority)
  SELECT 
    u.id,
    'weekly_summary',
    'Your Week with God 📊',
    CASE 
      WHEN u.first_name IS NOT NULL 
      THEN u.first_name || ', here''s your beautiful week of spiritual growth!'
      ELSE 'Here''s your beautiful week of spiritual growth!'
    END,
    json_build_object(
      'week_start', (CURRENT_DATE - INTERVAL '7 days')::text,
      'week_end', CURRENT_DATE::text
    ),
    NOW() + INTERVAL '2 hours',
    'normal'
  FROM auth.users u
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  WHERE 
    (np.milestone_celebrations IS NULL OR np.milestone_celebrations = true);
  $$
);

-- Clean up old notifications every Sunday at midnight
-- Remove notifications older than 30 days to keep the table clean
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 0 * * 0',
  $$
  DELETE FROM notification_queue 
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('sent', 'failed', 'cancelled');
  
  DELETE FROM notification_delivery_log 
  WHERE delivered_at < NOW() - INTERVAL '90 days';
  $$
);

-- =====================================================
-- TRIAL AND SUBSCRIPTION REMINDERS
-- =====================================================

-- Check for trial expiry warnings daily at 10:00 AM UTC
SELECT cron.schedule(
  'trial-expiry-warnings',
  '0 10 * * *',
  $$
  INSERT INTO notification_queue (user_id, type, title, message, data, scheduled_for, priority)
  SELECT 
    u.id,
    'trial_notification',
    'Trial Ending Soon ⏰',
    CASE 
      WHEN EXTRACT(days FROM (us.trial_end_date - CURRENT_DATE)) = 1
      THEN CASE 
        WHEN u.first_name IS NOT NULL 
        THEN u.first_name || ', your free trial ends tomorrow! Don''t lose access to your spiritual growth journey.'
        ELSE 'Your free trial ends tomorrow! Don''t lose access to your spiritual growth journey.'
      END
      WHEN EXTRACT(days FROM (us.trial_end_date - CURRENT_DATE)) = 2
      THEN CASE 
        WHEN u.first_name IS NOT NULL 
        THEN u.first_name || ', 2 days left in your free trial. Continue your faith journey with siFia!'
        ELSE '2 days left in your free trial. Continue your faith journey with siFia!'
      END
      ELSE CASE 
        WHEN u.first_name IS NOT NULL 
        THEN u.first_name || ', 3 days left in your free trial. Secure your spiritual growth tools!'
        ELSE '3 days left in your free trial. Secure your spiritual growth tools!'
      END
    END,
    json_build_object(
      'days_remaining', EXTRACT(days FROM (us.trial_end_date - CURRENT_DATE)),
      'trial_end_date', us.trial_end_date,
      'subscription_tier', us.tier
    ),
    NOW() + INTERVAL '30 minutes',
    'critical'
  FROM auth.users u
  JOIN user_subscriptions us ON u.id = us.user_id
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  WHERE 
    us.tier = 'free_trial'
    AND us.trial_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
    AND (np.trial_notifications IS NULL OR np.trial_notifications = true)
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq 
      WHERE nq.user_id = u.id 
      AND nq.type = 'trial_notification' 
      AND nq.scheduled_for::date = CURRENT_DATE
      AND nq.status IN ('pending', 'sent')
    );
  $$
);

-- =====================================================
-- VIEW CURRENT CRON JOBS
-- =====================================================

-- Query to view all scheduled cron jobs
-- SELECT * FROM cron.job ORDER BY schedule;

-- Query to view cron job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
