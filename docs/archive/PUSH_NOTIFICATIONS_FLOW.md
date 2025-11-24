# 🔄 Push Notifications Flow Diagram

## 📱 Complete Flow: From Registration to Delivery

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: REGISTRATION                           │
└─────────────────────────────────────────────────────────────────────────┘

1. App Launch
   │
   ├─→ AppDelegate.swift
   │   └─→ registerForPushNotifications()
   │       └─→ UNUserNotificationCenter.requestAuthorization()
   │
   ├─→ User Grants Permission
   │   └─→ application.registerForRemoteNotifications()
   │
   └─→ APNS Generates Device Token
       └─→ didRegisterForRemoteNotificationsWithDeviceToken()

┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASE 2: TOKEN BRIDGING                            │
└─────────────────────────────────────────────────────────────────────────┘

2. Device Token Received
   │
   ├─→ AppDelegate.swift
   │   └─→ Convert Data to Hex String
   │       └─→ "abc123def456..." (64 characters)
   │
   ├─→ RCTPushNotificationBridge.swift
   │   └─→ didRegisterForRemoteNotifications(withDeviceToken:)
   │       └─→ sendEvent("RemoteNotificationRegistered", {deviceToken: "..."})
   │
   └─→ React Native Event Emitter
       └─→ Broadcasts to JavaScript

┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: JAVASCRIPT HANDLING                         │
└─────────────────────────────────────────────────────────────────────────┘

3. Event Received in JavaScript
   │
   ├─→ PushNotificationBridge.ts (TypeScript Module)
   │   └─→ NativeEventEmitter listens for "RemoteNotificationRegistered"
   │       └─→ Receives: {deviceToken: "abc123def456..."}
   │
   ├─→ pushNotificationService.ts
   │   └─→ Event listener callback triggered
   │       └─→ this.deviceToken = event.deviceToken
   │           └─→ saveDeviceToken(userId, token)
   │
   └─→ Supabase Client
       └─→ INSERT INTO device_tokens (user_id, token, platform, device_id)

┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASE 4: DATABASE STORAGE                          │
└─────────────────────────────────────────────────────────────────────────┘

4. Token Saved to Database
   │
   └─→ Supabase: device_tokens table
       ├─→ id: UUID
       ├─→ user_id: "user-uuid-here"
       ├─→ token: "abc123def456..." (device token)
       ├─→ platform: "ios"
       ├─→ device_id: "ios_1234567890_xyz"
       ├─→ is_active: true
       └─→ created_at: timestamp

┌─────────────────────────────────────────────────────────────────────────┐
│                   PHASE 5: SENDING NOTIFICATION                         │
└─────────────────────────────────────────────────────────────────────────┘

5. Backend Triggers Notification
   │
   ├─→ App Logic / Scheduled Job / Manual Trigger
   │   └─→ Calls Edge Function: send-push-notification
   │       └─→ POST /functions/v1/send-push-notification
   │           └─→ Body: {user_id, type, title, message, data, priority}
   │
   ├─→ Edge Function: send-push-notification
   │   ├─→ Query device_tokens WHERE user_id = ? AND is_active = true
   │   ├─→ Query notification_preferences WHERE user_id = ?
   │   ├─→ Check if notification type is enabled
   │   ├─→ Check quiet hours
   │   └─→ For each device token:
   │       └─→ sendAPNS(message, token)
   │
   └─→ APNS Request
       ├─→ URL: https://api.push.apple.com/3/device/{token}
       ├─→ Headers:
       │   ├─→ Authorization: Bearer {APNS_JWT_TOKEN}
       │   ├─→ apns-topic: com.sifiaopc.app
       │   └─→ apns-priority: 10 (high) or 5 (normal)
       └─→ Body:
           └─→ {
                 "aps": {
                   "alert": {"title": "...", "body": "..."},
                   "sound": "default",
                   "badge": 1
                 },
                 "data": {...}
               }

┌─────────────────────────────────────────────────────────────────────────┐
│                   PHASE 6: RECEIVING NOTIFICATION                       │
└─────────────────────────────────────────────────────────────────────────┘

6. Notification Arrives on Device
   │
   ├─→ APNS → iOS Device
   │   └─→ Notification appears in notification center
   │       └─→ User sees: "🎉 Title" / "Message body"
   │
   ├─→ App in Foreground:
   │   └─→ AppDelegate.userNotificationCenter(willPresent:)
   │       └─→ RCTPushNotificationBridge.didReceiveRemoteNotification()
   │           └─→ sendEvent("RemoteNotificationReceived", userInfo)
   │               └─→ pushNotificationService handles
   │                   └─→ Deep link navigation (if applicable)
   │
   └─→ App in Background:
       └─→ User taps notification
           └─→ AppDelegate.userNotificationCenter(didReceive:)
               └─→ RCTPushNotificationBridge.didReceiveRemoteNotification()
                   └─→ sendEvent("RemoteNotificationReceived", userInfo)
                       └─→ pushNotificationService handles
                           └─→ Deep link navigation

┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASE 7: ANALYTICS & LOGGING                       │
└─────────────────────────────────────────────────────────────────────────┘

7. Track Delivery & Engagement
   │
   ├─→ Edge Function logs to notification_delivery_log
   │   └─→ INSERT INTO notification_delivery_log
   │       ├─→ user_id
   │       ├─→ device_token_id
   │       ├─→ status: "delivered" or "failed"
   │       ├─→ error_code (if failed)
   │       └─→ error_message (if failed)
   │
   └─→ App tracks engagement in notification_analytics
       └─→ INSERT INTO notification_analytics
           ├─→ user_id
           ├─→ notification_id
           ├─→ type
           ├─→ sent_at
           ├─→ opened_at (when user opens)
           ├─→ tapped_at (when user taps)
           └─→ deep_link (if navigated)
```

---

## 🔍 Detailed Component Interactions

### 1. Native iOS Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    AppDelegate.swift                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  func application(didFinishLaunchingWithOptions:)     │  │
│  │    ├─→ UNUserNotificationCenter.current().delegate   │  │
│  │    └─→ registerForPushNotifications()                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  func application(didRegisterForRemoteNotifications)  │  │
│  │    ├─→ Convert deviceToken to hex string             │  │
│  │    ├─→ RCTPushNotificationBridge.shared?             │  │
│  │    │   .didRegisterForRemoteNotifications()          │  │
│  │    └─→ NotificationCenter.post() [legacy]            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  func userNotificationCenter(willPresent:)            │  │
│  │    ├─→ RCTPushNotificationBridge.shared?             │  │
│  │    │   .didReceiveRemoteNotification()               │  │
│  │    └─→ completionHandler([.banner, .sound, .badge])  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  func userNotificationCenter(didReceive:)             │  │
│  │    ├─→ RCTPushNotificationBridge.shared?             │  │
│  │    │   .didReceiveRemoteNotification()               │  │
│  │    └─→ completionHandler()                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            RCTPushNotificationBridge.swift                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  class RCTPushNotificationBridge: RCTEventEmitter    │  │
│  │    ├─→ static var shared: RCTPushNotificationBridge? │  │
│  │    └─→ supportedEvents() -> [String]                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  func didRegisterForRemoteNotifications(token)        │  │
│  │    └─→ sendEvent("RemoteNotificationRegistered",     │  │
│  │                  body: ["deviceToken": token])        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  func didReceiveRemoteNotification(notification)      │  │
│  │    └─→ sendEvent("RemoteNotificationReceived",       │  │
│  │                  body: notification)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  @objc func requestPermissions() -> Promise<Bool>    │  │
│  │  @objc func checkPermissions() -> Promise<Object>    │  │
│  │  @objc func setBadgeNumber(number: Int)              │  │
│  │  @objc func scheduleLocalNotification()              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            RCTPushNotificationBridge.m                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  @interface RCT_EXTERN_MODULE(                        │  │
│  │    RCTPushNotificationBridge,                         │  │
│  │    RCTEventEmitter                                    │  │
│  │  )                                                     │  │
│  │                                                        │  │
│  │  RCT_EXTERN_METHOD(requestPermissions:resolve:reject) │  │
│  │  RCT_EXTERN_METHOD(checkPermissions:resolve:reject)   │  │
│  │  RCT_EXTERN_METHOD(setBadgeNumber:)                   │  │
│  │  RCT_EXTERN_METHOD(scheduleLocalNotification:...)     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2. React Native Layer

```
┌─────────────────────────────────────────────────────────────┐
│          src/modules/PushNotificationBridge.ts              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  const { RCTPushNotificationBridge } = NativeModules  │  │
│  │  const eventEmitter = new NativeEventEmitter(...)     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  export const PushNotificationBridge = {              │  │
│  │    requestPermissions: () => Promise<boolean>         │  │
│  │    checkPermissions: () => Promise<Object>            │  │
│  │    setBadgeNumber: (n: number) => void               │  │
│  │    scheduleLocalNotification: (...) => Promise<id>    │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  export function addNotificationEventListener(        │  │
│  │    eventType: NotificationEventType,                  │  │
│  │    listener: NotificationEventListener                │  │
│  │  ): { remove: () => void }                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        src/services/pushNotificationService.ts              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  class PushNotificationService {                      │  │
│  │    private eventListeners: Array<{remove: () => {}}>  │  │
│  │    private deviceToken: string | null                 │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  async initialize(userId: string) {                   │  │
│  │    if (Platform.OS === 'ios') {                       │  │
│  │      await this.initializeIOS(userId)                 │  │
│  │    } else {                                            │  │
│  │      await this.initializeAndroid(userId)             │  │
│  │    }                                                   │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  private async initializeIOS(userId: string) {        │  │
│  │    // Listen for device token                         │  │
│  │    const tokenListener = addNotificationEventListener(│  │
│  │      'RemoteNotificationRegistered',                  │  │
│  │      async (event) => {                               │  │
│  │        this.deviceToken = event.deviceToken           │  │
│  │        await this.saveDeviceToken(userId, token)      │  │
│  │      }                                                 │  │
│  │    )                                                   │  │
│  │                                                        │  │
│  │    // Listen for notifications                        │  │
│  │    const notifListener = addNotificationEventListener(│  │
│  │      'RemoteNotificationReceived',                    │  │
│  │      (notification) => {                              │  │
│  │        this.handleNotificationTap(notification)       │  │
│  │      }                                                 │  │
│  │    )                                                   │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  async saveDeviceToken(userId, token) {               │  │
│  │    await AsyncStorage.setItem('push_token', token)    │  │
│  │    await supabase.from('device_tokens').upsert({...}) │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3. Backend Layer

```
┌─────────────────────────────────────────────────────────────┐
│     supabase/functions/send-push-notification/index.ts      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  serve(async (req) => {                               │  │
│  │    const { user_id, type, title, message, data } =   │  │
│  │      await req.json()                                 │  │
│  │                                                        │  │
│  │    // Get device tokens                               │  │
│  │    const { data: tokens } = await supabase            │  │
│  │      .from('device_tokens')                           │  │
│  │      .select('*')                                     │  │
│  │      .eq('user_id', user_id)                          │  │
│  │      .eq('is_active', true)                           │  │
│  │                                                        │  │
│  │    // Get preferences                                 │  │
│  │    const { data: prefs } = await supabase             │  │
│  │      .from('notification_preferences')                │  │
│  │      .select('*')                                     │  │
│  │      .eq('user_id', user_id)                          │  │
│  │                                                        │  │
│  │    // Check if enabled                                │  │
│  │    if (!isNotificationTypeEnabled(type, prefs)) {     │  │
│  │      return Response({success: false, ...})           │  │
│  │    }                                                   │  │
│  │                                                        │  │
│  │    // Check quiet hours                               │  │
│  │    if (isInQuietHours(prefs)) {                       │  │
│  │      await scheduleForLater(...)                      │  │
│  │      return Response({success: true, scheduled: true})│  │
│  │    }                                                   │  │
│  │                                                        │  │
│  │    // Send to each device                             │  │
│  │    for (const token of tokens) {                      │  │
│  │      if (token.platform === 'ios') {                  │  │
│  │        await sendAPNS(message, token.token)           │  │
│  │      } else {                                          │  │
│  │        await sendFCM(message, token.token)            │  │
│  │      }                                                 │  │
│  │                                                        │  │
│  │      // Log delivery                                  │  │
│  │      await supabase                                   │  │
│  │        .from('notification_delivery_log')             │  │
│  │        .insert({...})                                 │  │
│  │    }                                                   │  │
│  │  })                                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  async function sendAPNS(message, token) {            │  │
│  │    const url = 'https://api.push.apple.com/3/device/'│  │
│  │              + token                                  │  │
│  │                                                        │  │
│  │    const response = await fetch(url, {                │  │
│  │      method: 'POST',                                  │  │
│  │      headers: {                                       │  │
│  │        'Authorization': `Bearer ${APNS_JWT_TOKEN}`,   │  │
│  │        'apns-topic': 'com.sifiaopc.app',              │  │
│  │        'apns-priority': '10'                          │  │
│  │      },                                                │  │
│  │      body: JSON.stringify({                           │  │
│  │        aps: {                                          │  │
│  │          alert: { title, body },                      │  │
│  │          sound: 'default',                            │  │
│  │          badge: 1                                     │  │
│  │        },                                              │  │
│  │        data: {...}                                    │  │
│  │      })                                                │  │
│  │    })                                                  │  │
│  │                                                        │  │
│  │    return { success: response.ok }                    │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Takeaways

1. **Native Bridge is Critical** - Without it, device tokens never reach React Native
2. **Event-Driven Architecture** - Everything flows through events, not callbacks
3. **Type Safety** - TypeScript interfaces ensure correct data flow
4. **Error Handling** - Every step has logging and error recovery
5. **Platform Specific** - iOS and Android handled separately but unified interface

---

## 🔄 Data Flow Summary

```
Device Token Flow:
APNS → AppDelegate → Swift Bridge → Event Emitter → TypeScript → Service → Supabase

Notification Flow:
Backend → Edge Function → APNS → Device → AppDelegate → Swift Bridge → Event Emitter → TypeScript → Service → Deep Link
```

---

**This diagram shows the complete enterprise-grade architecture you now have!** 🎉
