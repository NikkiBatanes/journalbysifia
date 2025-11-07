# siFia Enterprise Notification System - Comprehensive Plan

## Executive Summary
This document outlines a complete, enterprise-grade notification system for siFia that drives user engagement, retention, and spiritual growth through intelligent, contextual, and actionable push notifications.

---

## 1. Current Infrastructure Audit

### Existing Services
- **notificationManagementService.ts**: Core notification preferences, scheduling, and user activity tracking
- **pushNotificationService.ts**: Platform-specific push notification delivery (iOS/Android)
- **notificationService.ts**: (To be audited - likely legacy)

### Existing Capabilities
✅ User notification preferences (per-type toggles)
✅ Quiet hours support (start/end times)
✅ Notification queue system (pending/sent/failed/cancelled)
✅ Device token management (iOS/Android)
✅ Local notification scheduling
✅ Activity tracking (last prayer, devotional, journal, playbook action)
✅ Streak tracking (prayer, devotional, journal)

### Current Gaps
❌ No deep-link navigation handlers
❌ No intelligent scheduling based on user behavior
❌ No notification priority/batching logic
❌ Limited notification types (only basic reminders)
❌ No A/B testing or analytics
❌ No smart notification suppression (avoid spam)
❌ No personalized content in notifications

---

## 2. Notification Taxonomy & Triggers

### 2.1 Prayer-Related Notifications

