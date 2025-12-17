# Timezone-Aware Notification Strategy

## Problem Statement

The initial notification system was hardcoded to Philippines timezone (UTC+8), which creates poor user experience for global users:

- **8 AM Philippines** = 12 AM (midnight) New York = 5 AM London = 10 PM (previous day) Los Angeles
- **7 PM Philippines** = 6 AM New York = 11 AM London = 3 AM Los Angeles

**Result:** Users in other timezones receive notifications at inappropriate times (middle of night, early morning, etc.)

---

## Solution: Hourly Cron + User Timezone Detection

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions Cron (Every Hour)                           │
│  Runs: 0 * * * * (top of every hour, 24x per day)          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Edge Function: generate-daily-notifications       │
│  1. Get current UTC time                                     │
│  2. Query all active users                                   │
│  3. For each user:                                           │
│     - Get user's timezone from profile                       │
│     - Calculate user's local time                            │
│     - If local time = 8:00 AM → Queue morning notifications  │
│     - If local time = 7:00 PM → Queue evening notifications  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Database Schema Updates

#### Add timezone column to user_profiles:
```sql
ALTER TABLE user_profiles 
ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Create index for efficient querying
CREATE INDEX idx_user_profiles_timezone ON user_profiles(timezone);
```

#### Timezone detection priority:
1. **User-selected timezone** (from settings/onboarding)
2. **Device timezone** (from React Native `Intl.DateTimeFormat().resolvedOptions().timeZone`)
3. **IP-based geolocation** (fallback)
4. **Default to UTC** (last resort)

---

### 2. Updated Cron Job Strategy

#### Single Hourly Cron Job:
```yaml
# .github/workflows/notification-cron-hourly-global.yml
name: Hourly Global Notifications

on:
  schedule:
    # Run at the top of every hour
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  process-global-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Process notifications for all timezones
        run: |
          curl -X POST "$SUPABASE_URL/functions/v1/generate-daily-notifications" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d '{"action": "timezone_aware_batch"}'
```

---

### 3. Edge Function Logic

#### Pseudocode for timezone-aware processing:
```typescript
async function processTimezoneAwareBatch(supabase: any) {
  const currentUTC = new Date();
  const currentHour = currentUTC.getUTCHours();
  
  // Get all active users
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, first_name, timezone, notification_preferences')
    .eq('is_active', true);
  
  const morningNotifications = [];
  const eveningNotifications = [];
  
  for (const user of users) {
    // Calculate user's local time
    const userLocalTime = convertUTCToTimezone(currentUTC, user.timezone);
    const userLocalHour = userLocalTime.getHours();
    
    // Check if it's 8 AM in user's timezone (with 1-hour window)
    if (userLocalHour === 8) {
      morningNotifications.push({
        user_id: user.id,
        type: 'morning_batch',
        notifications: [
          'devotional_reminder',
          'prayer_reminder',
          'daily_verse'
        ]
      });
    }
    
    // Check if it's 7 PM in user's timezone (with 1-hour window)
    if (userLocalHour === 19) { // 19:00 = 7 PM
      eveningNotifications.push({
        user_id: user.id,
        type: 'evening_batch',
        notifications: [
          'reflection_prompt',
          'journal_reminder',
          'subscription_reminder' // For free users
        ]
      });
    }
  }
  
  // Queue all notifications
  await queueNotifications(morningNotifications);
  await queueNotifications(eveningNotifications);
  
  return {
    processed: users.length,
    morning_sent: morningNotifications.length,
    evening_sent: eveningNotifications.length
  };
}
```

---

### 4. Timezone Detection on Frontend

#### During Onboarding:
```typescript
// src/screens/onboarding/OnboardingPersonalizationScreen.tsx

import { Platform } from 'react-native';

async function detectUserTimezone(): Promise<string> {
  try {
    // Method 1: Use Intl API (most accurate)
    if (typeof Intl !== 'undefined') {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) return timezone;
    }
    
    // Method 2: Use device locale (fallback)
    const locale = Platform.OS === 'ios' 
      ? NativeModules.SettingsManager.settings.AppleLocale
      : NativeModules.I18nManager.localeIdentifier;
    
    // Map locale to timezone (simplified)
    const timezoneMap = {
      'en_PH': 'Asia/Manila',
      'en_US': 'America/New_York',
      'en_GB': 'Europe/London',
      // ... more mappings
    };
    
    return timezoneMap[locale] || 'UTC';
  } catch (error) {
    console.error('Timezone detection failed:', error);
    return 'UTC';
  }
}

// Save to user profile during onboarding
await supabase
  .from('user_profiles')
  .update({ timezone: await detectUserTimezone() })
  .eq('id', userId);
```

#### User Settings (Allow Manual Override):
```typescript
// src/screens/UserProfileScreen.tsx

<View>
  <Text>Notification Timezone</Text>
  <Picker
    selectedValue={userTimezone}
    onValueChange={(value) => updateTimezone(value)}
  >
    <Picker.Item label="Auto-detect" value="auto" />
    <Picker.Item label="Philippines (Manila)" value="Asia/Manila" />
    <Picker.Item label="USA (New York)" value="America/New_York" />
    <Picker.Item label="USA (Los Angeles)" value="America/Los_Angeles" />
    <Picker.Item label="UK (London)" value="Europe/London" />
    <Picker.Item label="Australia (Sydney)" value="Australia/Sydney" />
    <Picker.Item label="Singapore" value="Asia/Singapore" />
    {/* Add more timezones */}
  </Picker>
</View>
```

---

### 5. Notification Timing Preferences

#### Allow users to customize notification times:
```typescript
// notification_preferences table
{
  user_id: UUID,
  morning_notification_time: '08:00', // User's local time
  evening_notification_time: '19:00', // User's local time
  timezone: 'Asia/Manila',
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00'
}
```

