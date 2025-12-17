# Notification System Implementation Plan
**Created:** December 17, 2025  
**Status:** Planning Phase  
**Priority:** High - Critical for user engagement and conversion

---

## Executive Summary

The notification system is fully built but **not actively running**. Users are not receiving notifications because:
1. **No cron jobs are scheduled** to trigger the notification functions
2. **No subscription conversion notifications** exist for free users who never subscribe to trial
3. **Inactivity detection exists but isn't triggered** due to missing cron jobs

---

## Current State Analysis

### What's Working ✅
- Complete notification infrastructure (frontend + backend)
- Push notification services (iOS APNS + Android FCM)
- Device token storage and management
- Smart features: rate limiting, batching, quiet hours, fatigue detection
- Notification preferences system

### What's Missing ❌
- **Automated cron job scheduling** (critical blocker)
- **Free user conversion notifications** (users skip trial entirely)
- **Trial user conversion reminders** (for those who do start trial)
- **Inactivity notifications** (users stop using app)
- **Subscription value reminders** (why they should subscribe)

### Key User Behavior Insight 🎯
**"Everyone is not opting for monthly or yearly subscription"**
- Users are staying on free tier
- Not even starting trials
- Need proactive conversion notifications

---

## Detailed Implementation Plan

### Phase 1: Cron Job Infrastructure (NEEDS REVISION ⚠️)
**Timeline:** Immediate  
**Files Created:**
- `.github/workflows/notification-cron-morning.yml` - Runs at 11 PM UTC (7 AM Philippines)
- `.github/workflows/notification-cron-evening.yml` - Runs at 11 AM UTC (7 PM Philippines)
- `.github/workflows/notification-cron-hourly.yml` - Runs every hour

**CRITICAL ISSUE IDENTIFIED:** 
The current approach hardcodes Philippines timezone (UTC+8). This won't work for global users.

**NEW APPROACH - Timezone-Aware Scheduling:**

Instead of running at fixed UTC times, we need to:

1. **Run cron jobs every hour (24 times per day)**
2. **Check each user's timezone** from their profile
3. **Send notifications at their local 8 AM and 7 PM**

**Example Logic:**
```
Current UTC time: 14:00 (2 PM UTC)
- User in Philippines (UTC+8): Local time = 10 PM → Send evening notifications
- User in USA EST (UTC-5): Local time = 9 AM → Send morning notifications  
- User in UK (UTC+0): Local time = 2 PM → No notifications (not 8 AM or 7 PM)
- User in Australia (UTC+10): Local time = 12 AM → No notifications
```

**Why This Matters:**
- Global user base needs personalized timing
- 8 AM Philippines = 12 AM (midnight) in New York = Bad UX
- 7 PM Philippines = 6 AM in New York = Bad UX
- Users set their timezone during onboarding or device detection

---

### Phase 2: Free User Conversion Strategy
**Target:** Users who never subscribe to trial or paid plans

#### Notification Types to Add:

**A. Feature Discovery Notifications**
- **Trigger:** After 3 days of free usage
- **Message:** "🌟 {firstName}, did you know? Premium users get unlimited playbooks and devotionals!"
- **CTA:** "Explore Premium Features"
- **Timing:** Evening (7 PM)

**B. Usage Limit Notifications**
- **Trigger:** User hits 80% of free tier limits
- **Message:** "📊 {firstName}, you've used {usageCount} of {totalFree} free resources. Want unlimited access?"
- **CTA:** "Upgrade Now"
- **Timing:** Immediate

**C. Value Demonstration Notifications**
- **Trigger:** After completing 1st playbook or devotional
- **Message:** "✨ Great progress, {firstName}! Imagine having unlimited access to grow your faith daily."
- **CTA:** "See Premium Plans"
- **Timing:** Evening (7 PM)

**D. Social Proof Notifications**
- **Trigger:** Weekly, for active free users
- **Message:** "🙏 Join 10,000+ believers growing in faith with siFia Premium!"
- **CTA:** "Start Your Journey"
- **Timing:** Evening (7 PM)

**E. Gentle Reminder Notifications**
- **Trigger:** Every 7 days for free users
- **Message:** "💙 {firstName}, unlock your full spiritual potential. Premium starts at just ₱{price}/month."
- **CTA:** "View Plans"
- **Timing:** Evening (7 PM)

---

### Phase 3: Trial User Conversion Strategy
**Target:** Users who started trial but haven't converted to paid

#### Notification Types to Add:

**A. Trial Welcome (Day 1)**
- **Message:** "🎉 Welcome to your trial, {firstName}! Explore all premium features for the next {trialDays} days."
- **CTA:** "Get Started"
- **Timing:** Immediate

**B. Mid-Trial Check-in (Day 4 of 7-day trial)**
- **Message:** "⭐ {firstName}, you're halfway through your trial! Loving it? Subscribe to keep access."
- **CTA:** "Subscribe Now"
- **Timing:** Morning (7 AM)

