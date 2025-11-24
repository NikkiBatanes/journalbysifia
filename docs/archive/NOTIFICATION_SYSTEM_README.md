# siFia Notification System - Developer Guide

## Overview

The siFia notification system is an enterprise-grade, intelligent notification platform that drives user engagement through contextual, personalized, and timely push notifications.

**Current Status**: 90% Complete (Phases 1-4)  
**Last Updated**: 2025-11-08

---

## Quick Start

### 1. Initialize on App Launch

```typescript
// In App.tsx or main entry point
import { DailyNotificationScheduler } from './src/utils/dailyNotificationScheduler';
import { useAuth } from './src/context/IndustryStandardAuthContext';

function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      // Schedule all daily notifications (once per day)
      DailyNotificationScheduler.scheduleForUser(user.id);
    }
  }, [user?.id]);

  return <YourApp />;
}
```

### 2. Track User Activities

```typescript
// In any screen/component
import { useNotificationIntegration } from '../hooks/useNotificationIntegration';

function JournalScreen() {
  const { trackPrayer, trackJournal } = useNotificationIntegration();

  const handlePrayerComplete = async () => {
    // Your prayer logic...
    
    // Track activity and update streak
    await trackPrayer();
  };

  const handleJournalSave = async () => {
    // Your journal logic...
    
    // Track activity and update streak
    await trackJournal();
  };
}
```

### 3. Celebrate Milestones

```typescript
const { celebrateLevelUp, celebrateFaithPoints } = useNotificationIntegration();

// When user levels up
await celebrateLevelUp(newLevel);

// When user earns faith points
await celebrateFaithPoints(previousPoints, currentPoints);
```

---

## Architecture

### Core Services

#### 1. **notificationDeepLinkService.ts**
- Handles navigation from notification taps
- Parses deep link URLs (`sifia://[screen]/[action]?[params]`)
- Routes to correct screens with parameters

#### 2. **notificationAnalyticsService.ts**
- Tracks notification delivery, opens, and taps
- Calculates open rate and tap rate metrics
- Detects notification fatigue (< 10% open rate)

#### 3. **notificationSchedulerService.ts**
- Smart scheduling with batching (max 3/day)
- Quiet hours enforcement (default 10 PM - 7 AM)
- Priority-based delivery (Critical bypasses quiet hours)
- **Smart suppression**: Doesn't notify if app is active

#### 4. **streakTrackingService.ts**
- Tracks prayer, devotional, and journal streaks
- Auto-updates streaks when user completes activities
- Schedules streak alert notifications (≥3 days)

#### 5. **milestoneCelebrationService.ts**
- Celebrates faith points milestones (100, 250, 500, etc.)
- Level up celebrations with titles
- Playbook completion celebrations
- Prayer answered celebrations

#### 6. **contextualNotificationService.ts**
- 12 smart, behavior-based notification types
- Daily reminders (devotional, prayer, gratitude, wins)
- Inactivity reminders (journal, playbook, prayer requests)
- Dashboard reminders (scripture, affirmations)

#### 7. **weeklySummaryService.ts**
- Generates weekly recap of spiritual activity
- Highlights achievements and streaks
- Scheduled for Sunday evenings

---

## Notification Types

### Streaks & Alerts (Phase 2)
| Type | Time | Condition | Priority |
|------|------|-----------|----------|
| Prayer Streak Alert | 8 PM | ≥3 days & not prayed today | High |
| Devotional Streak Alert | 9 PM | ≥3 days & not read today | High |
| Journal Streak Alert | 10 PM | ≥3 days & not journaled today | High |

### Milestones (Phase 2)
| Type | Trigger | Priority |
|------|---------|----------|
| Faith Points Milestone | 100, 250, 500, 750, 1000, 2500, 5000, 10000 | High |
| Level Up | New level reached | High |
| Playbook Complete | All action steps done | High |
| Prayer Answered | User marks prayer as answered | High |

### Daily Reminders (Phase 3)
| Type | Time | Condition | Priority |
|------|------|-----------|----------|
| Daily Scripture | 6 AM | Always | Normal |
| Daily Devotional | 7 AM | If not completed today | Normal |
| Daily Prayer | 8 AM | If not prayed today | Normal |
| Prayer Requests | 9 AM | If unanswered > 24 hours | Normal |
| Affirmations | 9 AM | If unread | Normal |
| Playbook Steps | 10 AM | If incomplete > 48 hours | Normal |
| Devotional Reflection | 6 PM | If completed but unreflected | Normal |
| Journal Reminder | 7 PM | If no journal in 3 days | Normal |
| Gratitude Reminder | 8 PM | If not logged today | Normal |
| Wins Reminder | 9 PM | If not logged today | Normal |

