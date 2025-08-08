# 🎯 Complete Subscription Flow: Free Trial → Billing

## 📱 Free Trial Modal Flow

### Modal Structure
```
┌─────────────────────────────────────┐
│        🎉 Start Your Free Trial     │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │ Monthly │  │ Annually│  ← Tabs   │
│  └─────────┘  └─────────┘          │
│                                     │
│  ┌─ Starter ──────────────────────┐ │
│  │ $6.99/month                    │ │
│  │ 8 playbooks, 8 devotionals    │ │
│  │ [Start 3-Day Free Trial] ←─────┼─│ User taps this
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ Growth ───────────────────────┐ │
│  │ $12.99/month                   │ │
│  │ 20 playbooks, 20 devotionals  │ │
│  │ [Start 3-Day Free Trial]       │ │
│  └────────────────────────────────┘ │
│                                     │
│  ... (other tiers)                 │
└─────────────────────────────────────┘
```

## 🔄 Complete User Flow

### Scenario: User Selects "Starter Annual" with Free Trial

#### Step 1: User Action
```typescript
// User taps "Start 3-Day Free Trial" on Starter Annual
const selectedPlan = {
  tier: 'starter_annual',
  displayName: 'Starter',
  billing: 'annual',
  price: 4999, // $49.99 annually
  currency: 'usd',
  trialDays: 3
};
```

#### Step 2: Create Trial Subscription
```typescript
// Create subscription record
const subscription = {
  user_id: userId,
  tier: 'free_trial', // Always free_trial during trial
  status: 'trialing',
  trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
  
  // Store the plan they'll be billed for after trial
  pending_tier: 'starter_annual',
  pending_price_cents: 4999,
  pending_currency: 'usd',
  pending_interval: 'year',
  
  created_at: new Date(),
  updated_at: new Date()
};
```

#### Step 3: Trial Period (Days 1-3)
- User has `free_trial` tier
- Gets 2 playbooks, 2 devotionals
- Full access to trial features
- App shows "Trial ends in X days"

#### Step 4: Trial Expiration (Day 4)
```typescript
// Automatic billing transition
await handleTrialExpiration(userId);

// This function will:
// 1. Charge the user for starter_annual ($49.99)
// 2. If payment succeeds:
//    - Update tier to 'starter_annual'
//    - Update status to 'active'
//    - Set next_billing_date to 1 year from now
// 3. If payment fails:
//    - Move to 'basic' tier (freemium)
//    - Update status to 'trial_expired'
```

## 💳 Database Schema Updates

I've updated the `user_subscriptions` table with pending billing fields:

```sql
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS pending_tier subscription_tier;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS pending_price_cents INTEGER;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS pending_currency TEXT DEFAULT 'usd';
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS pending_interval TEXT;
```

## 🔄 Complete Flow Summary

### User Journey:
1. **User sees pricing** → Monthly/Annual tabs
2. **User selects plan** → "Start 3-Day Free Trial" button  
3. **Trial begins** → User gets `free_trial` tier (2 playbooks, 2 devotionals)
4. **Pending billing stored** → System knows what to charge after trial
5. **Trial expires** → System attempts to charge for selected plan
6. **Billing success** → User gets paid tier (e.g., `starter_annual`)
7. **Billing fails** → User moves to `basic` (freemium)

### Database States:

**During Trial:**
```sql
SELECT * FROM user_subscriptions WHERE user_id = 'user123';
-- tier: 'free_trial'
-- status: 'trialing' 
-- pending_tier: 'starter_annual'
-- pending_price_cents: 4999
-- trial_end_date: '2025-01-11T03:00:00Z'
```

**After Successful Billing:**
```sql
-- tier: 'starter_annual'
-- status: 'active'
-- pending_tier: null
-- next_billing_date: '2026-01-08T03:00:00Z' (1 year later)
```

**After Failed Billing:**
```sql
-- tier: 'basic'
-- status: 'trial_expired'
-- pending_tier: null
```

## 🎯 Key Benefits of This Flow:

1. **Clear expectations** - User knows exactly what they'll be charged
2. **Flexible billing** - Supports both monthly and annual
3. **Graceful fallback** - Failed payments don't break the app
4. **Analytics friendly** - Track conversion rates by plan type
5. **User-friendly** - Simple trial experience with clear next steps

This flow ensures users understand exactly what they're signing up for and provides a smooth transition from trial to paid subscription! 🚀

<function_calls>
<invoke name="view_file">
<parameter name="toolSummary">checking current schema
