# Apple StoreKit 2 - Complete Flow Analysis
**Last Updated:** December 13, 2024  
**Status:** Production Implementation Review

## Executive Summary

This document provides a comprehensive analysis of all subscription scenarios in the siFia app, covering trial flows, auto-renewable subscriptions, cancellations, refunds, and edge cases.

---

## 1. Three-Day Trial Flow

### 1.1 Trial Start (Day 0)
**User Action:** User selects a tier (Spark/Growth/Transformation) and starts 3-day free trial

**What Happens:**
1. Apple processes the purchase with `.freetrial` product ID
2. App receives transaction immediately
3. `TrialManagementService.createTrial()` is called:
   ```typescript
   // Sets user to free_trial tier
   tier: 'free_trial'
   trial_start_date: NOW
   trial_end_date: NOW + 3 days
   trial_chosen_tier: 'spark' | 'growth' | 'transformation'
   billing_cycle: 'monthly' | 'annual'
   
   // Trial limits (2/2 regardless of chosen tier)
   playbooks_limit: 2
   devotionals_limit: 2
   playbooks_used: 0
   devotionals_used: 0
   ```

4. User gets 2 playbooks + 2 devotionals for 3 days
5. Apple webhook `DID_RENEW` fires but is SKIPPED (app already handled setup)

**Key Files:**
- `/src/services/TrialManagementService.ts` (lines 37-126)
- `/supabase/functions/apple-webhook/index.ts` (lines 149-167)

---

### 1.2 Trial Cancelled Before 3 Days End
**User Action:** User goes to iOS Settings → Subscriptions → Cancel

**What Happens:**
1. Apple sends webhook: `DID_CHANGE_RENEWAL_STATUS` with subtype `AUTO_RENEW_DISABLED`
2. Webhook handler processes cancellation:
   ```typescript
   // For trial users
   trial_cancelled_date: NOW
   // IMPORTANT: User keeps trial access until trial_end_date
   // tier stays 'free_trial'
   // playbooks_limit/devotionals_limit unchanged
   // User can finish remaining usage (e.g., 1/2 used → can still use 1 more)
   ```

3. **User Experience:**
   - Keeps trial tier and features until trial_end_date expires
   - Can still generate playbooks/devotionals up to 2/2 limit
   - On trial_end_date: Background job or webhook reverts to Seeker (0/0 limits)

4. **No charge from Apple** - Trial cancelled before billing

**Key Files:**
- `/src/services/AppleWebhookHandler.ts` (lines 167-177)
- `/supabase/functions/apple-webhook/index.ts` (lines 258-270)

---

### 1.3 Trial NOT Cancelled (Auto-Conversion on Day 3)
**User Action:** User does nothing, lets trial expire

**What Happens:**
1. **Day 3 at 23:59:** Trial period ends
2. **Apple automatically charges user** for first paid period (monthly or annual)
3. Apple sends webhook: `DID_RENEW` with `offerType: 1` (introductory)
4. Webhook handler detects trial conversion:
   ```typescript
   // Condition: subscription.tier === 'free_trial' && offerType === 1
   
   // Updates to paid tier
   tier: 'spark' | 'growth' | 'transformation' (from trial_chosen_tier)
   subscription_display_name: 'siFia Spark' (removes "Trial")
   billing_cycle: 'monthly' | 'annual' (from product ID)
   
   // Full paid limits
   playbooks_limit: 10 (Spark) | 25 (Growth) | 999999 (Transformation)
   devotionals_limit: 10 (Spark) | 25 (Growth) | 999999 (Transformation)
   
   // Reset usage for fresh start
   playbooks_used: 0
   devotionals_used: 0
   
   // Set billing dates
   subscription_start_date: NOW (billing anchor)
   subscription_end_date: NOW + 30 days (monthly) OR NOW + 365 days (annual)
   trial_converted_date: NOW
   ```

5. User is now on paid subscription with full limits

**Key Files:**
- `/src/services/AppleWebhookHandler.ts` (lines 106-126)
- `/supabase/functions/apple-webhook/index.ts` (lines 168-212)

---

## 2. Auto-Renewable Monthly Subscriptions

### 2.1 Monthly Renewal & Monthly Refresh
**Scenario:** User has Spark Monthly ($4.99/month) → 8 playbooks/month, 8 devotionals/month