**C. Trial Ending Soon (2 days before expiry)**
- **Message:** "⏰ {firstName}, your trial ends in 2 days! Don't lose access to unlimited resources."
- **CTA:** "Subscribe to Continue"
- **Timing:** Morning (7 AM)
- **Priority:** Critical

**D. Trial Last Day**
- **Message:** "🚨 Last chance, {firstName}! Your trial ends today. Subscribe now to keep growing."
- **CTA:** "Subscribe Now"
- **Timing:** Morning (7 AM)
- **Priority:** Critical

**E. Trial Expired (Day after expiry)**
- **Message:** "💙 {firstName}, we miss you! Reactivate your premium access anytime."
- **CTA:** "Reactivate Premium"
- **Timing:** Morning (7 AM)

---

### Phase 4: Inactivity Detection Strategy
**Target:** All users (free, trial, paid) who stop using the app

#### Inactivity Tiers:

**A. Light Inactivity (2-3 days)**
- **Message:** "👋 {firstName}, we noticed you haven't checked in. Your spiritual journey is waiting!"
- **CTA:** "Continue Journey"
- **Timing:** Morning (7 AM)
- **Priority:** Normal

**B. Moderate Inactivity (4-7 days)**
- **Message:** "🌟 {firstName}, it's been {daysInactive} days. Come back to your faith practice!"
- **CTA:** "Return to siFia"
- **Timing:** Morning (7 AM)
- **Priority:** High

**C. Streak Risk (20+ hours inactive, has active streak)**
- **Message:** "🔥 {firstName}, your {streakDays}-day streak is at risk! Don't break the chain."
- **CTA:** "Save My Streak"
- **Timing:** Immediate
- **Priority:** Critical

**D. Heavy Inactivity (8-14 days)**
- **Message:** "💙 {firstName}, we miss you! Your community and spiritual growth are waiting."
- **CTA:** "Come Back"
- **Timing:** Morning (7 AM)
- **Priority:** High
- **Include:** Special offer or incentive

**E. Dormant User (15+ days)**
- **Message:** "🙏 {firstName}, it's been a while. We'd love to welcome you back with a special offer!"
- **CTA:** "Reactivate Account"
- **Timing:** Morning (7 AM)
- **Priority:** High
- **Include:** Win-back offer (discount/bonus)

---

### Phase 5: Subscription Value Reminders
**Target:** All non-paying users (free + expired trial)

#### Weekly Reminder Cadence:

**Week 1:** Feature highlight
- "📚 Premium members get unlimited devotionals tailored to their journey"

**Week 2:** Social proof
- "🌟 Join 10,000+ believers deepening their faith with siFia Premium"

**Week 3:** Time-saving benefit
- "⏰ Save hours with AI-powered personalized playbooks and devotionals"

**Week 4:** Spiritual growth benefit
- "📈 Premium users report 3x more consistent spiritual growth"

**Timing:** Sunday evenings (7 PM) - when users are most reflective

---

### Phase 6: Smart Notification Logic