### Weekly Summary (Phase 4)
| Type | Time | Condition | Priority |
|------|------|-----------|----------|
| Weekly Recap | Sunday 7 PM | If any activity this week | Normal |

---

## Deep Link Routes

### Format
```
sifia://[screen]/[action]?[params]
```

### Supported Routes

#### Journal
- `sifia://journal` - Open journal
- `sifia://journal/prayer` - Open prayer tab
- `sifia://journal/prayer?tab=requests` - Open prayer requests
- `sifia://journal/prayer?answered=true&id={id}` - Highlight answered prayer
- `sifia://journal/gratitude` - Open gratitude tab
- `sifia://journal/wins` - Open wins tab

#### Devotionals
- `sifia://devotionals` - Open devotionals list
- `sifia://devotionals/today` - Open today's devotional
- `sifia://devotionals/{id}` - Open specific devotional
- `sifia://devotionals/{id}/reflect` - Open reflection modal

#### Playbooks
- `sifia://playbooks` - Open playbook list
- `sifia://playbooks/{id}` - Open specific playbook
- `sifia://playbooks/{id}?celebrate=true` - Show completion celebration

#### Dashboard
- `sifia://dashboard` - Open dashboard
- `sifia://dashboard/affirmations` - Scroll to affirmations
- `sifia://dashboard/scripture` - Scroll to scripture

#### Profile
- `sifia://profile` - Open profile
- `sifia://profile/stats` - Scroll to stats

#### Subscription
- `sifia://subscription/upgrade` - Open upgrade screen

---

## Integration Hook API

### `useNotificationIntegration()`

#### Activity Tracking
```typescript
const {
  trackPrayer,      // Track prayer completion
  trackDevotional,  // Track devotional completion
  trackJournal,     // Track journal entry
  trackActivity,    // Generic activity tracker
} = useNotificationIntegration();

// Usage
await trackPrayer();
await trackDevotional();
await trackJournal();
await trackActivity('prayer'); // or 'devotional' or 'journal'
```

#### Milestone Celebrations
```typescript
const {
  celebrateFaithPoints,      // Check and celebrate faith points milestones
  celebrateLevelUp,          // Celebrate level up
  celebratePlaybookComplete, // Celebrate playbook completion
  celebratePrayerAnswered,   // Celebrate prayer answered
} = useNotificationIntegration();

// Usage
await celebrateFaithPoints(previousPoints, currentPoints);
await celebrateLevelUp(newLevel);
await celebratePlaybookComplete(playbookId, playbookTitle);
await celebratePrayerAnswered(prayerId);
```

#### Streak Info
```typescript
const { getStreakStatus } = useNotificationIntegration();

// Get current streak status
const status = await getStreakStatus('prayer'); // or 'devotional' or 'journal'
// Returns: { current: number, best: number, lastDate: string | null, isActive: boolean }
```

#### Daily Notifications
```typescript
const {
  scheduleAllDailyNotifications, // Schedule all daily reminders
  scheduleDevotionalReminder,    // Custom time devotional
  schedulePrayerReminder,        // Custom time prayer
  scheduleGratitudeReminder,     // Evening gratitude
  scheduleWinsReminder,          // Evening wins
} = useNotificationIntegration();

// Usage
await scheduleAllDailyNotifications();
await scheduleDevotionalReminder('06:00'); // Custom time
await schedulePrayerReminder('09:00');     // Custom time
await scheduleGratitudeReminder();
await scheduleWinsReminder();
```

---

## Daily Notification Scheduler

### `DailyNotificationScheduler`

```typescript
import { DailyNotificationScheduler } from '../utils/dailyNotificationScheduler';

// Check if should schedule today
const shouldSchedule = await DailyNotificationScheduler.shouldScheduleToday();

// Schedule all daily notifications
await DailyNotificationScheduler.scheduleForUser(userId);

// Force reschedule (for testing)
await DailyNotificationScheduler.forceReschedule(userId);

// Get last scheduled date
const lastDate = await DailyNotificationScheduler.getLastScheduledDate();
```

---

## Smart Features