**What Happens Every 30 Days:**
1. **Day 30:** Apple automatically charges user for next month
2. Apple sends webhook: `DID_RENEW` (without offerType, or offerType ≠ 1)
3. Webhook handler processes renewal:
   ```typescript
   // Reset monthly usage counters
   playbooks_used: 0
   devotionals_used: 0
   last_usage_reset: NOW
   
   // Update billing cycle dates
   subscription_start_date: NOW (new billing anchor)
   subscription_end_date: NOW + 30 days
   
   // Clear any billing issues
   billing_issue: false
   grace_period_end_date: null
   
   // Update transaction ID
   platform_transaction_id: NEW_TRANSACTION_ID
   ```

4. **User gets fresh 10/10 limits every 30 days**

**Critical Implementation Detail:**
- Monthly subscriptions ONLY reset via `DID_RENEW` webhook
- No client-side resets
- No cron jobs needed
- Apple handles timing automatically

**Key Files:**
- `/src/services/AppleWebhookHandler.ts` (lines 127-149)
- `/supabase/functions/apple-webhook/index.ts` (lines 213-253)

---

### 2.2 Monthly Subscription Cancelled
**User Action:** User cancels Spark Monthly subscription

**What Happens:**
1. Apple sends webhook: `DID_CHANGE_RENEWAL_STATUS` with subtype `AUTO_RENEW_DISABLED`
2. Webhook handler marks cancellation:
   ```typescript
   auto_renew_enabled: false
   cancellation_date: NOW
   
   // CRITICAL: User keeps full access
   // tier: 'spark' (unchanged)
   // playbooks_limit: 10 (unchanged)
   // devotionals_limit: 10 (unchanged)
   // playbooks_used: current usage (unchanged)
   // User keeps access until subscription_end_date
   ```

3. **User Experience:**
   - Keeps Spark tier and remaining usage until end of current billing period
   - Example: Cancelled on Day 15 with 3/8 playbooks used → Can still use 5 more until Day 30
   - **NO MORE DID_RENEW webhooks fire after cancellation**
   - **Therefore: NO MORE USAGE RESETS**

4. **On subscription_end_date (Day 30):**
   - Apple sends webhook: `EXPIRED`
   - Webhook handler reverts to Seeker:
   ```typescript
   tier: 'seeker'
   subscription_display_name: 'siFia Seeker'
   playbooks_limit: 0
   devotionals_limit: 0
   playbooks_used: 0
   devotionals_used: 0
   smart_journaling_enabled: false
   status: 'expired'
   ```

**Answer to Your Question:**
> **"if someone cancelled their subscription monthly will we stop refreshing?"**

**YES.** Once a monthly subscription is cancelled:
- No more `DID_RENEW` webhooks fire
- No more usage resets occur
- User keeps current tier/limits until expiration
- On expiration: Downgraded to Seeker (0/0)

**Key Files:**
- `/src/services/AppleWebhookHandler.ts` (lines 179-191)
- `/src/services/NewSubscriptionService.ts` (lines 630-641)
- `/supabase/functions/apple-webhook/index.ts` (lines 272-282)

---

## 3. Auto-Renewable Annual Subscriptions

### 3.1 Annual Subscription with Monthly Refreshes
**Scenario:** User has Spark Annual ($49.99/year) → 8 playbooks/month, 8 devotionals/month

**Critical Understanding:**
- Apple charges once per year (Day 365)
- Usage limits refresh monthly (every 30 days)
- Two separate mechanisms handle resets:
  1. **Year 1, Month 1-12:** Client-side monthly refresh via `checkAndResetMonthlyUsage()`
  2. **Year 2+:** Apple `DID_RENEW` webhook (annual renewal)

**Monthly Refresh Logic (Within Annual Subscription):**
```typescript
// Called before every playbook/devotional generation
checkAndResetMonthlyUsage(userId) {
  // Only for annual subscriptions
  if (billing_cycle !== 'annual') return false;
  
  // Calculate 30-day periods from billing anchor
  const billingAnchor = subscription_start_date
  const daysSinceAnchor = (NOW - billingAnchor) / days
  const currentPeriod = Math.floor(daysSinceAnchor / 30)
  const currentPeriodStart = billingAnchor + (currentPeriod × 30 days)
  
  // Check if we already reset for this period
  if (last_usage_reset < currentPeriodStart) {
    // NEW 30-day period → Reset usage
    playbooks_used = 0
    devotionals_used = 0
    last_usage_reset = NOW
    return true
  }
  
  return false
}
```

**Example Timeline:**
- **Day 0:** Purchase Spark Annual → 10/10 limits
- **Day 30:** Usage resets → 10/10 refreshed (client-side)
- **Day 60:** Usage resets → 10/10 refreshed (client-side)
- **Day 90:** Usage resets → 10/10 refreshed (client-side)
- ...continues every 30 days...
- **Day 360:** Usage resets → 10/10 refreshed (client-side)
- **Day 365:** Apple charges for Year 2 → `DID_RENEW` webhook resets usage