#### Rate Limiting Rules:
- **Free users:** Max 3 conversion notifications per week
- **Trial users:** Max 5 notifications during trial period
- **All users:** Max 8 total notifications per day
- **Respect quiet hours:** 10 PM - 7 AM (user's local time)

#### Batching Rules:
- Batch similar notification types (e.g., multiple playbook reminders → 1 summary)
- Never batch: Payment failures, trial expiry, streak risks
- Batch window: 5 minutes

#### Priority Levels:
1. **Critical:** Trial expiry, payment failures, streak risks (< 4 hours)
2. **High:** Inactivity (7+ days), subscription reminders (trial ending)
3. **Normal:** Daily devotionals, prayer reminders, feature discovery
4. **Low:** Weekly summaries, general tips

---

## Technical Implementation Details

### Database Schema Requirements

#### New Columns Needed in `user_profiles`:
```sql
-- Track subscription conversion attempts
last_subscription_reminder_sent_at TIMESTAMP
subscription_reminder_count INTEGER DEFAULT 0
trial_started_at TIMESTAMP
trial_expires_at TIMESTAMP
trial_converted BOOLEAN DEFAULT false

-- Track inactivity
last_activity TIMESTAMP
days_inactive INTEGER DEFAULT 0
inactivity_notification_sent_at TIMESTAMP

-- Track free tier usage
free_playbooks_used INTEGER DEFAULT 0
free_devotionals_used INTEGER DEFAULT 0
free_tier_limit_notification_sent BOOLEAN DEFAULT false
```

#### New Table: `notification_conversion_tracking`
```sql
CREATE TABLE notification_conversion_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL,
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  converted BOOLEAN DEFAULT false,
  conversion_value DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Edge Function Updates Required

#### `generate-personalized-notifications/index.ts`
**Add new notification templates:**
- `user_inactive` (5 variations)
- `trial_ending_soon` (5 variations)
- `subscription_reminder` (5 variations)
- `free_user_conversion` (5 variations)
- `feature_discovery` (5 variations)
- `usage_limit_warning` (5 variations)

**Add new trigger checks in `checkTriggersAndGenerate()`:**
```typescript
// Check for inactive users (2+ days)
// Check for trial users approaching expiry
// Check for free users hitting usage limits
// Check for free users eligible for conversion reminders
```

#### `send-push-notification/index.ts`
**Add conversion tracking:**
- Log notification sends to `notification_conversion_tracking`
- Track opens and clicks via deep links
- Measure conversion rates

---

## Deployment Checklist

### Prerequisites
- [ ] Verify `SUPABASE_URL` secret in GitHub
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` secret in GitHub
- [ ] Verify `APNS_JWT_TOKEN` in Supabase environment
- [ ] Verify `FCM_SERVER_KEY` in Supabase environment
- [ ] Verify `APNS_BUNDLE_ID` in Supabase environment

### Phase 1: Cron Jobs (Week 1)
- [ ] Deploy morning cron job (7 AM Philippines)
- [ ] Deploy evening cron job (7 PM Philippines)
- [ ] Deploy hourly trigger check
- [ ] Test manual trigger via GitHub Actions
- [ ] Monitor logs for 48 hours

### Phase 2: Database Updates (Week 1)
- [ ] Add new columns to `user_profiles`
- [ ] Create `notification_conversion_tracking` table
- [ ] Migrate existing user data
- [ ] Test queries and indexes

### Phase 3: Notification Templates (Week 2)
- [ ] Add free user conversion templates
- [ ] Add trial conversion templates
- [ ] Add inactivity templates
- [ ] Add subscription reminder templates
- [ ] Test template rendering with real data

### Phase 4: Edge Function Updates (Week 2)
- [ ] Update `generate-personalized-notifications`
- [ ] Add new trigger detection logic
- [ ] Add conversion tracking
- [ ] Deploy to Supabase
- [ ] Test each notification type manually

### Phase 5: Testing (Week 3)
- [ ] Test free user conversion flow
- [ ] Test trial user conversion flow
- [ ] Test inactivity detection
- [ ] Test rate limiting
- [ ] Test batching logic
- [ ] Test quiet hours
- [ ] Verify iOS push notifications
- [ ] Verify Android push notifications

### Phase 6: Monitoring (Week 3-4)
- [ ] Set up notification analytics dashboard
- [ ] Track conversion rates by notification type
- [ ] Monitor notification fatigue metrics
- [ ] A/B test different message variations
- [ ] Adjust timing and frequency based on data

---

## Success Metrics

### Primary KPIs:
1. **Free → Trial Conversion Rate:** Target 15% (currently ~0%)
2. **Trial → Paid Conversion Rate:** Target 40% (currently unknown)
3. **Notification Open Rate:** Target 25%
4. **Notification Click-Through Rate:** Target 10%
5. **User Reactivation Rate (Inactive):** Target 20%

### Secondary KPIs:
1. **Daily Active Users (DAU):** Increase by 30%
2. **Notification Fatigue Rate:** Keep below 5%
3. **Unsubscribe Rate:** Keep below 2%
4. **Average Revenue Per User (ARPU):** Increase by 50%

---

## Risk Mitigation

### Risk 1: Notification Fatigue
**Mitigation:**
- Strict rate limiting (max 8/day)
- Respect user preferences
- Monitor unsubscribe rates
- A/B test frequency

### Risk 2: Low Conversion Rates
**Mitigation:**
- A/B test message variations
- Test different timing
- Offer time-limited discounts
- Highlight social proof

### Risk 3: Technical Failures
**Mitigation:**
- Automated failure alerts (GitHub Issues)
- Retry logic for failed sends
- Queue system for offline users
- Comprehensive logging

### Risk 4: User Annoyance
**Mitigation:**
- Make all notifications valuable
- Easy opt-out in settings
- Never send promotional content during quiet hours
- Personalize based on user behavior

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Cron Jobs | 1 day | ✅ Files created |
| Phase 2: Database Updates | 2-3 days | ⏳ Pending approval |
| Phase 3: Notification Templates | 3-4 days | ⏳ Pending approval |
| Phase 4: Edge Function Updates | 4-5 days | ⏳ Pending approval |
| Phase 5: Testing | 5-7 days | ⏳ Pending approval |
| Phase 6: Monitoring & Optimization | Ongoing | ⏳ Pending approval |

**Total Estimated Time:** 3-4 weeks to full deployment

---

## Next Steps

1. **Review this plan** and provide feedback
2. **Approve database schema changes**
3. **Approve notification message templates**
4. **Set conversion rate targets**
5. **Begin Phase 2 implementation**

---

## Questions for You

1. **Pricing:** What are your current subscription prices (monthly/yearly)?
2. **Trial Duration:** Do you offer trials? If yes, how many days?
3. **Free Tier Limits:** What are the exact limits for free users?
4. **Target Audience:** Are users primarily in Philippines or global?
5. **Discount Strategy:** Are you willing to offer discounts for conversions?
6. **Notification Tone:** Prefer gentle/encouraging or urgent/FOMO-driven?
7. **A/B Testing:** Want to test different message variations?
8. **Analytics:** Do you have existing conversion funnel data?

---

**Ready to proceed?** Let me know which phases to implement first!