#### Updated edge function logic:
```typescript
// Instead of hardcoded 8 AM and 7 PM, use user preferences
const userMorningHour = parseInt(user.morning_notification_time.split(':')[0]);
const userEveningHour = parseInt(user.evening_notification_time.split(':')[0]);

if (userLocalHour === userMorningHour) {
  // Send morning notifications
}

if (userLocalHour === userEveningHour) {
  // Send evening notifications
}
```

---

## Timezone Coverage Examples

### Major Timezones to Support:

| Region | Timezone | UTC Offset | 8 AM Local = UTC |
|--------|----------|------------|------------------|
| Philippines | Asia/Manila | UTC+8 | 00:00 UTC |
| Singapore | Asia/Singapore | UTC+8 | 00:00 UTC |
| USA East | America/New_York | UTC-5 | 13:00 UTC |
| USA West | America/Los_Angeles | UTC-8 | 16:00 UTC |
| UK | Europe/London | UTC+0 | 08:00 UTC |
| Australia | Australia/Sydney | UTC+10 | 22:00 UTC (prev day) |
| India | Asia/Kolkata | UTC+5:30 | 02:30 UTC |
| Japan | Asia/Tokyo | UTC+9 | 23:00 UTC (prev day) |

### Hourly Cron Coverage:
With hourly cron jobs, we cover all 24 timezones:
- **00:00 UTC** → 8 AM in Philippines, Singapore
- **01:00 UTC** → 8 AM in Japan
- **02:00 UTC** → 8 AM in Korea
- **08:00 UTC** → 8 AM in UK
- **13:00 UTC** → 8 AM in USA East Coast
- **16:00 UTC** → 8 AM in USA West Coast
- ... and so on

---

## Benefits of This Approach

### ✅ Pros:
1. **Global compatibility** - Works for users in any timezone
2. **Personalized timing** - Each user gets notifications at their optimal time
3. **Scalable** - Single cron job handles all timezones
4. **User control** - Users can customize notification times
5. **Respects quiet hours** - Per-user quiet hours in their local time

### ⚠️ Considerations:
1. **Hourly execution** - More frequent than twice-daily (acceptable for cloud functions)
2. **Database queries** - Need efficient indexing on timezone column
3. **Timezone data** - Need to handle DST (Daylight Saving Time) transitions
4. **Edge cases** - Users traveling across timezones (use device timezone)

---

## Migration Plan

### Phase 1: Add Timezone Support (Week 1)
- [ ] Add `timezone` column to `user_profiles`
- [ ] Add timezone detection to onboarding flow
- [ ] Add timezone picker to user settings
- [ ] Backfill existing users with device timezone or default to UTC

### Phase 2: Update Edge Functions (Week 1-2)
- [ ] Modify `generate-daily-notifications` to support timezone-aware logic
- [ ] Add timezone conversion utilities
- [ ] Test with multiple timezone scenarios

### Phase 3: Update Cron Jobs (Week 2)
- [ ] Replace twice-daily crons with single hourly cron
- [ ] Update cron to call new timezone-aware endpoint
- [ ] Monitor execution and performance

### Phase 4: Testing (Week 2-3)
- [ ] Test with users in Philippines (UTC+8)
- [ ] Test with users in USA (UTC-5, UTC-8)
- [ ] Test with users in UK (UTC+0)
- [ ] Test with users in Australia (UTC+10)
- [ ] Test DST transitions
- [ ] Test user timezone changes (travel)

### Phase 5: Rollout (Week 3-4)
- [ ] Deploy to production
- [ ] Monitor notification delivery times
- [ ] Collect user feedback
- [ ] Adjust timing windows if needed

---

## Testing Scenarios

### Test Case 1: Philippines User
- **Timezone:** Asia/Manila (UTC+8)
- **Expected:** Notifications at 8 AM and 7 PM Manila time
- **Cron runs at:** 00:00 UTC (morning) and 11:00 UTC (evening)

### Test Case 2: USA East Coast User
- **Timezone:** America/New_York (UTC-5)
- **Expected:** Notifications at 8 AM and 7 PM New York time
- **Cron runs at:** 13:00 UTC (morning) and 00:00 UTC (evening)

### Test Case 3: UK User
- **Timezone:** Europe/London (UTC+0)
- **Expected:** Notifications at 8 AM and 7 PM London time
- **Cron runs at:** 08:00 UTC (morning) and 19:00 UTC (evening)

### Test Case 4: User Traveling
- **Scenario:** User travels from Philippines to USA
- **Expected:** Notifications automatically adjust to device timezone
- **Implementation:** Detect timezone change on app open, update profile

---

## Performance Optimization

### Efficient User Querying:
```sql
-- Instead of querying all users every hour, query only relevant timezones
-- Example: At 00:00 UTC, only query users in UTC+8 timezones

SELECT id, first_name, timezone, notification_preferences
FROM user_profiles
WHERE is_active = true
  AND timezone IN ('Asia/Manila', 'Asia/Singapore', 'Asia/Hong_Kong')
  AND (
    -- Morning notifications (8 AM local)
    EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone) = 8
    OR
    -- Evening notifications (7 PM local)
    EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone) = 19
  );
```

### Caching Strategy:
- Cache timezone mappings (UTC offset calculations)
- Cache user notification preferences (5-minute TTL)
- Batch notification queue insertions (100 at a time)

---

## Conclusion

The timezone-aware approach ensures that **all users worldwide receive notifications at their optimal local times**, significantly improving user experience and engagement compared to hardcoded Philippines time.

**Next Steps:**
1. Get approval for hourly cron approach
2. Implement timezone detection in onboarding
3. Update edge functions with timezone logic
4. Test with multiple timezone scenarios
5. Deploy and monitor