**Key Files:**
- `/src/services/NewSubscriptionService.ts` (lines 134-222)
- `/src/services/AppleWebhookHandler.ts` (lines 127-149)

---

### 3.2 Annual Subscription Cancelled (Mid-Year)
**Scenario:** User has Spark Annual, cancels on Day 180 (6 months in)

**What Happens:**
1. Apple sends webhook: `DID_CHANGE_RENEWAL_STATUS` with subtype `AUTO_RENEW_DISABLED`
2. Webhook handler marks cancellation:
   ```typescript
   auto_renew_enabled: false
   cancellation_date: Day 180
   
   // CRITICAL: User keeps annual tier and monthly refreshes
   tier: 'spark_annual' (unchanged)
   billing_cycle: 'annual' (unchanged)
   playbooks_limit: 10 (unchanged)
   devotionals_limit: 10 (unchanged)
   ```

3. **User Experience After Cancellation:**
   - **Keeps Spark Annual tier until Day 365** (paid for full year)
   - **Monthly refreshes CONTINUE** via `checkAndResetMonthlyUsage()`
   - Day 210: Usage resets → 10/10 refreshed ✅
   - Day 240: Usage resets → 10/10 refreshed ✅
   - Day 270: Usage resets → 10/10 refreshed ✅
   - ...continues until Day 365...

4. **On Day 365 (End of Annual Period):**
   - Apple sends webhook: `EXPIRED`
   - Webhook handler reverts to Seeker:
   ```typescript
   tier: 'seeker'
   subscription_display_name: 'siFia Seeker'
   playbooks_limit: 0
   devotionals_limit: 0
   billing_cycle: null
   status: 'expired'
   ```

**Answer to Your Question:**
> **"if someone cancelled their annual subscription. how will we handle it. what if it is in the middle of the year."**

**User gets full access for entire annual period:**
- Paid for 365 days → Gets 365 days of service
- Monthly refreshes CONTINUE (user paid for them)
- Keeps annual tier badge/features
- On Day 365: Subscription expires → Downgrade to Seeker

**Why Monthly Refreshes Continue:**
```typescript
// From NewSubscriptionService.checkAndResetMonthlyUsage()
// Lines 163-167

// CANCELLATION BEHAVIOR FOR ANNUAL:
// - User cancels → auto_renew_enabled: false, but tier stays annual
// - Monthly resets CONTINUE (user paid for full year)
// - Keeps annual badge/tier until expiration
// - On Day 365: EXPIRED webhook downgrades to Seeker
```

**Key Files:**
- `/src/services/NewSubscriptionService.ts` (lines 163-167)
- `/src/services/AppleWebhookHandler.ts` (lines 179-191)
- `/supabase/functions/apple-webhook/index.ts` (lines 272-282, 320-347)

---

## 4. Refund Scenarios

### 4.1 Apple Approves Refund
**Scenario:** User requests refund, Apple approves it

**What Happens:**
1. Apple sends webhook: `REFUND`
2. **IMMEDIATE ACTION** - No grace period:
   ```typescript
   // Instant downgrade to Seeker
   tier: 'seeker'
   subscription_display_name: 'siFia Seeker'
   playbooks_limit: 0
   devotionals_limit: 0
   playbooks_used: 0
   devotionals_used: 0
   smart_journaling_enabled: false
   
   // Clear billing data
   billing_cycle: null
   subscription_end_date: NOW (set to current time)
   
   // Mark refund
   refund_date: NOW
   status: 'refunded'
   ```

3. **User loses access immediately:**
   - No longer has paid tier features
   - No remaining usage honored
   - Smart journaling disabled
   - Reverted to Seeker (0/0 limits)