#### **Pending Prayer Request Reminder**
- **Trigger**: User has unanswered prayer requests older than 24 hours
- **Frequency**: Daily at 9 AM (user's timezone)
- **Priority**: Normal
- **Title**: "Prayer Requests Awaiting Your Attention 🙏"
- **Message**: "You have {count} prayer request(s) that need your prayers today."
- **Deep Link**: `sifia://journal/prayer?tab=requests`
- **Data Payload**: `{ type: 'prayer_request_reminder', count: number, oldest_request_id: string }`

#### **Prayer Answered Celebration**
- **Trigger**: User marks a prayer as answered
- **Frequency**: Immediate
- **Priority**: High
- **Title**: "God Answered Your Prayer! 🎉"
- **Message**: "Praise God! Take a moment to reflect on how He worked in your life."
- **Deep Link**: `sifia://journal/prayer?answered=true&id={prayer_id}`
- **Data Payload**: `{ type: 'prayer_answered', prayer_id: string, answered_date: string }`

#### **Daily Prayer Reminder**
- **Trigger**: User hasn't prayed today (no prayer log entry)
- **Frequency**: Daily at user's preferred time (default 8 AM, 12 PM, 6 PM - configurable)
- **Priority**: Normal
- **Title**: "Time to Connect with God 🙏"
- **Message**: "Take 5 minutes to bring your heart before the Lord."
- **Deep Link**: `sifia://journal/prayer`
- **Data Payload**: `{ type: 'prayer_reminder', suggested_duration: '5-10 minutes' }`

#### **Prayer Streak Alert**
- **Trigger**: User has a prayer streak ≥ 3 days and hasn't prayed today (after 8 PM)
- **Frequency**: Once per day (8 PM)
- **Priority**: High
- **Title**: "Don't Break Your {streak}-Day Prayer Streak! 🔥"
- **Message**: "You're on fire! Keep your spiritual momentum going."
- **Deep Link**: `sifia://journal/prayer`
- **Data Payload**: `{ type: 'streak_alert', streak_type: 'prayer', current_streak: number }`

---

### 2.2 Devotional Notifications

#### **Daily Devotional Reminder**
- **Trigger**: User hasn't completed today's devotional
- **Frequency**: Daily at user's preferred time (default 7 AM)
- **Priority**: Normal
- **Title**: "Today's Devotional is Ready 📖"
- **Message**: "Start your day with God's Word and wisdom."
- **Deep Link**: `sifia://devotionals/today`
- **Data Payload**: `{ type: 'devotional_reminder', devotional_id: string }`

#### **Unanswered Devotional Reflection**
- **Trigger**: User completed a devotional but didn't answer the reflection questions (older than 24 hours)
- **Frequency**: Daily at 6 PM
- **Priority**: Normal
- **Title**: "Complete Your Reflection ✍️"
- **Message**: "You read '{devotional_title}' - take a moment to reflect on it."
- **Deep Link**: `sifia://devotionals/{devotional_id}/reflect`
- **Data Payload**: `{ type: 'devotional_reflection', devotional_id: string, title: string }`

#### **Devotional Streak Alert**
- **Trigger**: User has a devotional streak ≥ 3 days and hasn't read today (after 9 PM)
- **Frequency**: Once per day (9 PM)
- **Priority**: High
- **Title**: "Keep Your {streak}-Day Devotional Streak! 📖"
- **Message**: "You're building a powerful habit. Don't stop now!"
- **Deep Link**: `sifia://devotionals/today`
- **Data Payload**: `{ type: 'streak_alert', streak_type: 'devotional', current_streak: number }`

---

### 2.3 Playbook/Action Step Notifications

#### **Incomplete Action Steps**
- **Trigger**: User has active playbook with incomplete action steps (older than 48 hours)
- **Frequency**: Every 2 days at 10 AM
- **Priority**: Normal
- **Title**: "Continue Your Spiritual Journey 🎯"
- **Message**: "You have {count} action step(s) waiting in '{playbook_title}'."
- **Deep Link**: `sifia://playbooks/{playbook_id}`
- **Data Payload**: `{ type: 'playbook_reminder', playbook_id: string, incomplete_steps: number }`

#### **Playbook Completion Celebration**
- **Trigger**: User completes all action steps in a playbook
- **Frequency**: Immediate
- **Priority**: High
- **Title**: "Playbook Complete! 🎉"
- **Message**: "You finished '{playbook_title}'! Celebrate this spiritual milestone."
- **Deep Link**: `sifia://playbooks/{playbook_id}/celebrate`
- **Data Payload**: `{ type: 'playbook_complete', playbook_id: string, title: string }`

---

### 2.4 Journaling Notifications

#### **Gratitude Reminder**
- **Trigger**: User hasn't logged gratitude today
- **Frequency**: Daily at 8 PM
- **Priority**: Normal
- **Title**: "What Are You Grateful For Today? 🌟"
- **Message**: "Take a moment to count your blessings."
- **Deep Link**: `sifia://journal/gratitude`
- **Data Payload**: `{ type: 'gratitude_reminder' }`

#### **Today's Wins Prompt**
- **Trigger**: User hasn't logged today's wins
- **Frequency**: Daily at 9 PM
- **Priority**: Normal
- **Title**: "Celebrate Today's Wins! 🏆"
- **Message**: "What victories - big or small - did you experience today?"
- **Deep Link**: `sifia://journal/wins`
- **Data Payload**: `{ type: 'wins_reminder' }`

#### **General Journal Reminder**
- **Trigger**: User hasn't journaled in 3 days
- **Frequency**: Every 3 days at 7 PM
- **Priority**: Normal
- **Title**: "Time to Reflect ✍️"
- **Message**: "Your journal is waiting. What's on your heart today?"
- **Deep Link**: `sifia://journal`
- **Data Payload**: `{ type: 'journal_reminder', days_since_last: number }`

#### **Journal Streak Alert**
- **Trigger**: User has a journal streak ≥ 3 days and hasn't journaled today (after 10 PM)
- **Frequency**: Once per day (10 PM)
- **Priority**: High
- **Title**: "Protect Your {streak}-Day Journaling Streak! ✍️"
- **Message**: "You're building consistency. Keep going!"
- **Deep Link**: `sifia://journal`
- **Data Payload**: `{ type: 'streak_alert', streak_type: 'journal', current_streak: number }`

---

### 2.5 Dashboard/Affirmation Notifications

#### **Unread Affirmations**
- **Trigger**: User has affirmations in dashboard that haven't been read aloud (older than 24 hours)
- **Frequency**: Daily at 9 AM
- **Priority**: Normal
- **Title**: "Speak Truth Over Your Life 💬"
- **Message**: "You have {count} affirmation(s) waiting to be declared."
- **Deep Link**: `sifia://dashboard/affirmations`
- **Data Payload**: `{ type: 'affirmation_reminder', count: number }`

#### **Daily Scripture**
- **Trigger**: New daily scripture is available
- **Frequency**: Daily at 6 AM
- **Priority**: Normal
- **Title**: "Today's Scripture 📜"
- **Message**: "{verse_reference}: {verse_preview}..."
- **Deep Link**: `sifia://dashboard/scripture`
- **Data Payload**: `{ type: 'daily_scripture', verse_reference: string, verse_text: string }`

---

### 2.6 Milestone & Celebration Notifications

#### **Faith Points Milestone**
- **Trigger**: User reaches a faith points milestone (100, 500, 1000, etc.)
- **Frequency**: Immediate
- **Priority**: High
- **Title**: "You Reached {points} Faith Points! 🌟"
- **Message**: "Your spiritual growth is inspiring. Keep going!"
- **Deep Link**: `sifia://profile/stats`
- **Data Payload**: `{ type: 'milestone_celebration', milestone_type: 'faith_points', value: number }`

#### **Level Up**
- **Trigger**: User levels up
- **Frequency**: Immediate
- **Priority**: High
- **Title**: "Level Up! You're Now a {level_title}! 🎉"
- **Message**: "Your faith journey is progressing beautifully."
- **Deep Link**: `sifia://profile/stats`
- **Data Payload**: `{ type: 'level_up', new_level: number, level_title: string }`

---

### 2.7 Trial & Subscription Notifications

#### **Trial Expiring Soon**
- **Trigger**: User's trial expires in 1 day
- **Frequency**: Once (1 day before expiry)
- **Priority**: Critical
- **Title**: "Your Trial Ends Tomorrow ⏰"
- **Message**: "Continue your spiritual growth journey - upgrade now to keep full access."
- **Deep Link**: `sifia://subscription/upgrade`
- **Data Payload**: `{ type: 'trial_expiring', days_remaining: 1 }`

#### **Trial Expired**
- **Trigger**: User's trial just expired
- **Frequency**: Immediate
- **Priority**: Critical
- **Title**: "Your Trial Has Ended"
- **Message**: "Upgrade to continue accessing all features and stay on track."
- **Deep Link**: `sifia://subscription/upgrade`
- **Data Payload**: `{ type: 'trial_expired' }`

---

## 3. Notification Scheduling & Priority Logic

### 3.1 Priority Levels
- **Critical**: Trial expiry, payment issues (immediate delivery, bypass quiet hours)
- **High**: Streak alerts, milestones, answered prayers (delivered within 1 hour)
- **Normal**: Daily reminders, incomplete tasks (delivered at scheduled time, respects quiet hours)
- **Low**: Weekly summaries, tips (delivered during optimal engagement windows)

### 3.2 Quiet Hours
- **Default**: 10 PM - 7 AM (user's timezone)
- **Behavior**: Normal/Low priority notifications are held until quiet hours end
- **Exceptions**: Critical notifications bypass quiet hours

### 3.3 Smart Batching
- **Rule**: Max 3 notifications per day (excluding critical)
- **Logic**: If multiple notifications are scheduled for the same day, batch them or prioritize the highest-value notification
- **Example**: If user has both "Prayer Reminder" and "Gratitude Reminder" at 8 PM, combine into: "Evening Reflection Time 🙏✨" → "Take a moment to pray and count your blessings."

### 3.4 Engagement Windows
- **Morning** (6 AM - 9 AM): Devotionals, daily scripture, affirmations
- **Midday** (12 PM - 1 PM): Prayer reminders, playbook nudges
- **Evening** (6 PM - 9 PM): Gratitude, wins, journal prompts
- **Night** (9 PM - 10 PM): Streak alerts (last chance)

---

## 4. Deep-Link Navigation Handlers

### 4.1 URL Scheme
`sifia://[screen]/[action]?[params]`

### 4.2 Handler Mapping
```typescript
const NOTIFICATION_DEEP_LINKS = {
  // Prayer
  'sifia://journal/prayer': { screen: 'Journal', params: { tab: 'prayer' } },
  'sifia://journal/prayer?tab=requests': { screen: 'Journal', params: { tab: 'prayer', subtab: 'requests' } },
  
  // Devotionals
  'sifia://devotionals/today': { screen: 'Devotionals', params: { filter: 'today' } },
  'sifia://devotionals/{id}/reflect': { screen: 'DevotionalDetail', params: { id: '{id}', openReflection: true } },
  
  // Playbooks
  'sifia://playbooks/{id}': { screen: 'PlaybookDetail', params: { id: '{id}' } },
  
  // Journal
  'sifia://journal': { screen: 'Journal' },
  'sifia://journal/gratitude': { screen: 'Journal', params: { tab: 'gratitude' } },
  'sifia://journal/wins': { screen: 'Journal', params: { tab: 'wins' } },
  
  // Dashboard
  'sifia://dashboard/affirmations': { screen: 'Dashboard', params: { scrollTo: 'affirmations' } },
  'sifia://dashboard/scripture': { screen: 'Dashboard', params: { scrollTo: 'scripture' } },
  
  // Profile
  'sifia://profile/stats': { screen: 'UserProfile', params: { scrollTo: 'stats' } },
  
  // Subscription
  'sifia://subscription/upgrade': { screen: 'OnboardingSalesOffer', params: { upgradeMode: true } },
};
```

---

## 5. Phased Rollout Plan

### Phase 1: Foundation (Week 1-2) - 20% Implementation
**Goal**: Establish core notification infrastructure and basic reminders

**Deliverables**:
1. ✅ Deep-link navigation handler service
2. ✅ Notification analytics tracking (open rate, tap rate)
3. ✅ Smart batching logic (max 3/day)
4. ✅ Implement 3 core notifications:
   - Daily devotional reminder
   - Daily prayer reminder
   - Trial expiring notification

**Success Metrics**:
- Deep links work 100% of the time
- Notification open rate > 15%
- Zero crashes from notification taps

---

### Phase 2: Engagement Drivers (Week 3-4) - 40% Implementation
**Goal**: Add streak protection and milestone celebrations

**Deliverables**:
1. ✅ Streak tracking service (prayer, devotional, journal)
2. ✅ Implement 5 notifications:
   - Prayer streak alert
   - Devotional streak alert
   - Journal streak alert
   - Faith points milestone
   - Level up celebration
3. ✅ Quiet hours enforcement
4. ✅ User preference toggles in settings

**Success Metrics**:
- Streak retention increases by 20%
- Milestone notification open rate > 40%
- User opt-out rate < 5%

---

### Phase 3: Contextual Nudges (Week 5-6) - 70% Implementation
**Goal**: Add intelligent, context-aware notifications

**Deliverables**:
1. ✅ Activity tracking service (last prayer, devotional, journal)
2. ✅ Implement 7 notifications:
   - Pending prayer request reminder
   - Unanswered devotional reflection
   - Incomplete action steps
   - Gratitude reminder
   - Today's wins prompt
   - General journal reminder
   - Unread affirmations
3. ✅ Smart scheduling based on user behavior
4. ✅ Personalized notification content (user's name, specific playbook titles, etc.)

**Success Metrics**:
- Task completion rate increases by 25%
- Journal entries increase by 30%
- Notification relevance score > 80% (user survey)

---

### Phase 4: Celebration & Retention (Week 7-8) - 90% Implementation
**Goal**: Maximize user delight and long-term retention

**Deliverables**:
1. ✅ Implement 4 notifications:
   - Prayer answered celebration
   - Playbook completion celebration
   - Daily scripture
   - Weekly summary (new)
2. ✅ A/B testing framework for notification copy
3. ✅ Notification performance dashboard (admin)
4. ✅ Smart suppression (don't notify if user is actively using app)

**Success Metrics**:
- 7-day retention increases by 15%
- 30-day retention increases by 10%
- Celebration notification open rate > 60%

---

### Phase 5: Optimization & Scale (Week 9-10) - 100% Implementation
**Goal**: Polish, optimize, and prepare for scale

**Deliverables**:
1. ✅ Machine learning-based optimal send time (per user)
2. ✅ Advanced batching (combine related notifications)
3. ✅ Notification fatigue detection (auto-reduce frequency if user ignores)
4. ✅ Rich notifications (images, action buttons)
5. ✅ Server-side notification queue processor (Supabase Edge Function)

**Success Metrics**:
- Notification open rate > 25%
- User engagement (DAU/MAU) increases by 20%
- Notification-driven feature usage increases by 35%

---

## 6. Implementation Roadmap

### 6.1 New Services to Create

#### `notificationDeepLinkService.ts`
- Parse notification deep links
- Navigate to correct screen with params
- Handle edge cases (user not logged in, screen doesn't exist)

#### `notificationSchedulerService.ts`
- Intelligent scheduling based on user behavior
- Batching logic
- Quiet hours enforcement
- Optimal send time calculation

#### `notificationAnalyticsService.ts`
- Track notification delivery, opens, taps
- A/B test tracking
- Performance metrics

#### `streakTrackingService.ts`
- Calculate prayer/devotional/journal streaks
- Detect streak breaks
- Trigger streak alerts

---

### 6.2 Database Schema Updates

#### New Tables

**`notification_analytics`**
```sql
CREATE TABLE notification_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

**`user_streaks`**
```sql
CREATE TABLE user_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  prayer_streak INT DEFAULT 0,
  prayer_last_date DATE,
  devotional_streak INT DEFAULT 0,
  devotional_last_date DATE,
  journal_streak INT DEFAULT 0,
  journal_last_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 6.3 UI Updates

#### Settings Screen
- Add "Notifications" section with per-type toggles
- Add "Quiet Hours" time pickers
- Add "Notification Frequency" slider (Low/Medium/High)

#### Dashboard
- Add "Notification History" view (optional)
- Show streak indicators with fire emoji 🔥

---

## 7. Success Metrics & KPIs

### Primary Metrics
- **Notification Open Rate**: Target > 25%
- **Notification Tap Rate**: Target > 15%
- **7-Day Retention**: Increase by 15%
- **30-Day Retention**: Increase by 10%
- **DAU/MAU Ratio**: Increase by 20%

### Secondary Metrics
- **Prayer Frequency**: Increase by 30%
- **Devotional Completion**: Increase by 25%
- **Journal Entries**: Increase by 35%
- **Playbook Completion**: Increase by 20%
- **Streak Retention**: Increase by 40%

### User Satisfaction
- **Notification Relevance Score**: Target > 80% (user survey)
- **Opt-Out Rate**: Target < 5%
- **User Complaints**: Target < 1%

---

## 8. Risk Mitigation

### Risk 1: Notification Fatigue
**Mitigation**:
- Strict batching (max 3/day)
- Smart suppression (don't notify if user is active)
- Easy opt-out per notification type
- Fatigue detection (auto-reduce if user ignores)

### Risk 2: Low Open Rates
**Mitigation**:
- A/B test notification copy
- Personalize content (user's name, specific items)
- Optimize send times per user
- Use emojis and engaging language

### Risk 3: Technical Failures
**Mitigation**:
- Retry logic for failed deliveries
- Fallback to local notifications if push fails
- Comprehensive error logging
- Monitoring and alerts for notification service health

---

## 9. Next Steps

1. **Review & Approve**: Stakeholder review of this plan
2. **Create Tickets**: Break down each phase into JIRA/Linear tickets
3. **Assign Resources**: Allocate engineering resources for each phase
4. **Set Timeline**: Confirm 10-week timeline or adjust based on team capacity
5. **Kickoff Phase 1**: Begin implementation of deep-link handler and core notifications

---

## Appendix A: Notification Copy Templates

### Prayer Reminders
- "Time to Connect with God 🙏"
- "Your Heavenly Father is Waiting 💙"
- "5 Minutes with God Can Change Your Day ✨"

### Devotional Reminders
- "Today's Devotional is Ready 📖"
- "Start Your Day with God's Word 🌅"
- "Wisdom Awaits in Today's Devotional 💡"

### Streak Alerts
- "Don't Break Your {streak}-Day Streak! 🔥"
- "You're on Fire! Keep Going! 🔥"
- "Protect Your Spiritual Momentum 💪"

### Celebrations
- "Praise God! Your Prayer Was Answered! 🎉"
- "You Did It! Playbook Complete! 🏆"
- "Level Up! You're Now a {level_title}! 🌟"

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-08  
**Owner**: Engineering Team  
**Status**: Pending Approval
