# 🚀 Push Notifications - Quick Start

## ✅ What's Been Fixed

### 1. **Native iOS Bridge** ✅
- Created `RCTPushNotificationBridge.swift` - Native module for iOS
- Created `RCTPushNotificationBridge.m` - Objective-C bridge
- Updated `AppDelegate.swift` - Sends device tokens to React Native

### 2. **React Native Integration** ✅
- Created `src/modules/PushNotificationBridge.ts` - TypeScript interface
- Updated `src/services/pushNotificationService.ts` - Uses native bridge
- Event listeners configured for device token registration

### 3. **Backend Ready** ✅
- Edge functions exist in `supabase/functions/`
- Database migrations ready in `database/migrations/`

---

## 🎯 What You Need To Do NOW

### Step 1: Add Native Files to Xcode (5 minutes)

```bash
# Open Xcode
open ios/siFia.xcworkspace
```

In Xcode:
1. Right-click `siFia` folder → "Add Files to siFia"
2. Navigate to `ios/siFia/` and add:
   - `RCTPushNotificationBridge.swift`
   - `RCTPushNotificationBridge.m`
3. ✅ Check "Copy items if needed"
4. ✅ Select "siFia" target
5. Click "Add"

### Step 2: Clean Build (2 minutes)

```bash
cd ios
rm -rf build Pods Podfile.lock
pod install
cd ..

# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*

# Rebuild
npx react-native run-ios --mode Release
```

### Step 3: Generate APNS Token (3 minutes)

You already have the script! Just update it with your values:

```bash
# Edit .env file or run directly
node scripts/generate-apns-token.js
```

This will output your JWT token. Copy it!

### Step 4: Configure Supabase Secrets (2 minutes)

Go to: Supabase Dashboard → Settings → Edge Functions → Secrets

Add:
```
APNS_JWT_TOKEN=<paste-token-from-step-3>
APNS_BUNDLE_ID=com.sifiaopc.app
```

### Step 5: Deploy Edge Functions (2 minutes)

```bash
supabase functions deploy send-push-notification
supabase functions deploy process-notification-queue
supabase functions deploy generate-personalized-notifications
```

### Step 6: Run Database Migration (1 minute)

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `database/migrations/notification_system_tables.sql`
3. Run it

### Step 7: Test! (2 minutes)

Build and run on a real device:

```bash
npx react-native run-ios --device
```

Check Xcode console for:
```
✅ Device Token: <64-character-hex-string>
[PushNotification] Device token received
```

---

## 🐛 Quick Troubleshooting

### "Native module not found"
→ Did you add the files to Xcode? Check Step 1.

### "No device token"
→ Check iOS Settings → siFia → Notifications are enabled

### "Notifications not arriving"
→ Check APNS_JWT_TOKEN is set in Supabase secrets

### "TestFlight not working"
→ Verify `aps-environment` is `production` in entitlements file

---

## 📊 Verify It's Working

### Check 1: Device Token in Database
```sql
SELECT * FROM device_tokens WHERE user_id = '<your-user-id>';
```

### Check 2: Send Test Notification
```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "YOUR_USER_ID",
    "type": "test",
    "title": "Test Notification",
    "message": "If you see this, it works! 🎉",
    "priority": "high"
  }'
```

---

## 📁 Files Changed/Created

### Created:
- ✅ `ios/siFia/RCTPushNotificationBridge.swift`
- ✅ `ios/siFia/RCTPushNotificationBridge.m`
- ✅ `src/modules/PushNotificationBridge.ts`
- ✅ `PUSH_NOTIFICATION_DEPLOYMENT_GUIDE.md` (full guide)
- ✅ `PUSH_NOTIFICATIONS_QUICK_START.md` (this file)

### Modified:
- ✅ `ios/siFia/AppDelegate.swift` - Added bridge integration
- ✅ `src/services/pushNotificationService.ts` - Uses native bridge

### Already Existed:
- ✅ `ios/siFia/siFia.entitlements` - Has production APNS
- ✅ `ios/siFia/Info.plist` - Has background modes
- ✅ `supabase/functions/send-push-notification/` - Edge function ready
- ✅ `database/migrations/notification_system_tables.sql` - Migration ready
- ✅ `scripts/generate-apns-token.js` - Token generator ready

---

## ⏱️ Total Time: ~20 minutes

1. Add files to Xcode: 5 min
2. Clean build: 2 min
3. Generate APNS token: 3 min
4. Configure Supabase: 2 min
5. Deploy functions: 2 min
6. Run migration: 1 min
7. Test: 2 min
8. Verify: 3 min

---

## 🎉 Success Looks Like:

1. ✅ Xcode console shows device token
2. ✅ Device token in Supabase database
3. ✅ Test notification arrives on device
4. ✅ Tapping notification opens app
5. ✅ Works in TestFlight

---

## 📞 Need Help?

See full guide: `PUSH_NOTIFICATION_DEPLOYMENT_GUIDE.md`

Common issues and solutions are documented there.

---

**Ready to go!** Start with Step 1 above. 🚀
