# Subscription Scenarios - Quick FAQ
**Direct Answers to Critical Questions**

## Your Specific Questions Answered

### Q1: "3 day trial > then when cancelled before > if not cancelled > then the auto renewable monthly recurring and monthly refreshes for annual"

**Answer:**

#### **Scenario A: Trial Cancelled Before Day 3**
```
Day 0: User starts trial → Gets 2/2 limits
Day 1: User cancels in iOS Settings
      → trial_cancelled_date = Day 1
      → User KEEPS trial access until Day 3
      → Can still use remaining playbooks/devotionals
Day 3: Trial expires
      → Automatically downgraded to Seeker (0/0)
      → NO CHARGE from Apple
```

#### **Scenario B: Trial NOT Cancelled (Auto-Conversion)**
```
Day 0: User starts trial → Gets 2/2 limits
Day 1-2: User does nothing
Day 3: Trial expires at 23:59
      → Apple AUTOMATICALLY CHARGES user
      → User converted to paid tier
      → Gets full limits (10/10 for Spark, 25/25 for Growth, unlimited for Transformation)
      → New subscription_end_date set
      
Monthly Subscription:
  Day 30: Apple charges → DID_RENEW webhook → Reset usage to 0/0
  Day 60: Apple charges → DID_RENEW webhook → Reset usage to 0/0
  Day 90: Apple charges → DID_RENEW webhook → Reset usage to 0/0
  ... continues every 30 days

Annual Subscription:
  Day 30: Client-side reset → checkAndResetMonthlyUsage() → Reset usage to 0/0
  Day 60: Client-side reset → checkAndResetMonthlyUsage() → Reset usage to 0/0
  Day 90: Client-side reset → checkAndResetMonthlyUsage() → Reset usage to 0/0
  ... continues every 30 days for 365 days
  Day 365: Apple charges for Year 2 → DID_RENEW webhook → Reset usage
```

---

### Q2: "if someone cancelled their subscription monthly will we stop refreshing"

**Answer: YES - Monthly refreshes STOP immediately after cancellation.**

**Detailed Explanation:**

```
Day 0: User subscribes to Spark Monthly ($4.99/month)
       → playbooks_limit: 10
       → devotionals_limit: 10

Day 1-14: User generates content
          → playbooks_used: 3
          → devotionals_used: 2

Day 15: User cancels subscription
        → Webhook: DID_CHANGE_RENEWAL_STATUS (AUTO_RENEW_DISABLED)
        → auto_renew_enabled: false
        → cancellation_date: Day 15
        → User KEEPS access until Day 30
        → Remaining usage: 5 playbooks, 6 devotionals

Day 16-29: User continues using remaining quota
           → Can use up to 10/10 total (already used 3/2)

Day 30: Subscription end date reached
        → NO DID_RENEW WEBHOOK FIRES (cancelled subscription)
        → NO USAGE RESET HAPPENS
        → Webhook: EXPIRED
        → Downgraded to Seeker (0/0)
```

**Why Refreshes Stop:**
- Monthly subscriptions reset ONLY via `DID_RENEW` webhook
- `DID_RENEW` webhook fires ONLY when Apple successfully charges user
- Cancelled subscriptions don't charge → No `DID_RENEW` → No reset

**Code Reference:**
```typescript
// From NewSubscriptionService.ts lines 157-161
if (!isAnnual) {
  return false; // Monthly subs reset via DID_RENEW webhook only
  // CANCELLATION BEHAVIOR FOR MONTHLY:
  // - User cancels → No more DID_RENEW webhooks fire
  // - Therefore NO resets after cancellation
  // - On expiration: EXPIRED webhook downgrades to Seeker
}
```

---

### Q3: "if someone cancelled their annual subscription. how will we handle it. what if it is in the middle of the year."

**Answer: User gets FULL YEAR of access with CONTINUED monthly refreshes.**

**Detailed Explanation:**

