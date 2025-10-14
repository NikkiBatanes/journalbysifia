# Trial Testing Guide

Complete guide for testing different trial states and subscription scenarios.

---

## 🎯 **Quick Testing Options**

### **Option 1: Using Debug Menu (Easiest)**

1. **Add Debug Menu to UserProfileScreen:**
   ```tsx
   // At the top of UserProfileScreen.tsx
   import { TrialDebugMenu } from '../components/debug/TrialDebugMenu';
   
   // Inside the render, add at the top of ScrollView (after ProfileHeader):
   {__DEV__ && <TrialDebugMenu />}
   ```

2. **Use the buttons:**
   - **3 Days** - Sets trial to 3 days remaining
   - **2 Days** - Sets trial to 2 days remaining  
   - **1 Day** - Sets trial to 1 day remaining
   - **Convert to Paid** - Simulates trial ending and converting to Growth (20/20)
   - **Reset to Trial** - Resets back to 3-day trial (2/2)

3. **After clicking a button:**
   - Pull down to refresh the screen
   - Or restart the app
   - Check tooltips to see updated state

---

### **Option 2: Direct SQL (More Control)**

Open Supabase SQL Editor and run these queries:

#### **Test: 2 Days Remaining**
```sql
UPDATE user_subscriptions_new 
SET trial_end_date = NOW() + INTERVAL '2 days'
WHERE user_id = 'YOUR_USER_ID';
```

#### **Test: 1 Day Remaining**
```sql
UPDATE user_subscriptions_new 
SET trial_end_date = NOW() + INTERVAL '1 day'
WHERE user_id = 'YOUR_USER_ID';
```

#### **Test: Trial Ending Today (6 hours left)**
```sql
UPDATE user_subscriptions_new 
SET trial_end_date = NOW() + INTERVAL '6 hours'
WHERE user_id = 'YOUR_USER_ID';
```

#### **Test: Trial Just Ended → Converted to Paid Growth**
```sql
UPDATE user_subscriptions_new 
SET 
  tier = 'growth',
  status = 'active',
  trial_end_date = NOW() - INTERVAL '1 day',
  subscription_start_date = NOW(),
  subscription_display_name = 'siFia Growth',
  playbooks_limit = 20,
  devotionals_limit = 20,
  playbooks_used = 0,
  devotionals_used = 0
WHERE user_id = 'YOUR_USER_ID';
```

#### **Test: Reset Back to Trial**
```sql
UPDATE user_subscriptions_new 
SET 
  tier = 'free_trial',
  status = 'trialing',
  trial_start_date = NOW(),
  trial_end_date = NOW() + INTERVAL '3 days',
  trial_chosen_tier = 'growth',
  subscription_display_name = 'siFia Growth Trial',
  playbooks_limit = 2,
  devotionals_limit = 2,
  playbooks_used = 0,
  devotionals_used = 0
WHERE user_id = 'YOUR_USER_ID';
```

---

## 📋 **Testing Checklist**

### **Scenario 1: 3 Days Remaining (Fresh Trial)**
- [ ] Badge shows "siFia Growth Trial"
- [ ] Playbooks tooltip: "You have 3 days remaining in your trial"
- [ ] Shows: "After your trial ends, you will have 20 playbooks every month"
- [ ] Devotionals tooltip: Same messaging
- [ ] UserInputScreen badge: "2 of 2 Playbooks Remaining"

### **Scenario 2: 2 Days Remaining**
- [ ] Badge shows "siFia Growth Trial"
- [ ] Tooltip: "You have 2 days remaining in your trial"
- [ ] All other messaging consistent

### **Scenario 3: 1 Day Remaining (Urgency)**
- [ ] Badge shows "siFia Growth Trial"
- [ ] Tooltip: "You have 1 day remaining in your trial"
- [ ] Singular "day" (not "days")

### **Scenario 4: Trial Ended → Paid Growth (20/20)**
- [ ] Badge shows "siFia Growth" (no "Trial")
- [ ] Playbooks tooltip: "You have 20 playbooks available each month"
- [ ] No mention of trial
- [ ] Shows: "20 playbooks remaining this month"
- [ ] UserInputScreen badge: "20 of 20 Playbooks Remaining"

### **Scenario 5: Used Some Resources**
Test with different usage levels:
```sql
-- Use 1 playbook
UPDATE user_subscriptions_new 
SET playbooks_used = 1
WHERE user_id = 'YOUR_USER_ID';

-- Use 1 devotional
UPDATE user_subscriptions_new 
SET devotionals_used = 1
WHERE user_id = 'YOUR_USER_ID';
```

- [ ] Tooltip shows correct "used" count
- [ ] Remaining count is accurate (limit - used)
- [ ] Badge updates: "1 of 2 Playbooks Remaining" (trial) or "19 of 20" (paid)

---

## 🔍 **Where to Check Changes**

After modifying trial state, check these screens:

