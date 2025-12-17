# Notification System - Deployment Steps

## ✅ Prerequisites (Already Done)
- APNS credentials configured in Supabase ✓
- Notification code implemented ✓

---

## Step 1: Add Missing Environment Variable

Add this to Supabase Dashboard > Settings > Edge Functions > Secrets:

```
APNS_ENVIRONMENT=production
```

Or for testing:
```
APNS_ENVIRONMENT=sandbox
```

**Important**: Use `sandbox` if you're testing with a development build, `production` for TestFlight/App Store builds.

---

## Step 2: Deploy Edge Functions

Run these commands from your project root:

```bash
# Navigate to your project
cd /Users/nikkimaebatanes/CascadeProjects/siFia

# Deploy the notification scheduler
supabase functions deploy schedule-daily-notifications

# Deploy the notification queue processor
supabase functions deploy process-notification-queue

# Deploy the push notification sender
supabase functions deploy send-push-notification
```

---

## Step 3: Set Up Cron Jobs

Run this SQL in Supabase SQL Editor:

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Morning notifications (6:00 AM UTC = 2:00 PM Manila Time)
SELECT cron.schedule(
  'schedule-morning-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yjxcqfqfqfvjrqbvzjqr.supabase.co/functions/v1/schedule-daily-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Midday notifications (12:00 PM UTC = 8:00 PM Manila Time)
SELECT cron.schedule(
  'schedule-midday-notifications',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yjxcqfqfqfvjrqbvzjqr.supabase.co/functions/v1/schedule-daily-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Evening notifications (6:00 PM UTC = 2:00 AM Manila Time next day)
SELECT cron.schedule(
  'schedule-evening-notifications',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yjxcqfqfqfvjrqbvzjqr.supabase.co/functions/v1/schedule-daily-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Process notification queue every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yjxcqfqfqfvjrqbvzjqr.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Set the service role key (run this first)
ALTER DATABASE postgres SET app.settings.service_role_key TO 'YOUR_SERVICE_ROLE_KEY';
```

**Replace `YOUR_SERVICE_ROLE_KEY`** with your actual service role key from Supabase.

---

## Step 4: Test Notifications Immediately

### Option A: Add Test Button to App

Add this to any screen (e.g., Settings or Profile):

```typescript
import { NotificationTester } from '@/utils/notificationTester';
import { useAuth } from '@/context/IndustryStandardAuthContext';
import { Alert, Button } from 'react-native';

// In your component
const { user } = useAuth();

<Button 
  title="🔔 Test Notification"
  onPress={async () => {
    if (user?.id) {
      try {
        await NotificationTester.sendTestNotification(
          user.id, 
          user.user_metadata?.first_name || 'Friend'
        );
        Alert.alert('Success', 'Test notification sent! Check in 3 seconds.');
      } catch (error) {
        Alert.alert('Error', error.message);
      }
    }
  }}
/>

<Button 
  title="📊 Run Diagnostic"
  onPress={async () => {
    if (user?.id) {
      const results = await NotificationTester.runDiagnostic(
        user.id,
        user.user_metadata?.first_name || 'Friend'
      );
      console.log('Diagnostic Results:', results);
      Alert.alert('Diagnostic Complete', JSON.stringify(results, null, 2));
    }
  }}
/>

<Button 
  title="📅 Schedule All Notifications"
  onPress={async () => {
    if (user?.id) {
      await NotificationTester.forceScheduleAllNotifications(user.id);
      const queue = await NotificationTester.checkNotificationQueue(user.id);
      Alert.alert('Success', `Scheduled ${queue.length} notifications`);
    }
  }}
/>
```

### Option B: Test from Console

In your app, open the debug console and run:

```javascript
import { NotificationTester } from './src/utils/notificationTester';

// Get your user ID from auth context
const userId = 'your-user-id';

// Send test notification
await NotificationTester.sendTestNotification(userId, 'YourName');

// Run full diagnostic
const diagnostic = await NotificationTester.runDiagnostic(userId, 'YourName');
console.log(diagnostic);
```

---

## Step 5: Verify Notifications Are Working

### Check 1: Permissions
```typescript
const permissions = await NotificationTester.checkPermissions();
console.log('Permissions:', permissions);
// Should show: { alert: true, badge: true, sound: true }
```

### Check 2: Device Token
```typescript
const token = await NotificationTester.checkDeviceToken();
console.log('Device Token:', token);
// Should show a long string (your APNS device token)
```

### Check 3: Notification Queue
```typescript
const queue = await NotificationTester.checkNotificationQueue(userId);
console.log('Queue:', queue);
// Should show scheduled notifications
```

### Check 4: Delivery Stats
```typescript
const stats = await NotificationTester.getDeliveryStats(userId);
console.log('Stats:', stats);
// Should show: { total: X, pending: Y, sent: Z, failed: 0 }
```

---

## Step 6: Monitor & Debug

### Check Supabase Logs

1. Go to Supabase Dashboard > Edge Functions > Logs
2. Look for errors in:
   - `schedule-daily-notifications`
   - `process-notification-queue`
   - `send-push-notification`

### Check Database

```sql
-- Check notification queue
SELECT * FROM notification_queue 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY scheduled_for DESC 
LIMIT 20;

-- Check failed notifications
SELECT * FROM notification_queue 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Check delivery log
SELECT * FROM notification_delivery_log 
ORDER BY delivered_at DESC 
LIMIT 20;
```

---

## Troubleshooting

### "No notifications received"

1. **Check APNS_ENVIRONMENT**:
   - Use `sandbox` for development builds
   - Use `production` for TestFlight/App Store builds

2. **Check device token**:
   ```typescript
   const token = await NotificationTester.checkDeviceToken();
   ```
   - If null, permissions not granted or APNS not configured

3. **Check notification queue**:
   ```sql
   SELECT * FROM notification_queue WHERE user_id = 'YOUR_USER_ID';
   ```
   - If empty, notifications not being scheduled

4. **Force schedule**:
   ```typescript
   await NotificationTester.forceScheduleAllNotifications(userId);
   ```

### "Notifications scheduled but not delivered"

1. **Check APNS credentials** are correct
2. **Check APNS_ENVIRONMENT** matches your build type
3. **Check edge function logs** for errors
4. **Check notification_delivery_log** for error messages

### "Too many notifications"

Reduce the daily limit in `src/services/notificationSchedulerService.ts`:
```typescript
private readonly MAX_NOTIFICATIONS_PER_DAY = 10; // Reduce from 20
```

---

## Expected Behavior

Once everything is set up:

1. **App launch**: Notifications scheduled automatically every 6 hours
2. **Cron jobs**: Backend schedules notifications 3x daily (morning, midday, evening)
3. **Queue processor**: Delivers notifications every 5 minutes
4. **User receives**: 6-10 notifications per day based on activity

---

## Next Steps

1. ✅ Add `APNS_ENVIRONMENT` to Supabase
2. ✅ Deploy edge functions
3. ✅ Set up cron jobs
4. ✅ Test with NotificationTester
5. ✅ Monitor logs and adjust as needed

For detailed documentation, see:
- `docs/NOTIFICATION_SYSTEM_SETUP.md` - Full setup guide
- `docs/NOTIFICATION_QUICK_START.md` - Quick testing guide
