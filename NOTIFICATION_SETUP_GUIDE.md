# Push Notification Setup Guide for siFia

## Overview
This guide covers the complete setup required for push notifications to work in TestFlight and production.

## Critical Issues Fixed

### 1. ✅ iOS Configuration Files Updated
- **Info.plist**: Added `UIBackgroundModes` with `remote-notification`
- **Entitlements**: Added `aps-environment` set to `production`
- **AppDelegate.swift**: Added full push notification handling

### 2. Backend Requirements (MUST BE CONFIGURED)

#### Supabase Edge Functions
The following edge functions must be deployed:
- `send-push-notification` - Sends push notifications via APNS/FCM
- `process-notification-queue` - Processes scheduled notifications
- `generate-personalized-notifications` - Creates contextual notifications

#### Required Supabase Secrets
Set these in your Supabase dashboard under Settings > Edge Functions > Secrets:

```bash
# For iOS (APNS)
APNS_JWT_TOKEN=<your-apns-jwt-token>
APNS_BUNDLE_ID=com.sifiaopc.app

# For Android (FCM)
FCM_SERVER_KEY=<your-fcm-server-key>

# Supabase
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Apple Developer Portal Setup

#### Step 1: Create APNS Key
1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click "+" to create a new key
3. Name it "siFia Push Notifications"
4. Check "Apple Push Notifications service (APNs)"
5. Click "Continue" and "Register"
6. **Download the .p8 file** (you can only download once!)
7. Note your Key ID and Team ID

#### Step 2: Generate JWT Token
You need to generate a JWT token from your APNS key. Use this script:

```javascript
// generate-apns-token.js
const jwt = require('jsonwebtoken');
const fs = require('fs');

const keyId = 'YOUR_KEY_ID'; // From Apple Developer Portal
const teamId = 'YOUR_TEAM_ID'; // From Apple Developer Portal
const privateKey = fs.readFileSync('./AuthKey_XXXXX.p8', 'utf8');

const token = jwt.sign(
  {
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  },
  privateKey,
  {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: keyId,
    },
  }
);

console.log('APNS JWT Token:', token);
```

Run with: `node generate-apns-token.js`

#### Step 3: Enable Push Notifications in Xcode
1. Open `ios/siFia.xcworkspace` in Xcode
2. Select the siFia target
3. Go to "Signing & Capabilities"
4. Click "+ Capability"
5. Add "Push Notifications"
6. Ensure the entitlements file is properly linked

### 4. Database Setup

#### Required Tables
Ensure these tables exist in Supabase:

```sql
-- Device tokens
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Notification queue
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type TEXT NOT NULL,
  prayer_reminders BOOLEAN DEFAULT true,
  playbook_steps BOOLEAN DEFAULT true,
  devotional_reminders BOOLEAN DEFAULT true,
  journal_prompts BOOLEAN DEFAULT true,
  milestone_celebrations BOOLEAN DEFAULT true,
  trial_notifications BOOLEAN DEFAULT true,
  streak_alerts BOOLEAN DEFAULT true,
  prayer_requests BOOLEAN DEFAULT false,
  prayer_request_alerts BOOLEAN DEFAULT false,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

-- Notification delivery log
CREATE TABLE notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  device_token_id UUID REFERENCES device_tokens(id),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed')),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Cron Jobs (Optional but Recommended)

Set up cron jobs in Supabase to automatically process notifications:

```sql
-- Process notification queue every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_ANON_KEY')
  );
  $$
);

-- Generate daily notifications every morning at 6 AM
SELECT cron.schedule(
  'generate-daily-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/generate-personalized-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_ANON_KEY', 'Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'daily_batch')
  );
  $$
);
```

## Testing Notifications

### Using the Debug Screen

1. Add the NotificationDebugScreen to your navigation:

```typescript
// In your navigator file
import NotificationDebugScreen from '../screens/NotificationDebugScreen';

// Add to stack
<Stack.Screen 
  name="NotificationDebug" 
  component={NotificationDebugScreen}
  options={{ title: 'Notification Debug' }}
/>
```

2. Navigate to the debug screen from your profile or settings
3. Check all the status indicators:
   - ✅ All should be green for notifications to work
   - Device token should be registered
   - Permissions should be granted
   - Database should have device tokens

### Manual Testing Steps

1. **Test Local Notifications** (No backend required):
   ```typescript
   await pushNotificationService.scheduleLocalNotification({
     title: 'Test',
     message: 'This is a test',
   });
   ```

2. **Test Permission Request**:
   ```typescript
   const granted = await pushNotificationService.requestPermissions();
   console.log('Permissions granted:', granted);
   ```

3. **Check Device Token**:
   ```typescript
   const token = await pushNotificationService.getStoredToken();
   console.log('Device token:', token);
   ```

4. **Force Reschedule**:
   ```typescript
   await DailyNotificationScheduler.forceReschedule(userId);
   ```

### TestFlight Specific Issues

1. **Ensure Production APNS**: TestFlight uses production APNS, not sandbox
2. **Check Entitlements**: Must have `aps-environment` set to `production`
3. **Verify Certificate**: APNS key must be valid and not expired
4. **Check Logs**: Use Xcode console to see push notification registration logs

## Troubleshooting

### No Device Token
**Symptoms**: Device token is null or not saving to database

**Solutions**:
1. Check that permissions are granted in iOS Settings
2. Verify AppDelegate is calling `registerForRemoteNotifications()`
3. Check Xcode console for registration errors
4. Ensure entitlements file is properly configured

### Notifications Not Received
**Symptoms**: Device token exists but no notifications arrive

**Solutions**:
1. Verify APNS_JWT_TOKEN is set in Supabase secrets
2. Check notification_queue table for pending notifications
3. Verify process-notification-queue edge function is running
4. Check notification_delivery_log for errors
5. Ensure quiet hours aren't blocking notifications
6. Verify notification preferences are enabled

### Notifications Work in Dev but Not TestFlight
**Symptoms**: Local notifications work, remote don't

**Solutions**:
1. Ensure `aps-environment` is set to `production` in entitlements
2. Verify APNS key is for production, not sandbox
3. Check that TestFlight build has push notification capability
4. Rebuild and re-upload to TestFlight after changes

### Database Errors
**Symptoms**: Tokens not saving, queue not processing

**Solutions**:
1. Verify all required tables exist
2. Check RLS policies allow inserts/updates
3. Ensure user_id foreign keys are valid
4. Check Supabase logs for SQL errors

## Next Steps

1. ✅ Rebuild the iOS app with the updated files
2. ✅ Upload new build to TestFlight
3. ⚠️ Configure APNS key and JWT token in Supabase
4. ⚠️ Deploy edge functions to Supabase
5. ⚠️ Set up cron jobs for automated processing
6. ✅ Test using the NotificationDebugScreen
7. ✅ Verify notifications arrive in TestFlight

## Support

If notifications still aren't working after following this guide:

1. Check the NotificationDebugScreen for specific issues
2. Review Supabase edge function logs
3. Check Apple Developer Portal for certificate issues
4. Verify all environment variables are set correctly
5. Test with a fresh install on a physical device

## Additional Resources

- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Native Push Notifications](https://github.com/zo0r/react-native-push-notification)
