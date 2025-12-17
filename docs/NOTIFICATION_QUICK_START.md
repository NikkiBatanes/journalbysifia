# Notification System - Quick Start Guide

## Immediate Testing (Right Now)

### 1. Test Notification Delivery

Add this to any screen where you're logged in:

```typescript
import { NotificationTester } from '@/utils/notificationTester';
import { useAuth } from '@/context/IndustryStandardAuthContext';

// In your component
const { user } = useAuth();

// Add a test button
<Button onPress={async () => {
  if (user?.id) {
    await NotificationTester.sendTestNotification(user.id, user.user_metadata?.first_name || 'Friend');
    Alert.alert('Test notification sent! Check in 3 seconds.');
  }
}}>
  Test Notification
</Button>
```

### 2. Run Full Diagnostic

```typescript
<Button onPress={async () => {
  if (user?.id) {
    const results = await NotificationTester.runDiagnostic(user.id, user.user_metadata?.first_name || 'Friend');
    console.log('Diagnostic:', results);
    Alert.alert('Diagnostic Complete', JSON.stringify(results, null, 2));
  }
}}>
  Run Diagnostic
</Button>
```

### 3. Force Schedule All Notifications

```typescript
<Button onPress={async () => {
  if (user?.id) {
    await NotificationTester.forceScheduleAllNotifications(user.id);
    const queue = await NotificationTester.checkNotificationQueue(user.id);
    Alert.alert('Success', `Scheduled ${queue.length} notifications`);
  }
}}>
  Schedule All Notifications
</Button>
```

---

## What Changed

### ✅ Fixed Issues

1. **Daily Limit Increased**: 8 → 20 notifications per day
2. **Suppression Reduced**: Only low-priority notifications suppressed when app is active
3. **Multiple Daily Schedules**: Now schedules every 6 hours instead of once per day
4. **New Notification Types Added**:
   - Morning devotional (6:00 AM)
   - Daily scripture (6:05 AM)
   - Morning affirmation (9:00 AM)
   - Midday check-in (12:00 PM)
   - Evening reflection (6:00 PM)
   - Gratitude reminder (8:00 PM)

### 📋 New Files Created

1. **`src/services/enhancedNotificationScheduler.ts`** - Comprehensive scheduler with 5+ daily notifications
2. **`src/utils/notificationTester.ts`** - Testing utilities
3. **`supabase/functions/schedule-daily-notifications/index.ts`** - Backend cron job
4. **`docs/NOTIFICATION_SYSTEM_SETUP.md`** - Full setup guide
5. **`docs/NOTIFICATION_QUICK_START.md`** - This file

### 🔧 Modified Files

1. **`src/services/notificationSchedulerService.ts`**:
   - Increased `MAX_NOTIFICATIONS_PER_DAY` from 8 to 20
   - Reduced aggressive suppression
   - Added important notification types that bypass suppression

2. **`src/utils/dailyNotificationScheduler.ts`**:
   - Now uses `enhancedNotificationScheduler`
   - Allows scheduling every 6 hours instead of once per day

---

## Critical Setup Steps

### 1. Configure APNS (iOS) - **REQUIRED**

Without this, iOS notifications **will not work**.

```bash
# Set in Supabase Dashboard > Settings > Edge Functions > Secrets
APNS_JWT_TOKEN=<your-jwt-token>
APNS_BUNDLE_ID=com.sifiaopc.app
APNS_ENVIRONMENT=production
```

### 2. Configure FCM (Android) - **REQUIRED**

Without this, Android notifications **will not work**.

```bash
# Set in Supabase Dashboard > Settings > Edge Functions > Secrets
FCM_SERVER_KEY=<your-fcm-server-key>
```

### 3. Deploy Edge Functions

```bash
cd supabase
supabase functions deploy schedule-daily-notifications
supabase functions deploy process-notification-queue
supabase functions deploy send-push-notification
```

### 4. Set Up Cron Jobs

Run this SQL in Supabase SQL Editor:

```sql
-- Morning notifications (6:00 AM UTC)
SELECT cron.schedule(
  'schedule-morning-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/schedule-daily-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Midday notifications (12:00 PM UTC)
SELECT cron.schedule(
  'schedule-midday-notifications',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/schedule-daily-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Evening notifications (6:00 PM UTC)
SELECT cron.schedule(
  'schedule-evening-notifications',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/schedule-daily-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Process queue every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/process-notification-queue',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

## Notification Schedule

| Time (UTC) | Notification | Frequency |
|------------|--------------|-----------|
| 6:00 AM | Morning Devotional 🌅 | Daily |
| 6:05 AM | Daily Scripture 📖 | Daily |
| 8:00 AM | Prayer Reminder 🙏🏼 | If not prayed today |
| 9:00 AM | Morning Affirmation 💬 | Daily |
| 9:00 AM | Prayer Requests 🙏🏼 | If unanswered requests |
| 10:00 AM | Playbook Progress 🎯 | If incomplete playbooks |
| 12:00 PM | Midday Check-In | Daily |
| 6:00 PM | Evening Reflection ✨ | Daily |
| 7:00 PM | Journal Reminder ✍🏼 | If no entry in 3+ days |
| 8:00 PM | Gratitude Reminder 🌟 | Daily |

**Total: 6-10 notifications per day** (depending on user activity)

---

## Troubleshooting

### "I'm not receiving notifications"

1. **Check permissions**:
   ```typescript
   const permissions = await NotificationTester.checkPermissions();
   console.log(permissions);
   ```

2. **Check device token**:
   ```typescript
   const token = await NotificationTester.checkDeviceToken();
   console.log(token);
   ```

3. **Check queue**:
   ```typescript
   const queue = await NotificationTester.checkNotificationQueue(userId);
   console.log('Pending:', queue.length);
   ```

4. **Force schedule**:
   ```typescript
   await NotificationTester.forceScheduleAllNotifications(userId);
   ```

### "Notifications scheduled but not delivered"

- Check APNS/FCM credentials are set
- Check cron jobs are running
- Check notification queue status in database:
  ```sql
  SELECT * FROM notification_queue 
  WHERE user_id = 'YOUR_USER_ID' 
  AND status = 'failed';
  ```

### "Too many notifications"

Adjust the limit in `src/services/notificationSchedulerService.ts`:
```typescript
private readonly MAX_NOTIFICATIONS_PER_DAY = 15; // Reduce from 20
```

---

## Next Steps

1. ✅ Set APNS_JWT_TOKEN and FCM_SERVER_KEY in Supabase
2. ✅ Deploy edge functions
3. ✅ Set up cron jobs
4. ✅ Test with NotificationTester
5. ✅ Monitor logs and adjust as needed

For detailed setup instructions, see `NOTIFICATION_SYSTEM_SETUP.md`.
