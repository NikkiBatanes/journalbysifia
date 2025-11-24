# 🔧 Notification Automation Setup Guide

## 🚨 Critical Issue Identified

Your notification system is **fully coded but not running** because the automation layer is missing.

**Problem:** No cron jobs = notifications sit in queue forever = no push notifications sent

---

## 📋 Step-by-Step Setup (15 minutes)

### Step 1: Enable pg_cron Extension in Supabase Dashboard

**Option A: Via Supabase Dashboard (RECOMMENDED)**

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Extensions**
3. Search for `pg_cron`
4. Click **Enable** next to pg_cron
5. Search for `pg_net` 
6. Click **Enable** next to pg_net

**Option B: Via SQL Editor**

If the dashboard method doesn't work, run this in SQL Editor:

```sql
-- Enable extensions (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
```

---

### Step 2: Get Your Credentials

You need two values:

**1. Supabase Project URL:**
```
https://YOUR_PROJECT_ID.supabase.co
```
Find in: Dashboard → Settings → API → Project URL

**2. Service Role Key (SECRET):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Find in: Dashboard → Settings → API → Project API keys → `service_role` (secret)

⚠️ **NEVER commit the service role key to git!**

---

### Step 3: Create Cron Jobs

Copy the SQL below, **replace the placeholders**, then run in Supabase SQL Editor:

```sql
-- =====================================================
-- REPLACE THESE VALUES:
-- =====================================================
-- YOUR_PROJECT_URL: https://xxxxx.supabase.co
-- YOUR_SERVICE_ROLE_KEY: eyJhbGci...
-- =====================================================

-- 1. Process notification queue every minute
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_URL.supabase.co/functions/v1/process-notification-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- 2. Generate daily notifications at 6 AM
SELECT cron.schedule(
  'generate-daily-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_URL.supabase.co/functions/v1/generate-personalized-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{"action": "daily_batch"}'::jsonb
  ) AS request_id;
  $$
);

-- 3. Check notification triggers every hour
SELECT cron.schedule(
  'check-notification-triggers',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_URL.supabase.co/functions/v1/generate-personalized-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{"action": "check_triggers"}'::jsonb
  ) AS request_id;
  $$
);
```

---

### Step 4: Verify Cron Jobs Are Running

Run this in SQL Editor:

```sql
-- View all scheduled jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
ORDER BY jobid;
```

**Expected Output:**
```
jobid | jobname                        | schedule    | active | command
------|--------------------------------|-------------|--------|----------
1     | process-notification-queue     | * * * * *   | true   | SELECT net.http_post...
2     | generate-daily-notifications   | 0 6 * * *   | true   | SELECT net.http_post...
3     | check-notification-triggers    | 0 * * * *   | true   | SELECT net.http_post...
```

---

### Step 5: Check Cron Job Execution History

```sql
-- View recent cron job runs
SELECT 
  jobid,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

**What to Look For:**
- `status` should be `succeeded`
- `return_message` should show HTTP response
- Jobs should run at scheduled times

---

### Step 6: Manual Test (Before Waiting for Cron)

Test immediately without waiting for cron schedule:

```sql
-- Manually trigger queue processing
SELECT net.http_post(
  url:='https://YOUR_PROJECT_URL.supabase.co/functions/v1/process-notification-queue',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
  body:='{}'::jsonb
) AS request_id;
```

Check the response:
```sql
-- View the HTTP request result
SELECT * FROM net._http_response ORDER BY id DESC LIMIT 1;
```

---

## 🧪 End-to-End Testing

### Test 1: Add Test Notification to Queue

```sql
-- Add a test notification
INSERT INTO notification_queue (
  user_id,
  type,
  title,
  message,
  data,
  scheduled_for,
  priority,
  status
) VALUES (
  'YOUR_USER_ID', -- Replace with your user ID
  'test',
  '🎉 Test Notification',
  'If you see this, the automation is working!',
  '{"test": true}'::jsonb,
  NOW(), -- Send immediately
  'high',
  'pending'
);
```

### Test 2: Wait 1 Minute

The `process-notification-queue` cron job runs every minute and should:
1. Pick up the pending notification
2. Call `send-push-notification` edge function
3. Send push to your device
4. Mark notification as `sent`

### Test 3: Verify Notification Was Sent

```sql
-- Check if notification was processed
SELECT 
  id,
  type,
  title,
  status,
  sent_at,
  attempts,
  error_message
FROM notification_queue
WHERE type = 'test'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- `status` = `'sent'`
- `sent_at` = recent timestamp
- `attempts` = 1
- `error_message` = null

