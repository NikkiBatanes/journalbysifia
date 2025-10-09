# Subscription Flow Diagram

## 📊 Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER STARTS ONBOARDING                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              OnboardingSalesOfferScreen                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Monthly / Annual Toggle                                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Spark      - $7.99/mo  or $79.99/yr                   │    │
│  │  Growth     - $14.99/mo or $149.99/yr  ← POPULAR       │    │
│  │  Transform  - $24.99/mo or $249.99/yr                  │    │
│  │  Family     - $44.99/mo or $449.99/yr                  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  [Continue My Journey] ← PAID SUBSCRIPTION              │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [X] Cancel button (top right)                                  │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ User taps                          │ User taps
             │ "Continue My Journey"              │ "X" button
             ▼                                    ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  PAID SUBSCRIPTION FLOW      │    │  FREE TRIAL FLOW             │
└──────────────────────────────┘    └──────────────────────────────┘
             │                                    │
             ▼                                    ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ OnboardingPaymentProcessing  │    │ OnboardingTrialOfferScreen   │
│                              │    │                              │
│ Parameters:                  │    │ ┌──────────────────────────┐ │
│ - selectedTier: 'growth'     │    │ │ Monthly / Annual Toggle  │ │
│ - isAnnual: true/false       │    │ └──────────────────────────┘ │
│ - isTrial: FALSE ✅          │    │                              │
│ - trialDays: 0               │    │ "Not sure yet?"              │
│ - price: $149.99             │    │ "Try 3 days free"            │
│                              │    │                              │
│ Creates:                     │    │ ┌──────────────────────────┐ │
│ - tier: 'growth'             │    │ │ [Start Free Trial]       │ │
│ - playbooks_limit: 20        │    │ └──────────────────────────┘ │
│ - devotionals_limit: 20      │    │                              │
│ - trial_start_date: NULL     │    │ [X] Cancel button            │
│ - trial_end_date: NULL       │    └──────────┬───────────────────┘
│                              │               │
│ User gets FULL ACCESS        │               │ User taps
│ immediately ✅               │               │ "Start Free Trial"
└──────────────────────────────┘               ▼
                                   ┌──────────────────────────────┐
                                   │ OnboardingPaymentProcessing  │
                                   │                              │
                                   │ Parameters:                  │
                                   │ - selectedTier: 'growth'     │
                                   │ - isAnnual: true/false       │
                                   │ - isTrial: TRUE ✅           │
                                   │ - trialDays: 3               │
                                   │ - billing_cycle: 'annual'    │
                                   │                              │
                                   │ Creates:                     │
                                   │ - tier: 'free_trial'         │
                                   │ - playbooks_limit: 2         │
                                   │ - devotionals_limit: 2       │
                                   │ - trial_start_date: NOW      │
                                   │ - trial_end_date: NOW+3days  │
                                   │ - trial_chosen_tier: 'growth'│
                                   │                              │
                                   │ User gets LIMITED ACCESS     │
                                   │ for 3 days ✅                │
                                   └──────────┬───────────────────┘
                                              │
                                              │ After 3 days
                                              ▼
                                   ┌──────────────────────────────┐
                                   │ Apple Charges User           │
                                   │                              │
                                   │ Amount: $149.99 (annual)     │
                                   │    or   $14.99 (monthly)     │
                                   │                              │
                                   │ Based on billing_cycle       │
                                   │ selected in trial offer      │
                                   └──────────┬───────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────────────┐
                                   │ convertTrialToPaid()         │
                                   │                              │
                                   │ Updates:                     │
                                   │ - tier: 'growth'             │
                                   │ - playbooks_limit: 20        │
                                   │ - devotionals_limit: 20      │
                                   │                              │
                                   │ User gets FULL ACCESS ✅     │
                                   └──────────────────────────────┘