1. **User Profile Screen**
   - Header badge (top right)
   - Tap playbooks badge → tooltip
   - Tap devotionals badge → tooltip

2. **User Input Screen**
   - Bottom badge in text input area
   - Shows: "X of Y Playbooks Remaining"
   - Tier badge: "siFia Growth Trial" or "siFia Growth"

3. **Devotional Modal**
   - Bottom badges
   - Tier badge and usage counter

---

## 🎨 **Expected Tooltip Messages**

### **Trial User (2 days remaining, 0/2 used):**
```
You are on siFia Growth Trial. You have 2 playbooks available 
during your trial and have used 0.

You have 2 days remaining in your trial. After your trial ends, 
you will have 20 playbooks every month.
```

### **Paid User (Growth, 5/20 used):**
```
You are on siFia Growth. You have 20 playbooks available each 
month and have used 5.

15 playbooks remaining this month.
```

### **Unlimited User (Transformation):**
```
You are on siFia Transformation. You have unlimited playbooks! 
Generate as many as you need to support your spiritual journey.
```

---

## 🚨 **Important Notes**

1. **Refresh Required**: After changing database values, you must:
   - Pull down to refresh the screen, OR
   - Close and reopen the app

2. **Cache Issues**: If changes don't appear:
   - Force quit the app completely
   - Clear React Query cache (restart app)
   - Check Supabase to confirm changes were saved

3. **User ID**: Replace `'YOUR_USER_ID'` with your actual user ID from Supabase

4. **Remove Debug Menu**: Before production, remove:
   ```tsx
   {__DEV__ && <TrialDebugMenu />}
   ```

---

## 🔧 **Quick Copy-Paste Commands**

### **Get Your User ID:**
```sql
SELECT id, email FROM auth.users WHERE email = 'your.email@example.com';
```

### **Check Current State:**
```sql
SELECT 
  user_id,
  tier,
  status,
  trial_end_date,
  subscription_display_name,
  playbooks_limit,
  playbooks_used,
  devotionals_limit,
  devotionals_used
FROM user_subscriptions_new 
WHERE user_id = 'YOUR_USER_ID';
```

### **Quick Reset to Known State:**
```sql
-- Reset to fresh 3-day Growth trial
UPDATE user_subscriptions_new 
SET 
  tier = 'free_trial',
  status = 'trialing',
  trial_start_date = NOW(),
  trial_end_date = NOW() + INTERVAL '3 days',
  trial_chosen_tier = 'growth',
  subscription_display_name = 'siFia Growth Trial',
  playbooks_limit = 2,
  devotionals_limit = 2,
  playbooks_used = 0,
  devotionals_used = 0
WHERE user_id = 'YOUR_USER_ID';
```

---

## 📱 **Testing Different Tiers**

### **Test Spark Trial:**
```sql
UPDATE user_subscriptions_new 
SET 
  trial_chosen_tier = 'spark',
  subscription_display_name = 'siFia Spark Trial'
WHERE user_id = 'YOUR_USER_ID';
```
Expected after conversion: 8 playbooks, 8 devotionals

### **Test Growth Trial:**
```sql
UPDATE user_subscriptions_new 
SET 
  trial_chosen_tier = 'growth',
  subscription_display_name = 'siFia Growth Trial'
WHERE user_id = 'YOUR_USER_ID';
```
Expected after conversion: 20 playbooks, 20 devotionals

### **Test Transformation (Unlimited):**
```sql
UPDATE user_subscriptions_new 
SET 
  tier = 'transformation',
  status = 'active',
  subscription_display_name = 'siFia Transformation',
  playbooks_limit = -1,
  devotionals_limit = -1
WHERE user_id = 'YOUR_USER_ID';
```
Expected: "Unlimited" messaging

---

## ✅ **Validation Checklist**

Before marking testing complete, verify:

- [ ] Grammar is correct in all tooltip messages
- [ ] Singular/plural forms are correct ("1 day" vs "2 days")
- [ ] Trial badge shows "Trial" suffix
- [ ] Paid badge does NOT show "Trial" suffix
- [ ] Usage counts are accurate (limit - used = remaining)
- [ ] Tooltip closes smoothly without flashing
- [ ] Colors match design (anchor blue background, white text)
- [ ] All tier names use proper capitalization
- [ ] No console errors when opening tooltips

---

## 🎯 **End-to-End Test Flow**

1. **Start**: Fresh 3-day trial (2/2 resources)
2. **Day 1**: Use 1 playbook → Check tooltip shows "1 of 2 used"
3. **Day 2**: Set to 2 days remaining → Check tooltip
4. **Day 3**: Set to 1 day remaining → Check tooltip
5. **Conversion**: Convert to paid → Check shows 20/20
6. **Usage**: Use 5 playbooks → Check shows 15/20 remaining
7. **Reset**: Reset back to trial → Verify clean state

---

**Happy Testing! 🚀**
