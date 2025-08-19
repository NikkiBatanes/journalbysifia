# Manual Test Instructions: Spark Subscription Issue

## Test Setup

### Step 1: Prepare Test Environment
1. Open the siFia app in development mode
2. Clear all localStorage and browser cache
3. Open browser developer tools (F12)
4. Go to Console tab

### Step 2: Load Debug Script
1. Copy and paste the entire contents of `debug-spark-subscription.js` into the browser console
2. Press Enter to load the debugger
3. You should see the debugger instructions appear

## Test Procedure

### Test A: Spark Monthly Subscription

1. **Create New User**
   - Use email: `spark-monthly-test-$(Date.now())@example.com`
   - Use password: `TestPassword123!`
   - Complete registration flow

2. **Navigate to Sales Offer Screen**
   - Go through onboarding until you reach the sales offer screen
   - Select "Spark" tier
   - Select "Monthly" billing
   - Note the user ID from the console or auth state

3. **Before Clicking "Unlock Plan"**
   ```javascript
   // In browser console:
   const userId = 'your-user-id-here'; // Replace with actual user ID
   const debugger = new SparkSubscriptionDebugger();
   
   // Check initial state
   await debugger.checkDatabaseState(userId);
   debugger.checkReactQueryCache(userId);
   ```

4. **Click "Unlock Plan" and Immediately Debug**
   ```javascript
   // Run this immediately after clicking "Unlock Plan"
   setTimeout(async () => {
     console.log('=== DEBUGGING AFTER UPGRADE SUBSCRIPTION ===');
     await debugger.runCompleteDiagnosis(userId);
   }, 100);
   ```

5. **Navigate Through Payment Flow**
   - Continue through Payment Processing screen
   - Continue through Payment Confirmation screen
   - Continue through Notification Setup screen

6. **Debug Dashboard State**
   ```javascript
   // When dashboard loads, run complete diagnosis
   console.log('=== DEBUGGING DASHBOARD STATE ===');
   await debugger.runCompleteDiagnosis(userId);
   debugger.generateReport();
   ```

### Test B: Spark Annual Subscription

Repeat the same process but select "Annual" billing instead of "Monthly".

## Expected Results vs Actual Results

### Expected Results:
- Database should show: `tier: 'spark'` or `tier: 'spark_annual'`
- React Query cache should show: `tier: 'spark'` or `tier: 'spark_annual'`
- getUserSubscription should return: `tier: 'spark'` or `tier: 'spark_annual'`
- UI should display: "SPARK" badge with "8/8" limits

### Actual Results (Document What You See):
- Database tier: `_________________`
- Cache tier: `_________________`
- getUserSubscription tier: `_________________`
- UI display: `_________________`

## Debugging Checklist

When running the diagnosis, check for these specific issues:

### Issue 1: Race Condition
- [ ] Does localStorage show a recent paid subscription attempt?
- [ ] Is there a timing gap between subscription creation and dashboard load?
- [ ] Does the database have the correct subscription but getUserSubscription returns trial?

### Issue 2: Cache Issues
- [ ] Does the database have correct data but React Query cache is stale?
- [ ] Are cache invalidation calls working properly?
- [ ] Is the cache being populated with trial data after the fact?

### Issue 3: Subscription Creation Issues
- [ ] Is the upgradeSubscription call actually creating the subscription?
- [ ] Is the upsert operation working correctly?
- [ ] Are there any database errors in the console?

### Issue 4: UI Rendering Issues
- [ ] Is the UI reading from the correct data source?
- [ ] Are there multiple subscription hooks causing conflicts?
- [ ] Is the subscription badge component using the right tier data?

## Additional Debug Commands

### Check Specific Issues:
```javascript
// Check if upgradeSubscription is being called
console.log('Checking subscription service calls...');

// Monitor network requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('user_subscriptions')) {
    console.log('🌐 Subscription API call:', args);
  }
  return originalFetch.apply(this, args);
};

// Check React Query mutations
if (window.queryClient) {
  const originalMutate = window.queryClient.mutate;
  window.queryClient.mutate = function(...args) {
    console.log('🔄 React Query mutation:', args);
    return originalMutate.apply(this, args);
  };
}
```

### Monitor localStorage Changes:
```javascript
// Monitor localStorage for subscription attempts
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  if (key.includes('paid_subscription_attempt')) {
    console.log('💾 localStorage subscription attempt:', { key, value });
  }
  return originalSetItem.apply(this, arguments);
};
```

## Report Template

After completing the tests, fill out this report:

```
SPARK SUBSCRIPTION TEST REPORT
=============================

Test Date: ___________
App Version: ___________
Browser: ___________

SPARK MONTHLY TEST:
- User ID: ___________
- Database Tier: ___________
- Cache Tier: ___________
- getUserSubscription Tier: ___________
- UI Display: ___________
- Issue Found: ___________

SPARK ANNUAL TEST:
- User ID: ___________
- Database Tier: ___________
- Cache Tier: ___________
- getUserSubscription Tier: ___________
- UI Display: ___________
- Issue Found: ___________

ROOT CAUSE IDENTIFIED:
___________________________________________
___________________________________________

RECOMMENDED FIX:
___________________________________________
___________________________________________
```

## Next Steps

Based on the test results, we can identify exactly where the issue is occurring and implement a targeted fix.