```

---

## 🎯 Key Differences

### Sales Offer Screen (Paid)
```
✅ Shows all tiers with prices
✅ Has Monthly/Annual toggle
✅ "Continue My Journey" button
✅ NO trial - immediate payment
✅ Creates PAID subscription
✅ Full limits (20/20 for Growth)
✅ User charged immediately
```

### Trial Offer Screen (Free Trial)
```
✅ Shows trial benefits
✅ Has Monthly/Annual toggle ← NEW!
✅ "Start Free Trial" button
✅ 3-day FREE trial
✅ Creates TRIAL subscription
✅ Limited limits (2/2)
✅ User charged after 3 days
```

---

## 📋 Product IDs Used

### For Paid Subscriptions (Sales Offer):
```
app.sifia.com.spark.monthly       → $7.99/month
app.sifia.com.spark.annual        → $79.99/year
app.sifia.com.growth.monthly      → $14.99/month
app.sifia.com.growth.annual       → $149.99/year
app.sifia.com.transformation.monthly → $24.99/month
app.sifia.com.transformation.annual  → $249.99/year
app.sifia.com.family.monthly      → $44.99/month
app.sifia.com.family.annual       → $449.99/year
```

### For Free Trials (Trial Offer):
```
app.sifia.com.spark.monthly.freetrial       → 3 days free, then $7.99/month
app.sifia.com.spark.annual.freetrial        → 3 days free, then $79.99/year
app.sifia.com.growth.monthly.freetrial      → 3 days free, then $14.99/month
app.sifia.com.growth.annual.freetrial       → 3 days free, then $149.99/year
app.sifia.com.transformation.monthly.freetrial → 3 days free, then $24.99/month
app.sifia.com.transformation.annual.freetrial  → 3 days free, then $249.99/year
app.sifia.com.family.monthly.freetrial      → 3 days free, then $44.99/month
app.sifia.com.family.annual.freetrial       → 3 days free, then $449.99/year
```

---

## 🔄 Navigation Flow

```
OnboardingSalesOfferScreen
    │
    ├─ User taps "Continue My Journey"
    │   └─> OnboardingPaymentProcessingScreen (isTrial: false)
    │       └─> OnboardingNotificationSetup
    │           └─> MainTabs (Dashboard)
    │
    └─ User taps "X" button
        └─> OnboardingTrialOfferScreen
            │
            ├─ User taps "Start Free Trial"
            │   └─> OnboardingPaymentProcessingScreen (isTrial: true)
            │       └─> OnboardingNotificationSetup
            │           └─> MainTabs (Dashboard)
            │
            └─ User taps "X" button
                └─> OnboardingNotificationSetup (as seeker)
                    └─> MainTabs (Dashboard)
```

---

## 💾 Database States

### After Paid Subscription (Sales Offer):
```sql
SELECT * FROM user_subscriptions_new WHERE user_id = '<user-id>';

tier: 'growth'
status: 'active'
playbooks_limit: 20
devotionals_limit: 20
trial_start_date: NULL
trial_end_date: NULL
trial_chosen_tier: NULL
```

### After Free Trial (Trial Offer):
```sql
SELECT * FROM user_subscriptions_new WHERE user_id = '<user-id>';

tier: 'free_trial'
status: 'active'
playbooks_limit: 2
devotionals_limit: 2
trial_start_date: '2025-10-10T00:00:00Z'
trial_end_date: '2025-10-13T00:00:00Z'
trial_chosen_tier: 'growth'
```

### After Trial Converts to Paid:
```sql
SELECT * FROM user_subscriptions_new WHERE user_id = '<user-id>';

tier: 'growth'
status: 'active'
playbooks_limit: 20
devotionals_limit: 20
trial_start_date: '2025-10-10T00:00:00Z'  ← Kept for reference
trial_end_date: '2025-10-13T00:00:00Z'    ← Kept for reference
trial_chosen_tier: 'growth'                ← Kept for reference
```

---

## ✅ Testing Checklist

### Test 1: Paid Subscription (Sales Offer)
- [ ] Navigate to OnboardingSalesOfferScreen
- [ ] Toggle between Monthly/Annual
- [ ] Select Growth tier
- [ ] Tap "Continue My Journey"
- [ ] Verify: isTrial = false in logs
- [ ] Verify: tier = 'growth' in database
- [ ] Verify: limits = 20/20
- [ ] Verify: No trial dates

### Test 2: Free Trial (Trial Offer)
- [ ] Navigate to OnboardingSalesOfferScreen
- [ ] Tap "X" button
- [ ] OnboardingTrialOfferScreen appears
- [ ] Toggle between Monthly/Annual
- [ ] Tap "Start Free Trial"
- [ ] Verify: isTrial = true in logs
- [ ] Verify: tier = 'free_trial' in database
- [ ] Verify: limits = 2/2
- [ ] Verify: Trial dates set

### Test 3: Trial to Paid Conversion
- [ ] Wait 3 days (or 3 minutes in sandbox)
- [ ] Apple charges user
- [ ] Verify: tier = 'growth' in database
- [ ] Verify: limits = 20/20
- [ ] Verify: Trial dates preserved

---

## 🎯 Summary

**Sales Offer Screen:**
- ✅ Paid subscription
- ✅ Full access immediately
- ✅ Monthly/Annual toggle
- ✅ No trial

**Trial Offer Screen:**
- ✅ Free trial
- ✅ Limited access (2/2)
- ✅ Monthly/Annual toggle ← NOW WORKING!
- ✅ Converts to paid after 3 days

**Both screens now have billing cycle selection!** 🎉