```
Day 0: User subscribes to Spark Annual ($49.99/year)
       → playbooks_limit: 10/month
       → devotionals_limit: 10/month
       → subscription_end_date: Day 365

Day 30: Usage reset (client-side)
Day 60: Usage reset (client-side)
Day 90: Usage reset (client-side)
Day 120: Usage reset (client-side)
Day 150: Usage reset (client-side)

Day 180: User cancels subscription (6 months in)
         → Webhook: DID_CHANGE_RENEWAL_STATUS (AUTO_RENEW_DISABLED)
         → auto_renew_enabled: false
         → cancellation_date: Day 180
         → tier: 'spark_annual' (UNCHANGED ✅)
         → billing_cycle: 'annual' (UNCHANGED ✅)
         → subscription_end_date: Day 365 (UNCHANGED ✅)

Day 210: ✅ USAGE STILL RESETS (client-side calculation)
Day 240: ✅ USAGE STILL RESETS (client-side calculation)
Day 270: ✅ USAGE STILL RESETS (client-side calculation)
Day 300: ✅ USAGE STILL RESETS (client-side calculation)
Day 330: ✅ USAGE STILL RESETS (client-side calculation)
Day 360: ✅ USAGE STILL RESETS (client-side calculation)

Day 365: Subscription end date reached
         → Webhook: EXPIRED
         → Downgraded to Seeker (0/0)
```

**Why Refreshes Continue:**

1. **User paid for full year** → They get full year of service
2. **Annual refreshes are CLIENT-SIDE** → Not dependent on Apple webhooks
3. **Logic checks `billing_cycle === 'annual'`** → Still true after cancellation
4. **Calculation is time-based** → Not subscription status-based

**Code Reference:**
```typescript
// From NewSubscriptionService.ts lines 163-167
// CANCELLATION BEHAVIOR FOR ANNUAL:
// - User cancels → auto_renew_enabled: false, but tier stays annual
// - Monthly resets CONTINUE (user paid for full year)
// - Keeps annual badge/tier until expiration
// - On Day 365: EXPIRED webhook downgrades to Seeker
```

**Client-Side Reset Logic:**
```typescript
// From NewSubscriptionService.ts lines 134-222
checkAndResetMonthlyUsage(userId) {
  // Only reset for active paid subscriptions
  if (subscription.tier === 'seeker' || subscription.tier === 'free_trial') {
    return false; // No resets for seeker or trial
  }

  const isAnnual = subscription.billing_cycle === 'annual' ||
                   subscription.tier?.includes('_annual');

  if (!isAnnual) {
    return false; // Monthly handled by webhook
  }

  // Annual: Calculate from billing anchor
  const billingAnchor = new Date(subscription.subscription_start_date);
  const now = new Date();
  const daysSinceAnchor = (now - billingAnchor) / (1000 * 60 * 60 * 24);
  
  // Calculate which 30-day period we're in
  const currentPeriod = Math.floor(daysSinceAnchor / 30);
  const currentPeriodStart = billingAnchor + (currentPeriod * 30 days);
  
  // Check if we already reset for this period
  const lastReset = subscription.last_usage_reset;
  
  if (lastReset < currentPeriodStart) {
    // NEW 30-day period → Reset usage
    playbooks_used = 0;
    devotionals_used = 0;
    last_usage_reset = now;
    return true;
  }
  
  return false;
}
```

**Note:** This function is called before EVERY playbook/devotional generation attempt, so resets happen automatically even for cancelled subscriptions.

---

### Q4: "what if someone refunded and apple approved"

**Answer: IMMEDIATE loss of ALL access, NO grace period, NO remaining usage.**

**Detailed Explanation:**

```
Day 0: User subscribes to Spark Annual ($49.99/year)
Day 1-180: User uses service normally

Day 180: User requests refund from Apple
         → Apple Support reviews request
         → Apple APPROVES refund
         → Apple returns $49.99 to user

IMMEDIATELY:
         → Webhook: REFUND
         → tier: 'seeker' (IMMEDIATE DOWNGRADE ⚠️)
         → playbooks_limit: 0 (IMMEDIATE LOSS ⚠️)
         → devotionals_limit: 0 (IMMEDIATE LOSS ⚠️)
         → smart_journaling_enabled: false (DISABLED ⚠️)
         → billing_cycle: null (CLEARED ⚠️)
         → subscription_end_date: NOW (SET TO CURRENT TIME ⚠️)
         → refund_date: NOW
         → status: 'refunded'

User Experience:
         → ❌ Loses Spark tier IMMEDIATELY
         → ❌ Loses all remaining usage (even if 185 days left)
         → ❌ Cannot generate playbooks/devotionals
         → ❌ Smart journaling disabled
         → ❌ No grace period
         → ❌ No pro-rated access
         → ✅ Downgraded to Seeker free tier
```

**Comparison: Cancellation vs Refund**

