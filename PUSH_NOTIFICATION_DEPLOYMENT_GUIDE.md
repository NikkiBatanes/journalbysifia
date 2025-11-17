# 🚀 Push Notification Deployment Guide - Enterprise Grade

## ✅ Phase 1-4: COMPLETED
- ✅ iOS Native Bridge Module Created
- ✅ React Native Service Updated
- ✅ Event Listeners Configured
- ✅ TypeScript Interfaces Added

---

## 📋 Phase 5: Supabase Backend Configuration

### Step 1: Deploy Edge Functions

Your edge functions already exist. Deploy them to Supabase:

```bash
cd /Users/nikkimaebatanes/CascadeProjects/siFia

# Deploy all notification-related functions
supabase functions deploy send-push-notification
supabase functions deploy process-notification-queue
supabase functions deploy generate-personalized-notifications
```

### Step 2: Run Database Migrations

Execute the SQL migration in Supabase SQL Editor:

1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of `database/migrations/notification_system_tables.sql`
3. Run the migration
4. Verify tables were created:
   - `device_tokens`
   - `notification_queue`
   - `notification_preferences`
   - `notification_delivery_log`
   - `notification_analytics`
   - `user_streaks`

---

## 📋 Phase 6: Configure APNS Authentication

### Step 1: Generate APNS Key (Apple Developer Portal)

1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click "+" to create a new key
3. Name: "siFia Push Notifications"
4. Enable: "Apple Push Notifications service (APNs)"
5. Click "Continue" → "Register"
6. **DOWNLOAD THE .p8 FILE** (you can only download once!)
7. Note your:
   - **Key ID** (e.g., `ABC123DEFG`)
   - **Team ID** (found in Membership section)

### Step 2: Generate JWT Token from APNS Key

Create a Node.js script to generate the JWT token:

```bash
# Install jsonwebtoken if not already installed
npm install jsonwebtoken
```

Create `scripts/generate-apns-token.js`:

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Replace with your actual values
const keyId = 'YOUR_KEY_ID';           // From Apple Developer Portal
const teamId = 'YOUR_TEAM_ID';         // From Apple Developer Portal
const privateKeyPath = './AuthKey_XXXXX.p8';  // Path to your .p8 file

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

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

console.log('='.repeat(60));
console.log('APNS JWT TOKEN (Copy this to Supabase):');
console.log('='.repeat(60));
console.log(token);
console.log('='.repeat(60));
```

Run the script:

```bash
node scripts/generate-apns-token.js
```

### Step 3: Configure Supabase Secrets

Go to Supabase Dashboard → Settings → Edge Functions → Secrets

Add the following secrets:

```bash
# iOS (APNS)
APNS_JWT_TOKEN=<paste-the-jwt-token-from-step-2>
APNS_BUNDLE_ID=com.sifiaopc.app

# Android (FCM) - if you have Android
FCM_SERVER_KEY=<your-fcm-server-key>

# Supabase (should already be set)
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 📋 Phase 7: iOS Project Configuration

### Step 1: Add Files to Xcode

1. Open `ios/siFia.xcworkspace` in Xcode
2. Right-click on the `siFia` folder → "Add Files to siFia"
3. Add these files:
   - `RCTPushNotificationBridge.swift`
   - `RCTPushNotificationBridge.m`
4. Ensure "Copy items if needed" is checked
5. Ensure "siFia" target is selected

### Step 2: Verify Capabilities

1. Select the siFia target
2. Go to "Signing & Capabilities"
3. Verify these capabilities exist:
   - ✅ Push Notifications
   - ✅ Background Modes → Remote notifications
4. If missing, click "+ Capability" to add them

### Step 3: Verify Entitlements

Check `ios/siFia/siFia.entitlements` contains:

```xml
<key>aps-environment</key>
<string>production</string>
```

### Step 4: Verify Info.plist

Check `ios/siFia/Info.plist` contains:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

### Step 5: Clean and Rebuild

```bash
cd ios
pod install
cd ..

# Clean build
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*

# Rebuild
npx react-native run-ios --mode Release
```

---

## 📋 Testing & Verification

### Test 1: Check Native Module

Add this to any screen temporarily:

```typescript
import { isNativeModuleAvailable } from '../modules/PushNotificationBridge';

console.log('Native module available:', isNativeModuleAvailable());
```

Expected: `true` on iOS

### Test 2: Request Permissions

```typescript
import { pushNotificationService } from '../services/pushNotificationService';

const testPermissions = async () => {
  const granted = await pushNotificationService.requestPermissions();
  console.log('Permissions granted:', granted);
};
```

### Test 3: Check Device Token

After permissions are granted, check logs for:

```
✅ Device Token: <64-character-hex-string>
[PushNotification] Device token received
```

### Test 4: Verify Database

Check Supabase `device_tokens` table:

```sql
SELECT * FROM device_tokens WHERE user_id = '<your-user-id>';
```

Should show your device token.

### Test 5: Send Test Notification

Use the NotificationDebugScreen or call the edge function directly:

```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "YOUR_USER_ID",
    "type": "test",
    "title": "Test Notification",
    "message": "This is a test from Supabase",
    "priority": "high"
  }'
```

---

## 🐛 Troubleshooting

### Issue: No Device Token Received

**Check:**
1. Xcode console for errors during registration
2. Permissions are granted in iOS Settings → siFia → Notifications
3. AppDelegate is calling `registerForRemoteNotifications()`
4. Native bridge module is properly linked

**Fix:**
```bash
# Rebuild with clean state
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npx react-native run-ios --mode Release
```

### Issue: Native Module Not Found

**Check:**
1. Files are added to Xcode project
2. Files are in the correct target
3. Bridging header is correct

**Fix:**
1. In Xcode, select both `.swift` and `.m` files
2. Right-click → "Show in Finder"
3. Verify they're in `ios/siFia/` directory
4. In Xcode, verify "Target Membership" shows siFia

### Issue: Notifications Not Arriving

**Check:**
1. APNS_JWT_TOKEN is set in Supabase secrets
2. Token is valid (not expired)
3. Device token is in database
4. Edge function logs for errors

**Fix:**
```bash
# Check edge function logs
supabase functions logs send-push-notification

# Regenerate JWT token if expired
node scripts/generate-apns-token.js
```

### Issue: TestFlight Notifications Not Working

**Check:**
1. `aps-environment` is set to `production` (not `development`)
2. Build is uploaded to TestFlight after changes
3. TestFlight uses production APNS

**Fix:**
1. Verify entitlements file
2. Archive new build
3. Upload to TestFlight
4. Wait for processing to complete

---

## 📊 Monitoring & Analytics

### Check Delivery Logs

```sql
SELECT 
  ndl.*,
  dt.platform,
  dt.device_id
FROM notification_delivery_log ndl
JOIN device_tokens dt ON ndl.device_token_id = dt.id
WHERE ndl.user_id = '<your-user-id>'
ORDER BY ndl.created_at DESC
LIMIT 20;
```

### Check Notification Queue

```sql
SELECT * FROM notification_queue
WHERE status = 'pending'
ORDER BY scheduled_for ASC;
```

### Check Analytics

```sql
SELECT 
  type,
  COUNT(*) as total_sent,
  COUNT(opened_at) as opened,
  COUNT(tapped_at) as tapped,
  ROUND(COUNT(opened_at)::numeric / COUNT(*)::numeric * 100, 2) as open_rate
FROM notification_analytics
WHERE user_id = '<your-user-id>'
GROUP BY type;
```

---

## 🔄 Cron Jobs (Optional)

Set up automated notification processing:

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

-- Generate daily notifications at 6 AM
SELECT cron.schedule(
  'generate-daily-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/generate-personalized-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_ANON_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'daily_batch')
  );
  $$
);
```

---

## ✅ Deployment Checklist

- [ ] Edge functions deployed to Supabase
- [ ] Database migrations executed
- [ ] APNS key downloaded from Apple Developer Portal
- [ ] JWT token generated and added to Supabase secrets
- [ ] Native bridge files added to Xcode project
- [ ] Push Notifications capability enabled in Xcode
- [ ] Entitlements file configured
- [ ] Info.plist updated with background modes
- [ ] Clean build performed
- [ ] Permissions tested on device
- [ ] Device token received and saved to database
- [ ] Test notification sent successfully
- [ ] TestFlight build uploaded and tested
- [ ] Cron jobs configured (optional)
- [ ] Monitoring dashboard set up

---

## 📞 Support

If issues persist after following this guide:

1. Check Xcode console for native errors
2. Check Supabase edge function logs
3. Verify all secrets are set correctly
4. Test on a physical device (not simulator)
5. Ensure TestFlight build is the latest version

---

## 🎉 Success Criteria

Your push notifications are working when:

1. ✅ Device token appears in Xcode console
2. ✅ Device token is saved to Supabase `device_tokens` table
3. ✅ Test notification arrives on device
4. ✅ Notification tap opens the app
5. ✅ Deep links navigate to correct screen
6. ✅ Badge count updates correctly
7. ✅ Notifications work in TestFlight

---

**Last Updated:** Phase 1-4 Complete
**Next Steps:** Execute Phase 5-7 following this guide