**Refund Types Handled:**
- Full refund of entire subscription
- Partial refunds (Apple treats as full REFUND webhook)
- Trial refunds (shouldn't happen, but handled same way)
- Annual refunds mid-year (no pro-rated access, immediate revert)

**Answer to Your Question:**
> **"what if someone refunded and apple approved"**

**Immediate loss of access:**
- User downgraded to Seeker instantly
- No grace period
- No remaining usage
- Even if annual subscription with 6 months left → Loses it all

**Key Files:**
- `/src/services/AppleWebhookHandler.ts` (lines 321-351)
- `/supabase/functions/apple-webhook/index.ts` (lines 350-376)

---

## 5. Edge Cases & Failsafes

### 5.1 Payment Failure (Grace Period)
**Scenario:** User's credit card is declined during renewal

**What Happens:**
1. Apple sends webhook: `DID_FAIL_TO_RENEW`
2. Webhook handler enters grace period:
   ```typescript
   billing_issue: true
   grace_period_end_date: NOW + 3 days
   
   // CRITICAL: User keeps tier but CANNOT generate new content
   tier: unchanged
   playbooks_limit: unchanged
   // But playbook/devotional generation is BLOCKED
   ```

3. **User Experience During Grace Period:**
   - Keeps subscription tier badge
   - **CANNOT generate playbooks/devotionals** (blocked in `checkUsageLimit()`)
   - Can still view existing content
   - See billing issue warning in UI
   - Has 3 days to update payment method

4. **If Payment Succeeds:**
   - Apple sends: `DID_RENEW`
   - Grace period cleared
   - Generation enabled again

5. **If Grace Period Expires (Day 3):**
   - Apple sends: `GRACE_PERIOD_EXPIRED`
   - Downgraded to Seeker (same as EXPIRED webhook)

**Key Files:**
- `/src/services/AppleWebhookHandler.ts` (lines 217-240, 281-315)
- `/src/services/NewSubscriptionService.ts` (lines 997-998, 1029-1031)

---

### 5.2 Webhook Failure Failsafe
**Scenario:** Apple webhook fails to deliver or process

**Failsafe Mechanism:**
```typescript
// In checkUsageLimit() - runs before every generation
// Lines 684-698 of NewSubscriptionService.ts

// Check if paid subscription has expired (webhook failsafe)
if (subscription.tier !== 'seeker' && 
    subscription.tier !== 'free_trial' && 
    subscription.subscription_end_date) {
  
  const subEnd = new Date(subscription.subscription_end_date)
  if (subEnd < NOW) {
    // Subscription expired but webhook didn't arrive
    // Downgrade now as failsafe
    await handleExpiredSubscription(userId)
    throw new SubscriptionError('Subscription has expired')
  }
}
```

**Protection Against:**
- Webhook delivery failures
- Network issues
- Processing delays
- User exploiting expired subscription

---

### 5.3 Trial Expiry Failsafe
**Two Mechanisms:**

**1. Real-time Check (Primary):**
```typescript
// In checkUsageLimit() before every generation
if (subscription.tier === 'free_trial' && subscription.trial_end_date) {
  const trialEnd = new Date(subscription.trial_end_date)
  if (trialEnd < NOW) {
    await handleExpiredTrial(userId)
    throw new TrialExpiredError(subscription.trial_end_date)
  }
}
```

**2. Background Job (Secondary):**
```sql
-- Database function: check_and_handle_expired_trials()
-- Can be called via cron job if needed
SELECT check_and_handle_expired_trials();
```

**Key Files:**
- `/src/services/NewSubscriptionService.ts` (lines 675-681, 774-782)
- `/database_schema.sql` (lines 50-82)

---

## 6. Critical Implementation Notes

### 6.1 Monthly vs Annual Reset Logic
```
MONTHLY SUBSCRIPTIONS:
├── Reset via: DID_RENEW webhook ONLY
├── Frequency: Every 30 days (when Apple charges)
├── Cancellation: No more DID_RENEW → No more resets
└── Implementation: Webhook-driven

ANNUAL SUBSCRIPTIONS:
├── Reset via: checkAndResetMonthlyUsage() client-side
├── Frequency: Every 30 days (calculated from billing anchor)
├── Cancellation: Resets CONTINUE until expiration
└── Implementation: Client-side calculation
```

### 6.2 Subscription End Date Calculation
```typescript
// Set on every renewal/conversion
if (billing_cycle === 'annual') {
  subscription_end_date = NOW + 365 days
} else {
  subscription_end_date = NOW + 30 days
}
```

**Used For:**
- Failsafe expiration checks
- UI display ("Renews on...")
- EXPIRED webhook trigger point
- Cancellation "access until" date

### 6.3 Transaction ID Management
```
original_transaction_id: Never changes, used for webhook user lookup
platform_transaction_id: Updates on each renewal with new transaction ID
platform_subscription_id: Subscription ID from Apple (stays same)
```

**Why Original Transaction ID Matters:**
- Apple webhooks send `originalTransactionId` (not `transactionId`)
- Used to find user across all renewals
- Critical for webhook processing

**Key Files:**
- `/src/services/TrialManagementService.ts` (line 83)
- `/supabase/functions/apple-webhook/index.ts` (lines 117-142)

---

## 7. Summary: All Scenarios

| Scenario | Immediate Effect | Monthly Refresh? | End Result |
|----------|------------------|------------------|------------|
| **Trial Start** | 2/2 limits for 3 days | No (trial period) | Converts or expires |
| **Trial Cancelled** | Keep access until trial_end_date | No (trial period) | Revert to Seeker on Day 3 |
| **Trial Converts** | Full paid limits, usage reset | Yes (per billing cycle) | Regular subscription |
| **Monthly Renewal** | Usage reset via webhook | Yes (every 30 days) | Continues until cancelled |
| **Monthly Cancelled** | Keep access until period end | **NO - Resets stop** | Expire to Seeker on Day 30 |
| **Annual Renewal** | Usage reset via webhook | Yes (every 30 days, client-side) | Continues for 365 days |
| **Annual Cancelled (Mid-Year)** | Keep access until year end | **YES - Resets continue** | Expire to Seeker on Day 365 |
| **Payment Failed** | Grace period, generation blocked | Paused during grace | Expire if not resolved in 3 days |
| **Refund Approved** | **IMMEDIATE revert to Seeker** | **NO - Access lost** | Downgraded immediately |
| **Subscription Expired** | Revert to Seeker | No (no subscription) | Seeker tier (0/0) |

---

## 8. Key Takeaways

### ✅ What Works Well
1. **Webhook-driven architecture** ensures real-time updates
2. **Client-side failsafes** protect against webhook failures
3. **Annual monthly refreshes** handled without webhooks (smart calculation)
4. **Grace periods** give users time to resolve payment issues
5. **Cancellation behavior** honors paid period (user keeps access)

### ⚠️ Critical Behaviors
1. **Monthly cancellation** = No more resets (DID_RENEW stops firing)
2. **Annual cancellation** = Resets continue (user paid for full year)
3. **Refunds** = Immediate loss of access (no grace period)
4. **Trial cancellation** = Keep access until trial expires
5. **Billing failure** = Keep tier but block generation

### 🔧 Technical Dependencies
1. **Apple webhook endpoint** must be configured in App Store Connect
2. **Supabase Edge Function** must be deployed and accessible
3. **Client-side checks** run on every generation attempt
4. **Database RLS policies** must allow webhook service role access

---

## 9. Testing Checklist

### Trial Flow
- [ ] Start trial → Verify 2/2 limits
- [ ] Cancel trial on Day 1 → Verify keeps access until Day 3
- [ ] Let trial convert → Verify charged and upgraded to full limits
- [ ] Try to start trial twice → Verify blocked

### Monthly Subscription
- [ ] Subscribe → Verify full limits
- [ ] Wait 30 days → Verify renewal and usage reset
- [ ] Cancel mid-cycle → Verify keeps access until period end
- [ ] After expiration → Verify downgrade to Seeker
- [ ] After cancellation → Verify NO usage resets

### Annual Subscription
- [ ] Subscribe → Verify full limits
- [ ] Wait 30 days → Verify usage reset (client-side)
- [ ] Wait 60, 90, 120 days → Verify monthly resets continue
- [ ] Cancel on Day 180 → Verify keeps access until Day 365
- [ ] After cancellation → Verify monthly resets STILL WORK
- [ ] After Day 365 → Verify downgrade to Seeker

### Refund
- [ ] Request refund → Verify immediate downgrade
- [ ] Check tier → Verify Seeker (0/0)
- [ ] Try to generate → Verify blocked

### Edge Cases
- [ ] Payment failure → Verify grace period
- [ ] Simulate webhook failure → Verify client-side failsafe
- [ ] Try generation with expired trial → Verify blocked
- [ ] Re-enable auto-renew after cancellation → Verify restored

---

## 10. Files Reference

**Core Services:**
- `/src/services/NewSubscriptionService.ts` - Main subscription logic
- `/src/services/TrialManagementService.ts` - Trial lifecycle
- `/src/services/AppleWebhookHandler.ts` - Webhook routing (TypeScript version)

**Webhook Endpoint:**
- `/supabase/functions/apple-webhook/index.ts` - Production webhook handler

**Database:**
- `/database_schema.sql` - Subscription table schema and functions

**Documentation:**
- `/docs/PAYMENT_FLOW_IMPLEMENTATION.md` - Payment integration guide
- This document - Complete flow analysis

---

**Document Version:** 1.0  
**Last Review:** December 13, 2024  
**Next Review:** Before App Store submission
