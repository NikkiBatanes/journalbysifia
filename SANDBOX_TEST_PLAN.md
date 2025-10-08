# Sandbox Testing Plan
**Test Account:** nikki.batanes+sandboxtester@sifia.app  
**Password:** abcdefgH8.  
**Date:** 2025-10-08

---

## 🎯 Test Objectives
1. Verify **Trial Flow** creates `free_trial` tier with 2/2 limits
2. Verify **Sales Offer Flow** creates paid tier with full limits
3. Verify **Trial-to-Paid Conversion** upgrades correctly
4. Verify **Apple Sign-In** returning user goes to dashboard

---

## 📋 Pre-Test Setup

### 1. Clean Database State
Before each test, ensure clean state:
```sql
-- Check current subscription
SELECT * FROM user_subscriptions_new WHERE user_id = '<your-user-id>';

-- Reset to seeker if needed
UPDATE user_subscriptions_new 
SET tier = 'seeker', 
    status = 'active',
    trial_start_date = NULL,
    trial_end_date = NULL,
    trial_chosen_tier = NULL,
    playbooks_limit = 0,
    devotionals_limit = 0
WHERE user_id = '<your-user-id>';
```

### 2. Device Setup
- **Device:** iPhone Simulator or Physical Device
- **iOS Version:** 15.0+
- **App Store:** Sandbox environment
- **Network:** Connected

---

## 🧪 TEST 1: Trial Flow (OnboardingTrialOfferScreen)

### Prerequisites
- User has never started a trial before
- `trial_start_date` is NULL in database

### Steps
1. **Sign in** with sandbox account
2. **Navigate** to OnboardingTrialOfferScreen
3. **Tap** "Start Free Trial" button
4. **Observe** navigation to OnboardingPaymentProcessingScreen
5. **Wait** for processing (2 seconds)
6. **Check** console logs
7. **Verify** database

### Expected Results

#### Console Logs Should Show:
```
[OnboardingTrialOffer] Starting trial...
[OnboardingPaymentProcessing] Screen mounted with user: <user-id>
[OnboardingPaymentProcessing] Route params: {
  selectedTier: 'growth',
  isAnnual: true,
  isTrial: true,
  trialDays: 3
}
[NewSubscriptionService] Creating trial with data: {
  tier: 'free_trial',
  playbooks_limit: 2,
  devotionals_limit: 2,
  trial_chosen_tier: 'growth'
}
[NewSubscriptionService] ✅ Trial subscription created
```

#### Database Should Show:
```sql
SELECT 
  tier,
  status,
  playbooks_limit,
  devotionals_limit,
  trial_start_date,
  trial_end_date,
  trial_chosen_tier
FROM user_subscriptions_new 
WHERE user_id = '<your-user-id>';
```

**Expected Values:**
- `tier`: `'free_trial'` ✅
- `status`: `'active'` ✅
- `playbooks_limit`: `2` ✅
- `devotionals_limit`: `2` ✅
- `trial_start_date`: `<current-date>` ✅
- `trial_end_date`: `<current-date + 3 days>` ✅
- `trial_chosen_tier`: `'growth'` ✅

#### App Behavior:
- ✅ User can create 2 playbooks
- ✅ User can create 2 devotionals
- ✅ Smart journaling enabled
- ✅ Dashboard shows "Free Trial" badge
- ✅ Trial countdown visible

### Pass Criteria
- [ ] Console logs match expected output
- [ ] Database tier is `free_trial`
- [ ] Limits are 2/2
- [ ] Trial dates are set correctly
- [ ] Chosen tier is stored

---

## 🧪 TEST 2: Sales Offer Flow (OnboardingSalesOfferScreen)

### Prerequisites
- User has clean subscription state
- Reset database to seeker tier

### Steps
1. **Reset** subscription to seeker (see Pre-Test Setup)
2. **Sign in** with sandbox account
3. **Navigate** to OnboardingSalesOfferScreen
4. **Select** Growth tier (Annual)
5. **Tap** "Continue My Journey" button
6. **Observe** navigation to OnboardingPaymentProcessingScreen
7. **Wait** for processing (2 seconds)
8. **Check** console logs
9. **Verify** database

### Expected Results

#### Console Logs Should Show:
```
[OnboardingSalesOffer] Onboarding mode - navigating to PAID subscription processing
{
  selectedTier: 'growth',
  isAnnual: true,
  price: 149.99,
  isTrial: false
}
[OnboardingPaymentProcessing] Screen mounted with user: <user-id>
[OnboardingPaymentProcessing] Route params: {
  selectedTier: 'growth',
  isAnnual: true,
  isTrial: false,
  trialDays: 0
}
[NewSubscriptionService] Creating subscription with tier: growth
[NewSubscriptionService] ✅ Subscription created: {
  tier: 'growth',
  playbooks_limit: 20,
  devotionals_limit: 20
}
```

#### Database Should Show:
```sql
SELECT 
  tier,
  status,
  playbooks_limit,
  devotionals_limit,
  trial_start_date,
  trial_end_date
FROM user_subscriptions_new 
WHERE user_id = '<your-user-id>';
```

**Expected Values:**
- `tier`: `'growth'` ✅
- `status`: `'active'` ✅
- `playbooks_limit`: `20` ✅
- `devotionals_limit`: `20` ✅
- `trial_start_date`: `NULL` ✅
- `trial_end_date`: `NULL` ✅

#### App Behavior:
- ✅ User can create 20 playbooks
- ✅ User can create 20 devotionals
- ✅ Smart journaling enabled
- ✅ Dashboard shows "Growth" tier
- ✅ No trial countdown

### Pass Criteria
- [ ] Console logs show `isTrial: false`
- [ ] Database tier is `growth` (not `free_trial`)
- [ ] Limits are 20/20 (not 2/2)
- [ ] No trial dates set
- [ ] Full access immediately

