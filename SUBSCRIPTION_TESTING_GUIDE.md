# 🧪 Subscription Intelligence Testing Guide

## 🎯 Overview
This guide will help you test all the subscription intelligence features that were just deployed successfully!

## 📋 Pre-Testing Checklist
- ✅ Database schema deployed successfully
- ✅ Fixed `useAuth` import error
- ✅ All subscription tiers configured correctly
- ✅ Trial and cancellation logic updated

## 🔧 Testing Setup

### 1. Start Your Development Environment
```bash
cd /Users/nikkimaebatanes/CascadeProjects/siFia
npm start
# or
expo start
```

### 2. Database Connection Test
First, verify your database connection is working:
```bash
# Check if your Supabase connection is active
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
supabase.from('user_subscriptions').select('count').then(console.log);
"
```

## 🧪 Core Feature Tests

### Test 1: Subscription Tier System
**What to test:** Verify all subscription tiers work correctly

**Steps:**
1. Open your app and navigate to subscription/pricing screen
2. Verify these tiers are displayed with correct pricing:
   - **Basic**: FREE (freemium) - 0 playbooks, 0 devotionals (gets 1 playbook from onboarding)
   - **Starter**: $6.99/month - 8 playbooks, 8 devotionals
   - **Growth**: $12.99/month - 20 playbooks, 20 devotionals  
   - **Transformation**: $24.99/month - Unlimited + API access
   - **Family**: $34.99/month - Unlimited + family features

**Expected Result:** All tiers display with correct prices and feature descriptions

### Test 2: Free Trial Flow
**What to test:** 3-day trial with full features, then downgrade to basic

**Steps:**
1. Create a new user account (or reset existing user's subscription)
2. User should automatically get `free_trial` tier
3. Verify user has access to ALL features during trial
4. Use the app for content generation, playbooks, etc.
5. Wait for trial to expire (or manually trigger expiration)

**Expected Result:** 
- Trial users get 2 playbooks, 2 devotionals for 3 days
- After expiration, users move to `basic` tier (freemium)
- Basic tier has 0 playbooks, 0 devotionals (but keeps 1 playbook from onboarding)
- **New users get 1 playbook on onboarding**

### Test 3: Subscription Cancellation
**What to test:** Cancelled users move to basic tier

**Steps:**
1. Have a user with an active paid subscription
2. Cancel their subscription through your app
3. Check their subscription status in database

**Expected Result:**
- User's tier changes to `basic`
- User's status changes to `cancelled`
- User retains access to basic freemium features

### Test 4: Feature Access Control
**What to test:** Different tiers have different feature limits

**Steps:**
1. Test with users on different tiers:
   - Basic user: Try to create 2nd playbook (should be blocked - only has onboarding playbook)
   - Starter user: Try to create 9th playbook (should be blocked)
   - Growth user: Try to create 21st playbook (should be blocked)
   - Transformation user: Should have unlimited access

**Expected Result:** Users are properly restricted based on their tier limits

### Test 5: Intelligence Features
**What to test:** AI personalization based on subscription tier

**Steps:**
1. Basic user: Should have no intelligence features
2. Starter user: Should have basic intelligence
3. Growth user: Should have enhanced intelligence
4. Transformation user: Should have advanced intelligence

**Expected Result:** Intelligence features are tier-appropriate

## 🔍 Database Testing Queries

Run these in your Supabase dashboard or database client:

### Check Subscription Tiers
```sql
-- Verify all tiers exist
SELECT tier, COUNT(*) as user_count 
FROM user_subscriptions 
GROUP BY tier;

-- Check pricing data
SELECT * FROM subscription_pricing ORDER BY monthly_price_cents;
```

### Check Trial Users
```sql
-- Find active trial users
SELECT user_id, tier, status, created_at, trial_ends_at
FROM user_subscriptions 
WHERE tier = 'free_trial' AND status = 'active';

-- Find expired trials that should be basic
SELECT user_id, tier, status, trial_ends_at
FROM user_subscriptions 
WHERE status = 'trial_expired';
```

### Check Usage Limits
```sql
-- Test subscription limits function
SELECT get_subscription_limits('basic');
SELECT get_subscription_limits('starter');
SELECT get_subscription_limits('growth');
SELECT get_subscription_limits('transformation');
SELECT get_subscription_limits('family');
```

## 🎮 Interactive Testing Scenarios

### Scenario A: New User Journey
1. **Sign up** → Should get `free_trial` tier
2. **Onboarding** → Should receive 1 playbook automatically
3. **Use features** → Should have 2 playbooks, 2 devotionals for 3 days
4. **Trial expires** → Should automatically move to `basic` tier
5. **Try premium feature** → Should see upgrade prompt
6. **Upgrade to starter** → Should unlock starter features (8 playbooks, 8 devotionals)
7. **Cancel subscription** → Should downgrade to `basic` tier

### Scenario B: Feature Restriction Testing
1. **Basic user** tries to:
   - Create 2nd playbook → Blocked with upgrade prompt (only has 1 from onboarding)
   - Access intelligence features → Blocked
   - Export content → Blocked

2. **Starter user** tries to:
   - Create 9th playbook → Blocked
   - Access advanced intelligence → Limited to basic
   - Use API → Blocked

### Scenario C: Family Plan Testing
1. **Family owner** invites members
2. **Family members** should inherit family tier benefits
3. **Family limits** should be enforced (max 5 members)

## 🐛 Common Issues & Solutions

### Issue: "Invalid enum value 'lite'"
**Solution:** ✅ Already fixed! We removed all `lite` references from the database schema.

### Issue: User stuck in trial after expiration
**Solution:** Run the trial expiration handler:
```javascript
// In your app or admin panel
await trialAccessService.handleTrialExpiration(userId);
```

### Issue: Feature access not updating after tier change
**Solution:** Clear user cache or restart the app to refresh subscription data.

## 📊 Success Metrics

Your subscription intelligence is working correctly when:

- ✅ New users get 3-day free trial
- ✅ Expired trials move to basic (freemium) tier
- ✅ Cancelled users move to basic tier
- ✅ Feature restrictions work per tier
- ✅ Upgrade prompts appear when features are blocked
- ✅ Intelligence features are tier-appropriate
- ✅ Pricing displays correctly for all tiers
- ✅ Database queries return expected results

## 🚀 Next Steps

1. **Test thoroughly** using this guide
2. **Monitor logs** for any errors during testing
3. **Verify analytics** are being tracked properly
4. **Test payment integration** if you have Stripe/payment setup
5. **User acceptance testing** with real users

## 📞 Need Help?

If you encounter any issues:
1. Check the console logs for errors
2. Verify database connection
3. Check subscription service logs
4. Review the tier restriction service output

Happy testing! 🎉