### Test 4: Check Delivery Log

```sql
-- View delivery attempts
SELECT 
  ndl.*,
  dt.platform,
  dt.device_id
FROM notification_delivery_log ndl
JOIN device_tokens dt ON ndl.device_token_id = dt.id
ORDER BY ndl.created_at DESC
LIMIT 10;
```

**Expected:**
- `status` = `'delivered'`
- `error_code` = null

---

## 🔍 Troubleshooting

### Issue: "schema cron does not exist"

**Solution:** Enable pg_cron extension first (see Step 1)

---

### Issue: Cron jobs not running

**Check:**
```sql
-- Are jobs active?
SELECT jobname, active FROM cron.job;
```

**Fix:**
```sql
-- Reactivate a job
UPDATE cron.job SET active = true WHERE jobname = 'process-notification-queue';
```

---

### Issue: HTTP requests failing

**Check:**
```sql
-- View HTTP response details
SELECT 
  id,
  status_code,
  content,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
```

**Common Issues:**
- `status_code` = 401: Wrong service role key
- `status_code` = 404: Wrong URL
- `status_code` = 500: Edge function error

---

### Issue: Notifications in queue but not sending

**Check:**
```sql
-- How many pending notifications?
SELECT COUNT(*) FROM notification_queue WHERE status = 'pending';

-- Are they scheduled for the past?
SELECT * FROM notification_queue 
WHERE status = 'pending' 
AND scheduled_for <= NOW()
ORDER BY scheduled_for DESC;
```

**Fix:** Manually trigger processing:
```sql
SELECT net.http_post(
  url:='https://YOUR_PROJECT_URL.supabase.co/functions/v1/process-notification-queue',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
);
```

---

### Issue: No device tokens

**Check:**
```sql
-- Do you have device tokens?
SELECT 
  user_id,
  platform,
  device_id,
  is_active,
  created_at
FROM device_tokens
WHERE is_active = true;
```

**Fix:** 
1. Open app on physical device
2. Grant notification permissions
3. Check Xcode console for device token
4. Verify token saved to database

---

## 📊 Monitoring Queries

### Daily Notification Stats

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM notification_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Delivery Success Rate

```sql
SELECT 
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'delivered')::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) as success_rate_percent
FROM notification_delivery_log
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Active Users with Tokens

```sql
SELECT 
  platform,
  COUNT(DISTINCT user_id) as users,
  COUNT(*) as devices
FROM device_tokens
WHERE is_active = true
GROUP BY platform;
```

---

## 🎯 What This Fixes

After completing this setup:

| Feature | Before | After |
|---------|--------|-------|
| **Push Notifications** | ❌ Never sent | ✅ Sent every minute |
| **Daily Reminders** | ❌ Not generated | ✅ Generated at 6 AM |
| **Streak Alerts** | ❌ Not triggered | ✅ Checked hourly |
| **Queue Processing** | ❌ Manual only | ✅ Automatic |
| **Notification Delivery** | 0% | 90%+ |

---

## ⏱️ Timeline

- **Step 1-2:** 2 minutes (enable extensions, get credentials)
- **Step 3:** 3 minutes (create cron jobs)
- **Step 4-5:** 2 minutes (verify setup)
- **Step 6:** 5 minutes (manual testing)
- **End-to-End Test:** 5 minutes (wait for cron + verify)

**Total Time:** ~15-20 minutes

---

## ✅ Success Checklist

- [ ] pg_cron extension enabled
- [ ] pg_net extension enabled
- [ ] 3 cron jobs created
- [ ] Cron jobs showing as active
- [ ] Manual test notification sent successfully
- [ ] Test notification received on device
- [ ] Cron job execution history shows success
- [ ] Delivery log shows delivered status

---

## 🚀 Next Steps After Setup

1. **Test all notification types** (prayer, devotional, streak, etc.)
2. **Monitor delivery rates** for 24 hours
3. **Adjust cron schedules** if needed (e.g., change 6 AM to user's timezone)
4. **Set up alerts** for failed deliveries
5. **Scale up** if processing takes >1 minute

---

## 📞 Quick Reference

### Enable Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### View Cron Jobs
```sql
SELECT * FROM cron.job;
```

### View Execution History
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

### Remove Cron Job
```sql
SELECT cron.unschedule('job-name-here');
```

### Manual Trigger
```sql
SELECT net.http_post(
  url:='https://YOUR_PROJECT.supabase.co/functions/v1/process-notification-queue',
  headers:='{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
);
```

---

**Once this is set up, your notification system will be 100% operational! 🎉**