| Aspect | Cancellation | Refund |
|--------|--------------|--------|
| **Money** | No refund, already charged | Full refund from Apple |
| **Access** | Keep until period ends | Lose immediately |
| **Remaining Usage** | Honored | Not honored |
| **Monthly Refreshes (Annual)** | Continue | Stop immediately |
| **Grace Period** | Not applicable | None |
| **Downgrade Timing** | On subscription_end_date | Immediate |

**Code Reference:**
```typescript
// From AppleWebhookHandler.ts lines 321-351
case 'REFUND':
  // Revert to seeker tier
  const seekerLimits = NewSubscriptionService.getTierLimits('seeker');
  
  await supabase
    .from('user_subscriptions_new')
    .update({
      tier: 'seeker',
      subscription_display_name: 'siFia Seeker',
      playbooks_limit: seekerLimits.playbooks_limit, // 0
      devotionals_limit: seekerLimits.devotionals_limit, // 0
      playbooks_used: 0,
      devotionals_used: 0,
      smart_journaling_enabled: seekerLimits.smart_journaling_enabled, // false
      refund_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
```

**Why So Harsh?**
- User received money back → They should not keep service
- Apple policy: Refund = Full reversal of transaction
- No partial refunds in App Store (it's all or nothing)
- Prevents abuse (can't use service for 6 months then refund)

---

## Summary Table: Post-Subscription Actions

| Action | Monthly Behavior | Annual Behavior |
|--------|------------------|-----------------|
| **Keep Active** | Resets every 30 days via webhook | Resets every 30 days via client-side |
| **Cancel** | Keep access until Day 30, NO MORE RESETS | Keep access until Day 365, RESETS CONTINUE |
| **Refund** | IMMEDIATE loss, downgrade to Seeker | IMMEDIATE loss, downgrade to Seeker |
| **Payment Fail** | Grace period 3 days, then downgrade | Grace period 3 days, then downgrade |

---

## Key Technical Points

### Monthly Subscriptions Reset Mechanism
```typescript
// ONLY via Apple webhook
case 'DID_RENEW':
  // Reset usage
  playbooks_used = 0
  devotionals_used = 0
  subscription_start_date = NOW
  subscription_end_date = NOW + 30 days
```

### Annual Subscriptions Reset Mechanism
```typescript
// Via client-side calculation
function checkAndResetMonthlyUsage() {
  // Check every generation attempt
  if (billing_cycle === 'annual') {
    // Calculate 30-day periods from billing anchor
    if (new 30-day period detected) {
      // Reset usage
      playbooks_used = 0
      devotionals_used = 0
      last_usage_reset = NOW
    }
  }
}
```

### Why Different Mechanisms?
- **Monthly:** Apple charges every 30 days → Webhook fires → Perfect trigger for reset
- **Annual:** Apple charges once/year → Need client-side calculation for monthly refreshes within the year

---

## Testing Verification Commands

### Check Subscription Status
```sql
SELECT 
  user_id,
  tier,
  billing_cycle,
  auto_renew_enabled,
  cancellation_date,
  subscription_start_date,
  subscription_end_date,
  playbooks_used,
  playbooks_limit,
  devotionals_used,
  devotionals_limit,
  last_usage_reset
FROM user_subscriptions_new
WHERE user_id = 'USER_ID';
```

### Check If Monthly Reset Should Fire (Annual)
```sql
SELECT 
  user_id,
  tier,
  billing_cycle,
  subscription_start_date,
  last_usage_reset,
  EXTRACT(EPOCH FROM (NOW() - subscription_start_date)) / 86400 as days_since_start,
  FLOOR(EXTRACT(EPOCH FROM (NOW() - subscription_start_date)) / 86400 / 30) as current_period,
  subscription_start_date + (FLOOR(EXTRACT(EPOCH FROM (NOW() - subscription_start_date)) / 86400 / 30) * INTERVAL '30 days') as current_period_start,
  CASE 
    WHEN last_usage_reset < subscription_start_date + (FLOOR(EXTRACT(EPOCH FROM (NOW() - subscription_start_date)) / 86400 / 30) * INTERVAL '30 days') 
    THEN 'SHOULD RESET'
    ELSE 'NO RESET NEEDED'
  END as reset_status
FROM user_subscriptions_new
WHERE user_id = 'USER_ID' AND billing_cycle = 'annual';
```

---

**Document Version:** 1.0  
**Created:** December 13, 2024  
**Last Updated:** December 13, 2024
