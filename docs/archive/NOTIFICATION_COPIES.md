# siFia Notification Copies - Complete Reference

**Last Updated**: 2025-11-08  
**Total Notification Types**: 17+

---

## 1. STREAK ALERTS (Phase 2)

### Prayer Streak Alert
- **Time**: 8:00 PM
- **Condition**: User has ≥3 day streak AND hasn't prayed today
- **Priority**: High
- **Quiet Hours**: Respected
- **Title**: `Don't Break Your {X}-Day Prayer Streak! 🔥`
- **Message**: `You're on fire! Keep your spiritual momentum going.`
- **Deep Link**: `sifia://journal/prayer`

### Devotional Streak Alert
- **Time**: 9:00 PM
- **Condition**: User has ≥3 day streak AND hasn't read today
- **Priority**: High
- **Quiet Hours**: Respected
- **Title**: `Keep Your {X}-Day Devotional Streak! 📖`
- **Message**: `You're building a powerful habit. Don't stop now!`
- **Deep Link**: `sifia://devotionals/today`

### Journal Streak Alert
- **Time**: 10:00 PM
- **Condition**: User has ≥3 day streak AND hasn't journaled today
- **Priority**: High
- **Quiet Hours**: Respected
- **Title**: `Protect Your {X}-Day Journaling Streak! ✍️`
- **Message**: `You're building consistency. Keep going!`
- **Deep Link**: `sifia://journal`

---

## 2. MILESTONE CELEBRATIONS (Phase 2)

### Faith Points Milestone
- **Time**: Immediate
- **Condition**: User crosses milestone (100, 250, 500, 750, 1000, 2500, 5000, 10000)
- **Priority**: High
- **Quiet Hours**: BYPASSED (celebration is immediate)
- **Title**: `You Reached {X} Faith Points! 🌟`
- **Message**: `Your spiritual growth is inspiring. Keep going!`
- **Deep Link**: `sifia://profile/stats`

### Level Up
- **Time**: Immediate
- **Condition**: User levels up
- **Priority**: High
- **Quiet Hours**: BYPASSED
- **Levels & Titles**:
  - Level 1: Seeker
  - Level 2: Believer
  - Level 3: Disciple
  - Level 4: Servant
  - Level 5: Leader
  - Level 6: Teacher
  - Level 7: Mentor
  - Level 8: Elder
  - Level 9: Steward
  - Level 10: Ambassador
- **Title**: `Level Up! You're Now a {Level Title}! 🎉`
- **Message**: `Your faith journey is progressing beautifully.`
- **Deep Link**: `sifia://profile/stats`

### Playbook Complete
- **Time**: Immediate
- **Condition**: User completes all action steps
- **Priority**: High
- **Quiet Hours**: BYPASSED
- **Title**: `Playbook Complete! 🎉`
- **Message**: `You finished "{Playbook Title}"! Celebrate this spiritual milestone.`
- **Deep Link**: `sifia://playbooks/{id}?celebrate=true`

### Prayer Answered
- **Time**: Immediate
- **Condition**: User marks prayer as answered
- **Priority**: High
- **Quiet Hours**: BYPASSED
- **Title**: `God Answered Your Prayer! 🎉`
- **Message**: `Praise God! Take a moment to reflect on how He worked in your life.`
- **Deep Link**: `sifia://journal/prayer?answered=true&id={prayer_id}`

---

## 3. DAILY REMINDERS (Phase 3)

### Daily Scripture
- **Time**: 6:00 AM
- **Condition**: Always (new verse each day)
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Today's Scripture 📜`
- **Message**: `{Verse Reference}: {Verse Preview}...`
- **Example**: `Philippians 4:13: I can do all things through Christ...`
- **Deep Link**: `sifia://dashboard/scripture`

### Daily Devotional
- **Time**: 7:00 AM
- **Condition**: User hasn't completed today's devotional
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Today's Devotional is Ready 📖`
- **Message**: `Start your day with God's Word and wisdom.`
- **Deep Link**: `sifia://devotionals/today`

### Daily Prayer
- **Time**: 8:00 AM
- **Condition**: User hasn't prayed today
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Time to Connect with God 🙏`
- **Message**: `Take 5 minutes to bring your heart before the Lord.`
- **Deep Link**: `sifia://journal/prayer`

### Prayer Requests (UPDATED - Personalized!)
- **Time**: 9:00 AM
- **Condition**: User has unanswered prayer requests > 24 hours
- **Priority**: Normal
- **Quiet Hours**: Respected

**Variations**:
1. **Single request with name**:
   - **Title**: `Pray for {Name} Now 🙏`
   - **Message**: `Lift them up in prayer today.`

2. **Single request without name**:
   - **Title**: `Prayer Request Waiting 🙏`
   - **Message**: `Someone needs your prayers today.`

3. **Multiple requests with name**:
   - **Title**: `Pray for {Name} and {X} Others 🙏`
   - **Message**: `{Total} prayer requests need your attention.`

