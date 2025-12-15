# 🔍 PAYMENT FLOW DEBUG GUIDE

## How to Debug the Payment Issue

### 1. Enable Debug Logging
The app now has comprehensive debug logging. To see the logs:

**On Mac (Xcode):**
1. Open Xcode
2. Run the app on simulator or device
3. Open Console (Cmd+Shift+C)
4. Filter for "StoreKit" or "SCREEN STEP"

**Using React Native Debugger:**
1. Run `npm start`
2. Open React Native Debugger
3. Check Console tab

### 2. Expected Log Sequence (Working Flow)

When payment works correctly, you should see this EXACT sequence:

```
1. [OnboardingSalesOffer] 🛒 SCREEN STEP 1: Initiating purchase
   - Shows: productId, userId, selectedTier, timestamp

2. [StoreKit][xxx_timestamp] 🔍 STEP 1: Processing purchase update
   - Shows: productId, transactionId, hasPendingResolver

3. [StoreKit][xxx_timestamp] 🔄 STEP 3: Starting server-side receipt validation
   - Shows: userId, productId, hasReceipt

4. [StoreKit][xxx_timestamp] ✅ STEP 4: Server validation completed
   - Shows: success=true, hasData=true

5. [StoreKit][xxx_timestamp] 🔄 STEP 5: Starting database update
   - Shows: userId, tier, transactionId, timestamp

6. [StoreKit][xxx_timestamp] ✅ STEP 6: Database update completed successfully
   - Shows: userId, tier, duration (in ms), timestamp
   - ⚠️ CRITICAL: Note the duration - should be < 1000ms

7. [StoreKit][xxx_timestamp] ✅ STEP 7: Purchase validated and completed successfully
   - Shows: transactionId, duration, tier

8. [StoreKit][xxx_timestamp] 🎯 STEP 8: Resolving purchase promise
   - Shows: hasPendingResolver=true, pendingResolversCount

9. [OnboardingSalesOffer] 📦 SCREEN STEP 2: Purchase result received from service
   - Shows: success=true, hasTransactionId=true, transactionId

10. [OnboardingSalesOffer] ⏳ SCREEN STEP 3: Waiting for AppleStoreKitService (UPGRADE MODE)
    - Shows: userId, selectedTier, waitTime=2000ms

11. [OnboardingSalesOffer] ⏱️ SCREEN STEP 4: Wait completed (2000ms), verifying database
    - Shows: actual wait duration

12. [OnboardingSalesOffer] 🔄 SCREEN STEP 5: Verifying subscription update in database
    - Shows: userId, selectedTier

13. [OnboardingSalesOffer] 📊 SCREEN STEP 6: Database query result (UPGRADE MODE)
    - Shows: found=true, currentTier, expectedTier, matches=true
    - ⚠️ CRITICAL: Check if matches=true

14. [OnboardingSalesOffer] ✅ SCREEN STEP 8: Subscription verified in database
    - Shows: tier, status
```

### 3. Common Failure Patterns

#### Pattern A: Race Condition (Most Likely)
```
✅ STEP 1-8: All complete normally
📦 SCREEN STEP 2: Purchase result received ← TOO EARLY!
⏳ SCREEN STEP 3: Waiting 2000ms
⏱️ SCREEN STEP 4: Wait completed
🔄 SCREEN STEP 5: Verifying subscription
📊 SCREEN STEP 6: found=true, matches=FALSE ← PROBLEM!
❌ STEP 7: Subscription verification FAILED
```
**Diagnosis**: Promise resolved before database update completed
**Fix**: Increase wait time or implement polling

#### Pattern B: Server Validation Failing
```
✅ STEP 1-3: Normal
❌ STEP 4: Server validation completed, success=FALSE ← PROBLEM!
⚠️ Server validation failed, trying client validation
```
**Diagnosis**: Supabase Edge Function error
**Fix**: Check Supabase logs, verify environment variables

#### Pattern C: Database Update Failing
```
✅ STEP 1-4: Normal
🔄 STEP 5: Starting database update
❌ Error: Failed to update user subscription ← PROBLEM!
```
**Diagnosis**: Database error or missing table
**Fix**: Run migration script, check database schema

#### Pattern D: No Purchase Update Listener
```
🛒 SCREEN STEP 1: Initiating purchase
(Apple payment sheet appears)
(User completes payment)
(Apple shows success alert)
❌ NO STEP 1 from StoreKit ← PROBLEM!
```
**Diagnosis**: Purchase listener not firing
**Fix**: Check if listener is properly initialized

### 4. Key Timing Metrics to Watch

| Metric | Expected | Concerning |
|--------|----------|------------|
| Server validation | < 3 seconds | > 5 seconds |
| Database update | < 1 second | > 2 seconds |
| Total (Step 3-6) | < 4 seconds | > 6 seconds |
| Wait time | 2 seconds | N/A |

**If Total > 2 seconds**: The 2-second wait is insufficient!

### 5. What to Send Me

When you test, copy and paste these specific logs:

1. **The complete sequence** from STEP 1 to STEP 8 (StoreKit side)
2. **The complete sequence** from SCREEN STEP 1 to SCREEN STEP 8 (Screen side)
3. **Any errors** that appear
4. **Timestamps** - I need to see the timing

### 6. Quick Diagnostic Commands

**Check if tables exist:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'user_subscriptions_new';
```

**Check user's subscription:**
```sql
SELECT * FROM user_subscriptions_new 
WHERE user_id = 'YOUR_USER_ID';
```

**Check validated receipts:**
```sql
SELECT * FROM validated_receipts 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC LIMIT 5;
```

### 7. Testing Checklist

Before testing:
- [ ] App is running latest code (build and run)
- [ ] Console/debugger is open and ready
- [ ] You're using a test account (not production)
- [ ] You have a valid payment method set up
- [ ] Database migration has been run

During testing:
- [ ] Start recording logs BEFORE tapping purchase
- [ ] Note when Apple payment sheet appears
- [ ] Note when you complete payment
- [ ] Note when Apple success alert appears
- [ ] Note when you click "OK" on alert
- [ ] Note what happens to the modal

After testing:
- [ ] Copy ALL logs from start to finish
- [ ] Note any errors or warnings
- [ ] Check database directly for subscription
- [ ] Send me the complete log sequence

### 8. Emergency Fallback

If nothing works, we can:
1. Remove the 2-second wait entirely
2. Implement polling (check database every 500ms for 10 seconds)
3. Show loading state until database confirms update
4. Add retry logic for failed validations

## 🎯 The Goal

We need to see the EXACT execution order and timing to determine:
1. Is the promise resolving too early?
2. Is the database update taking too long?
3. Is there an error being silently caught?
4. Is the purchase listener even firing?

**Send me the logs and I'll know exactly what's wrong!** 🔍