---

## 🧪 TEST 3: Trial to Paid Conversion

### Prerequisites
- User has active trial (from TEST 1)
- Trial has NOT expired yet

### Steps
1. **Verify** user is on `free_trial` tier
2. **Simulate** Apple payment confirmation
3. **Call** `convertTrialToPaid` method
4. **Check** database update
5. **Verify** limits upgraded

### Expected Results

#### Before Conversion:
```
tier: 'free_trial'
playbooks_limit: 2
devotionals_limit: 2
```

#### After Conversion:
```
tier: 'growth'
playbooks_limit: 20
devotionals_limit: 20
```

#### Console Logs:
```
[NewSubscriptionService] Converting trial to paid: {
  from: 'free_trial',
  to: 'growth',
  limits: {playbooks_limit: 20, devotionals_limit: 20}
}
[NewSubscriptionService] ✅ Trial converted to paid
```

### Pass Criteria
- [ ] Tier upgraded from `free_trial` to `growth`
- [ ] Limits upgraded from 2/2 to 20/20
- [ ] Trial dates preserved for reference
- [ ] User has full access

---

## 🧪 TEST 4: Apple Sign-In Returning User

### Prerequisites
- User has completed onboarding before
- `onboarding_completed` = `true` in database

### Steps
1. **Sign out** from app
2. **Close** app completely
3. **Open** app
4. **Tap** "Sign in with Apple"
5. **Authenticate** with Face ID/Touch ID
6. **Observe** navigation

### Expected Results

#### Console Logs Should Show:
```
🔍 Checking onboarding status for user: <user-id>
🔍 Post-signin onboarding check: {
  userId: '<user-id>',
  hasCompleted: true,
  profileData: {onboarding_completed: true}
}
🚀 User completed onboarding - forcing navigation to MainTabs
✅ Set force navigation flag and redirect to MainTabs
```

#### App Behavior:
- ✅ User goes directly to Dashboard (MainTabs)
- ✅ Does NOT go to onboarding
- ✅ Subscription data loaded
- ✅ User can access all features

### Pass Criteria
- [ ] Console shows `hasCompleted: true`
- [ ] Navigation goes to MainTabs
- [ ] Does NOT go to OnboardingPersonalization
- [ ] User sees dashboard immediately

---

## 🧪 TEST 5: Apple Sign-In New User

### Prerequisites
- Use a NEW Apple ID (not used before)
- No profile in database

### Steps
1. **Sign in** with NEW Apple ID
2. **Observe** navigation

### Expected Results
- ✅ User goes to OnboardingPersonalization
- ✅ Profile created with `onboarding_completed: false`
- ✅ Default seeker subscription created

### Pass Criteria
- [ ] Navigation goes to OnboardingPersonalization
- [ ] Profile created in database
- [ ] Subscription created with seeker tier

---

## 📊 Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| TEST 1: Trial Flow | ⬜ | |
| TEST 2: Sales Offer Flow | ⬜ | |
| TEST 3: Trial to Paid Conversion | ⬜ | |
| TEST 4: Apple Sign-In Returning User | ⬜ | |
| TEST 5: Apple Sign-In New User | ⬜ | |

**Legend:**
- ✅ Pass
- ❌ Fail
- ⬜ Not Tested

---

## 🐛 Known Issues to Watch For

### Issue 1: Black Screen on Hot Reload
- **Status:** Fixed
- **Watch for:** Screen going black after hot reload
- **Expected:** No black screen, app stays on current screen

### Issue 2: Sales Offer Creating Trial
- **Status:** Fixed
- **Watch for:** Sales offer creating `free_trial` tier
- **Expected:** Sales offer creates `growth` tier with 20/20 limits

### Issue 3: Returning User to Onboarding
- **Status:** Fixed
- **Watch for:** Returning Apple user sent to onboarding
- **Expected:** Returning user goes to dashboard

---

## 🔍 Debugging Tips

### Check User ID
```javascript
// In console
console.log('User ID:', user?.id);
```

### Check Subscription
```sql
SELECT * FROM user_subscriptions_new WHERE user_id = '<user-id>';
```

### Check Profile
```sql
SELECT * FROM user_profiles WHERE id = '<user-id>';
```

### Check Onboarding Progress
```sql
SELECT * FROM onboarding_progress WHERE user_id = '<user-id>';
```

### Clear AsyncStorage (if needed)
```javascript
// In React Native Debugger
AsyncStorage.clear();
```

---

## 📝 Notes

### Sandbox Account Details
- **Email:** nikki.batanes+sandboxtester@sifia.app
- **Password:** abcdefgH8.
- **Environment:** Sandbox
- **Purpose:** Testing subscription flows

### Important Reminders
1. Always check console logs for detailed flow
2. Verify database state before and after each test
3. Reset to clean state between tests
4. Document any unexpected behavior
5. Take screenshots of failures

---

## ✅ Final Checklist

Before marking tests complete:
- [ ] All console logs match expected output
- [ ] Database values are correct
- [ ] App behavior matches requirements
- [ ] No errors in console
- [ ] Navigation works correctly
- [ ] Limits are enforced properly
- [ ] Trial dates are accurate
- [ ] Paid subscriptions have full access

---

## 🚀 Next Steps After Testing

If all tests pass:
1. ✅ Mark all tests as passed
2. ✅ Document any edge cases found
3. ✅ Test on physical device
4. ✅ Test with real Apple Sandbox account
5. ✅ Prepare for production testing

If any tests fail:
1. ❌ Document the failure
2. ❌ Check console logs
3. ❌ Verify database state
4. ❌ Report issue with details
5. ❌ Fix and retest
