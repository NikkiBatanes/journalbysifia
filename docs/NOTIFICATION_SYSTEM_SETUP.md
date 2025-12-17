# Notification System Setup & Configuration

## Overview

The siFia notification system sends **multiple daily reminders** to keep users engaged with their spiritual journey. The system includes:

- **5+ daily notifications** (morning, midday, evening)
- **Context-aware reminders** (playbooks, prayers, streaks, gratitude)
- **Personalized content** (user's name, affirmations, scripture)
- **Smart delivery** (respects quiet hours, user preferences)

---

## Critical Setup Requirements

### 1. **Apple Push Notification Service (APNS) Configuration**

**Required for iOS notifications to work.**

#### Steps:

1. **Generate APNS Authentication Key** (from Apple Developer Portal):
   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
   - Create a new key with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` file (you can only download it once!)
   - Note the **Key ID** and **Team ID**

2. **Generate JWT Token**:
   ```bash
   # Use a JWT library to generate a token from your .p8 file
   # The token should be signed with ES256 algorithm
   # Include: iss (Team ID), iat (issued at timestamp)
   ```

3. **Set Environment Variables in Supabase**:
   ```bash
   APNS_JWT_TOKEN=<your-generated-jwt-token>
   APNS_BUNDLE_ID=com.sifiaopc.app
   APNS_ENVIRONMENT=production  # or 'sandbox' for testing
   APP_ENV=production  # or 'development'
   ```

### 2. **Firebase Cloud Messaging (FCM) Configuration**

**Required for Android notifications to work.**

#### Steps:

1. **Get FCM Server Key** (from Firebase Console):
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings > Cloud Messaging
   - Copy the **Server Key**

2. **Set Environment Variable in Supabase**:
   ```bash
   FCM_SERVER_KEY=<your-fcm-server-key>
   ```

### 3. **Database Tables**

Ensure these tables exist in your Supabase database:

```sql
-- Notification queue (stores scheduled notifications)
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device tokens (stores user device push tokens)
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  device_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Notification preferences (user settings)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'user_preferences',
  prayer_reminders BOOLEAN DEFAULT TRUE,
  prayer_request_alerts BOOLEAN DEFAULT TRUE,
  prayer_requests BOOLEAN DEFAULT TRUE,
  playbook_steps BOOLEAN DEFAULT TRUE,
  devotional_reminders BOOLEAN DEFAULT TRUE,
  journal_prompts BOOLEAN DEFAULT TRUE,
  streak_alerts BOOLEAN DEFAULT TRUE,
  milestone_celebrations BOOLEAN DEFAULT TRUE,
  trial_notifications BOOLEAN DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TEXT DEFAULT '22:00',
  quiet_hours_end TEXT DEFAULT '07:00',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

-- Notification delivery log (tracks delivery attempts)
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_id UUID REFERENCES device_tokens(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily scriptures (for scripture notifications)
CREATE TABLE IF NOT EXISTS daily_scriptures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (must have last_seen_at for active user detection)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
```

### 4. **Supabase Edge Functions Deployment**

Deploy the notification processing functions:

```bash
# Deploy notification queue processor
supabase functions deploy process-notification-queue

# Deploy push notification sender
supabase functions deploy send-push-notification

# Deploy daily notification scheduler
supabase functions deploy schedule-daily-notifications
```

### 5. **Cron Job Configuration**

Set up cron jobs in Supabase to run the scheduler automatically:

```sql
-- Run 3 times per day: morning, midday, evening
-- Morning batch: 6:00 AM UTC
SELECT cron.schedule(
  'schedule-morning-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/schedule-daily-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Midday batch: 12:00 PM UTC
SELECT cron.schedule(
  'schedule-midday-notifications',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/schedule-daily-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Evening batch: 6:00 PM UTC
SELECT cron.schedule(
  'schedule-evening-notifications',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/schedule-daily-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Process notification queue every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-notification-queue',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

## Testing Notifications

### Using the Notification Tester

```typescript
import { NotificationTester } from '@/utils/notificationTester';

// 1. Send a test notification immediately
await NotificationTester.sendTestNotification(userId, userName);

// 2. Check if notifications are configured correctly
const diagnostic = await NotificationTester.runDiagnostic(userId, userName);
console.log('Diagnostic results:', diagnostic);

// 3. Force schedule all notifications (bypass time checks)
await NotificationTester.forceScheduleAllNotifications(userId);

// 4. Check notification queue
const queue = await NotificationTester.checkNotificationQueue(userId);
console.log('Pending notifications:', queue);

// 5. Get delivery stats
const stats = await NotificationTester.getDeliveryStats(userId);
console.log('Delivery stats:', stats);

// 6. Check permissions
const permissions = await NotificationTester.checkPermissions();
console.log('Permissions:', permissions);

// 7. Check device token
const token = await NotificationTester.checkDeviceToken();
console.log('Device token:', token);
```

### Manual Testing Steps

1. **Test Permissions**:
   - Open the app
   - Go through onboarding to the notification setup screen
   - Grant notification permissions
   - Check that device token is saved

2. **Test Immediate Notification**:
   ```typescript
   await NotificationTester.sendTestNotification(userId, 'YourName');
   ```
   - You should receive a notification within 3 seconds

3. **Test Scheduled Notifications**:
   ```typescript
   await NotificationTester.forceScheduleAllNotifications(userId);
   const queue = await NotificationTester.checkNotificationQueue(userId);
   console.log('Scheduled:', queue.length, 'notifications');
   ```
   - Check the queue to see scheduled notifications

4. **Test Backend Processing**:
   - Manually trigger the cron job:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/schedule-daily-notifications \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```

---

## Notification Schedule

### Daily Fixed-Time Notifications

| Time (UTC) | Type | Title | Purpose |
|------------|------|-------|---------|
| 6:00 AM | Morning Devotional | "Good Morning, {Name}! 🌅" | Start day with God's Word |
| 6:05 AM | Daily Scripture | "Today's Scripture 📖" | Daily Bible verse |
| 9:00 AM | Morning Affirmation | "Speak Truth Over Your Life 💬" | Personalized affirmation |
| 12:00 PM | Midday Check-In | "{Name}, Take a Moment with God 🙏🏼" | Playbook/prayer reminder |
| 6:00 PM | Evening Reflection | "{Name}, Reflect on Your Day ✨" | Journal prompt |
| 8:00 PM | Gratitude Reminder | "{Name}, Count Your Blessings 🌟" | Gratitude journaling |

### Context-Based Notifications

These are scheduled based on user activity:

- **Prayer Reminders**: If user hasn't prayed today (8:00 AM)
- **Prayer Request Alerts**: If unanswered requests > 24 hours (9:00 AM)
- **Playbook Progress**: If incomplete playbooks > 48 hours (10:00 AM)
- **Journal Prompts**: If no journal entry in 3+ days (7:00 PM)
- **Streak Alerts**: If streak is at risk (varies)
- **Devotional Reflection**: If devotional completed but not reflected (6:00 PM)

---

## Troubleshooting

### "I'm not receiving any notifications"

1. **Check permissions**:
   ```typescript
   const permissions = await NotificationTester.checkPermissions();
   ```
   - Ensure `alert`, `badge`, and `sound` are all `true`

2. **Check device token**:
   ```typescript
   const token = await NotificationTester.checkDeviceToken();
   ```
   - If `null`, permissions may not be granted or APNS is not configured

3. **Check notification queue**:
   ```typescript
   const queue = await NotificationTester.checkNotificationQueue(userId);
   ```
   - If empty, notifications aren't being scheduled

4. **Check environment variables**:
   - Verify `APNS_JWT_TOKEN` and `FCM_SERVER_KEY` are set in Supabase

5. **Check cron jobs**:
   - Verify cron jobs are running in Supabase
   - Check logs for errors

### "Notifications are scheduled but not delivered"

1. **Check notification queue status**:
   ```sql
   SELECT * FROM notification_queue 
   WHERE user_id = 'YOUR_USER_ID' 
   ORDER BY scheduled_for DESC;
   ```
   - Look for `status = 'failed'` with error messages

2. **Check delivery log**:
   ```sql
   SELECT * FROM notification_delivery_log 
   WHERE user_id = 'YOUR_USER_ID' 
   ORDER BY delivered_at DESC;
   ```

3. **Verify APNS/FCM credentials**:
   - Test with a simple curl request to APNS/FCM
   - Check that JWT token is valid and not expired

### "Too many notifications"

1. **Adjust daily limit**:
   - Edit `MAX_NOTIFICATIONS_PER_DAY` in `notificationSchedulerService.ts`
   - Current limit: 20 per day

2. **Disable specific notification types**:
   ```sql
   UPDATE notification_preferences 
   SET devotional_reminders = FALSE 
   WHERE user_id = 'YOUR_USER_ID';
   ```

3. **Enable quiet hours**:
   ```sql
   UPDATE notification_preferences 
   SET quiet_hours_enabled = TRUE,
       quiet_hours_start = '22:00',
       quiet_hours_end = '07:00'
   WHERE user_id = 'YOUR_USER_ID';
   ```

---

## Configuration Options

### Adjusting Notification Times

Edit `enhancedNotificationScheduler.ts`:

```typescript
// Change morning devotional time
await this.scheduleMorningDevotional(userId, userName, '07:00'); // was 06:00

// Change midday check-in time
await this.scheduleMiddayCheckIn(userId, userName, '13:00'); // was 12:00
```

### Adjusting Daily Limits

Edit `notificationSchedulerService.ts`:

```typescript
private readonly MAX_NOTIFICATIONS_PER_DAY = 30; // was 20
```

### Adjusting Suppression Rules

Edit `notificationSchedulerService.ts`:

```typescript
// Add more important types that should never be suppressed
const importantTypes = [
  'prayer_request_reminder',
  'devotional_reminder',
  'your_new_type_here', // Add here
];
```

---

## Monitoring & Analytics

### Check Notification Performance

```sql
-- Delivery success rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'sent') * 100.0 / COUNT(*) as success_rate,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count
FROM notification_queue
WHERE created_at > NOW() - INTERVAL '7 days';

-- Most common notification types
SELECT type, COUNT(*) as count
FROM notification_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type
ORDER BY count DESC;

-- User engagement (notifications opened)
SELECT 
  user_id,
  COUNT(*) as notifications_received,
  COUNT(*) FILTER (WHERE data->>'opened' = 'true') as notifications_opened
FROM notification_queue
WHERE status = 'sent'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id;
```

---

## Next Steps

1. ✅ Set up APNS and FCM credentials
2. ✅ Deploy Supabase Edge Functions
3. ✅ Configure cron jobs
4. ✅ Test with `NotificationTester`
5. ✅ Monitor delivery logs
6. ✅ Adjust times/limits based on user feedback

---

## Support

For issues or questions, check:
- Supabase Edge Function logs
- Device console logs (React Native)
- Notification queue status in database
- APNS/FCM delivery logs