4. **Multiple requests without name**:
   - **Title**: `Prayer Requests Awaiting 🙏`
   - **Message**: `You have {X} prayer requests that need your prayers today.`

- **Deep Link**: `sifia://journal/prayer?tab=requests`

### Unread Affirmations
- **Time**: 9:00 AM
- **Condition**: User has affirmations not read aloud > 24 hours
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Speak Truth Over Your Life 💬`
- **Message**: `You have {X} affirmation(s) waiting to be declared.`
- **Deep Link**: `sifia://dashboard/affirmations`

### Incomplete Playbook Steps
- **Time**: 10:00 AM
- **Condition**: User has active playbook with incomplete steps > 48 hours
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Continue Your Spiritual Journey 🎯`
- **Message**: `You have {X} action step(s) waiting in "{Playbook Title}".`
- **Deep Link**: `sifia://playbooks/{id}`

### Unanswered Devotional Reflection
- **Time**: 6:00 PM
- **Condition**: User completed devotional but didn't answer reflection > 24 hours
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Complete Your Reflection ✍️`
- **Message**: `You read "{Devotional Title}" - take a moment to reflect on it.`
- **Deep Link**: `sifia://devotionals/{id}/reflect`

### General Journal Reminder
- **Time**: 7:00 PM
- **Condition**: User hasn't journaled in 3+ days
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Time to Reflect ✍️`
- **Message**: `Your journal is waiting. What's on your heart today?`
- **Deep Link**: `sifia://journal`

### Gratitude Reminder
- **Time**: 8:00 PM
- **Condition**: User hasn't logged gratitude today
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `What Are You Grateful For Today? 🌟`
- **Message**: `Take a moment to count your blessings.`
- **Deep Link**: `sifia://journal/gratitude`

### Today's Wins
- **Time**: 9:00 PM
- **Condition**: User hasn't logged wins today
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Celebrate Today's Wins! 🏆`
- **Message**: `What victories - big or small - did you experience today?`
- **Deep Link**: `sifia://journal/wins`

---

## 4. WEEKLY SUMMARY (Phase 4)

### Weekly Recap
- **Time**: Sunday 7:00 PM
- **Condition**: User had any activity this week
- **Priority**: Normal
- **Quiet Hours**: Respected
- **Title**: `Your Week in Faith 📊`
- **Message**: (Personalized based on activity)

**Message Examples**:

1. **Active week with streaks**:
   > "This week: 5 prayers, 4 devotionals, 3 journal entries. Active: 7-day prayer streak 🔥, 5-day devotional streak 📖. +120 faith points earned! 🌟 Week-long prayer streak!"

2. **Moderate activity**:
   > "This week: 3 prayers, 2 devotionals. Active: 4-day prayer streak 🔥. +50 faith points earned! Keep growing in faith!"

3. **Light activity**:
   > "This week: 2 journal entries. +20 faith points earned! Keep growing in faith!"

- **Deep Link**: `sifia://profile/stats`

---

## 5. TRIAL & SUBSCRIPTION (Phase 1)

### Trial Expiring
- **Time**: 1 day before expiry at 10:00 AM
- **Condition**: User's trial expires in 1 day
- **Priority**: Critical
- **Quiet Hours**: BYPASSED (critical)
- **Title**: `Your Trial Ends Tomorrow ⏰`
- **Message**: `Continue your spiritual growth journey - upgrade now to keep full access.`
- **Deep Link**: `sifia://subscription/upgrade`

### Trial Expired
- **Time**: Immediate when trial expires
- **Condition**: User's trial just expired
- **Priority**: Critical
- **Quiet Hours**: BYPASSED (critical)
- **Title**: `Your Trial Has Ended`
- **Message**: `Upgrade to continue accessing all features and stay on track.`
- **Deep Link**: `sifia://subscription/upgrade`

---

## QUIET HOURS BEHAVIOR

### Default Quiet Hours
- **Start**: 10:00 PM (22:00)
- **End**: 7:00 AM (07:00)
- **User Configurable**: Yes (in User Profile settings)

### How It Works

#### Normal/Low Priority Notifications
- **During Quiet Hours**: Notification is HELD and rescheduled for end of quiet hours
- **Example**: 
  - Scheduled for 11:00 PM (during quiet hours)
  - Automatically moved to 7:00 AM next morning
  - User wakes up to notification at 7:00 AM

#### High Priority Notifications (Streaks)
- **During Quiet Hours**: Still HELD until quiet hours end
- **Example**:
  - Prayer streak alert scheduled for 8:00 PM
  - If quiet hours start at 10:00 PM, it sends at 8:00 PM ✅
  - But if user's quiet hours are 8:00 PM - 7:00 AM, it's held until 7:00 AM