### 1. **Smart Suppression**
- Notifications are suppressed if app is active
- Critical notifications bypass suppression
- Prevents interrupting engaged users

### 2. **Fatigue Detection**
- Tracks user engagement (open rate)
- If open rate < 10% over 7 days, reduces notifications
- Critical notifications bypass fatigue detection

### 3. **Quiet Hours**
- Default: 10 PM - 7 PM (user's timezone)
- Normal/Low priority notifications are held until quiet hours end
- Critical notifications bypass quiet hours

### 4. **Smart Batching**
- Max 3 notifications per day (excluding critical)
- Related notifications can be combined
- Prevents notification spam

### 5. **Behavior-Based Scheduling**
- Checks if user already completed activity before scheduling
- Detects inactivity and triggers reminders
- Personalizes timing based on user patterns

---

## Database Tables

### `notification_analytics`
Tracks notification delivery and engagement.

```sql
CREATE TABLE notification_analytics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  notification_id UUID,
  type TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  tapped_at TIMESTAMP WITH TIME ZONE,
  deep_link TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `user_streaks`
Tracks prayer, devotional, and journal streaks.

```sql
CREATE TABLE user_streaks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  prayer_streak INT DEFAULT 0,
  prayer_last_date DATE,
  prayer_best_streak INT DEFAULT 0,
  devotional_streak INT DEFAULT 0,
  devotional_last_date DATE,
  devotional_best_streak INT DEFAULT 0,
  journal_streak INT DEFAULT 0,
  journal_last_date DATE,
  journal_best_streak INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Testing

### Manual Testing

```typescript
// Force reschedule all notifications
await DailyNotificationScheduler.forceReschedule(userId);

// Check streak status
const status = await getStreakStatus('prayer');
console.log('Prayer streak:', status);

// Test milestone celebration
await celebrateFaithPoints(90, 110); // Should trigger 100-point milestone
```

### Debugging

```typescript
// Check if notifications are scheduled
const pending = await notificationManagementService.getPendingNotifications(userId);
console.log('Pending notifications:', pending);

// Check analytics
const metrics = await notificationAnalyticsService.getUserMetrics(userId, 7);
console.log('7-day metrics:', metrics);

// Check fatigue
const isFatigued = await notificationAnalyticsService.checkNotificationFatigue(userId);
console.log('Is fatigued:', isFatigued);
```

---

## Best Practices

### 1. **Always Track Activities**
```typescript
// ✅ Good
await handlePrayerComplete();
await trackPrayer(); // Track after successful completion

// ❌ Bad
await handlePrayerComplete(); // Forgot to track
```

### 2. **Use Daily Scheduler on App Launch**
```typescript
// ✅ Good - Schedule once per day
useEffect(() => {
  if (user?.id) {
    DailyNotificationScheduler.scheduleForUser(user.id);
  }
}, [user?.id]);

// ❌ Bad - Scheduling on every render
scheduleAllDailyNotifications(); // Will spam notifications
```

### 3. **Respect User Preferences**
```typescript
// User preferences are automatically checked by the scheduler
// No need to manually check before scheduling
```

### 4. **Handle Errors Gracefully**
```typescript
try {
  await trackPrayer();
} catch (error) {
  // Don't block user flow if tracking fails
  Logger.error('Failed to track prayer', error);
}
```

---

## Troubleshooting

### Notifications Not Sending

1. **Check user preferences**
   - Verify notification type is enabled in User Profile settings

2. **Check quiet hours**
   - Verify current time is not within quiet hours

3. **Check daily limit**
   - User may have reached max 3 notifications/day

4. **Check fatigue detection**
   - User may have low engagement (< 10% open rate)

5. **Check app state**
   - Notifications are suppressed if app is active

### Streaks Not Updating

1. **Verify `trackActivity()` is called**
   - Add logging to confirm it's being called

2. **Check database function**
   - Verify `update_user_streak()` function exists in Supabase

3. **Check user_streaks table**
   - Verify table exists and has correct schema

---

## Future Enhancements (Phase 5)

- Machine learning optimal send time per user
- Advanced batching (combine related notifications)
- Rich notifications (images, action buttons)
- Server-side queue processor (Supabase Edge Function)
- A/B testing framework for notification copy
- Notification performance dashboard

---

## Support

For questions or issues, contact the development team or refer to:
- `NOTIFICATION_SYSTEM_PLAN.md` - Complete system plan
- `NOTIFICATION_PROGRESS.md` - Implementation progress tracker