#### Critical Priority Notifications (Milestones, Trial)
- **During Quiet Hours**: BYPASSES quiet hours completely
- **Sends immediately** regardless of time
- **Examples**:
  - Prayer answered celebration → Sends immediately even at 2:00 AM
  - Level up → Sends immediately
  - Trial expiring → Sends immediately

### Different Timezone Scenarios

#### Scenario 1: User in Different Timezone
- **User's Timezone**: PST (UTC-8)
- **Quiet Hours**: 10:00 PM - 7:00 AM PST
- **Notification Scheduled**: 9:00 AM PST
- **Result**: Sends at 9:00 AM PST (respects user's local time)

#### Scenario 2: User Travels to Different Timezone
- **Original Timezone**: EST (UTC-5)
- **New Timezone**: PST (UTC-8)
- **Quiet Hours**: Still 10:00 PM - 7:00 AM (but now in PST)
- **Result**: System uses device's current timezone
- **Note**: User may need to update quiet hours in settings

#### Scenario 3: Notification Scheduled During Quiet Hours
- **Scheduled**: 11:00 PM (during quiet hours)
- **Quiet Hours End**: 7:00 AM
- **Result**: Notification is rescheduled to 7:00 AM
- **User Experience**: Wakes up to notification at 7:00 AM instead of being woken at 11:00 PM

---

## SMART SUPPRESSION

### When Notifications Are Suppressed
- **App State**: Active (user is currently using the app)
- **Reason**: User is already engaged, no need to interrupt
- **Exceptions**: Critical notifications still send

### Examples

#### Suppressed
- User is actively journaling → Journal reminder is suppressed
- User is reading devotional → Devotional reminder is suppressed
- User is in the app → Most reminders are suppressed

#### NOT Suppressed (Critical)
- User just leveled up → Celebration sends immediately
- Prayer was answered → Celebration sends immediately
- Trial expiring → Warning sends immediately

---

## NOTIFICATION BATCHING

### Daily Limit
- **Max**: 3 notifications per day (excluding critical)
- **Reason**: Prevent notification fatigue

### What Happens When Limit Reached
1. First 3 notifications send normally
2. 4th+ notifications are skipped for that day
3. Critical notifications bypass this limit
4. Counter resets at midnight

### Example Day
- 6:00 AM: Daily Scripture ✅ (1/3)
- 7:00 AM: Daily Devotional ✅ (2/3)
- 8:00 PM: Gratitude Reminder ✅ (3/3)
- 9:00 PM: Wins Reminder ❌ (limit reached, skipped)
- 10:00 PM: Journal Streak Alert ❌ (limit reached, skipped)
- **BUT**: If user levels up → Celebration sends ✅ (critical, bypasses limit)

---

## DEEP LINK ISSUE FIX

### Why Dashboard Notifications Don't Open

The deep-link service needs to be initialized with the navigation reference. Here's the fix:

#### In App.tsx or Main Navigator:

```typescript
import { notificationDeepLinkService } from './src/services/notificationDeepLinkService';
import { useNavigationContainerRef } from '@react-navigation/native';

function App() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (navigationRef) {
      // Set navigation reference for deep links
      notificationDeepLinkService.setNavigationRef(navigationRef);
    }
  }, [navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      {/* Your app */}
    </NavigationContainer>
  );
}
```

#### Also Update pushNotificationService.ts:

The notification tap handler needs to track analytics:

```typescript
// In pushNotificationService.ts, update handleNotificationTap:
private handleNotificationTap(notification: any): void {
  try {
    // Track that user tapped notification
    const notificationId = notification.data?.notification_id;
    if (notificationId) {
      import('./notificationAnalyticsService').then(({ notificationAnalyticsService }) => {
        notificationAnalyticsService.trackTapped(notificationId);
      });
    }

    // Handle deep link
    import('./notificationDeepLinkService').then(({ notificationDeepLinkService }) => {
      notificationDeepLinkService.handleNotificationTap(notification);
    });
  } catch (error) {
    Logger.error('[PushNotification] Error handling notification tap', error);
  }
}
```

---

## COPY GUIDELINES

### Tone
- **Encouraging**: "You're on fire! Keep going!"
- **Personal**: "What's on your heart today?"
- **Celebratory**: "Praise God!"
- **Action-Oriented**: "Pray for {Name} Now"

### Emojis
- 🙏 Prayer
- 📖 Devotional
- ✍️ Journal
- 🔥 Streak
- 🎉 Celebration
- 🌟 Achievement
- 🏆 Win
- 📜 Scripture
- 💬 Affirmation
- 🎯 Goal/Playbook
- ⏰ Time-sensitive
- 📊 Summary/Stats

### Length
- **Title**: 5-8 words max
- **Message**: 1-2 sentences max
- **Total Characters**: < 150 for best display

---

**Total Notification Types**: 17+  
**Personalized**: Yes (prayer requests, weekly summary, milestones)  
**Quiet Hours**: Configurable, respected for most notifications  
**Smart Features**: Suppression, batching, fatigue detection
