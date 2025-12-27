# Fix: Automatic Trial-to-Paid Conversion Not Working

## The Problem
- Users start 3-day free trial
- Apple charges them after trial ends
- **App doesn't automatically upgrade them to paid tier**
- Users stuck on seeker/trial tier despite paying

## Root Causes Fixed

### 1. ✅ Missing original_transaction_id (FIXED)
**Was**: Trial creation didn't store `original_transaction_id`
**Fixed**: `/supabase/functions/validate-receipt/index.ts` now stores it
**Status**: Deployed

### 2. ✅ Backup cleanup function (FIXED)
**Was**: No fallback if webhook fails
**Fixed**: `/supabase/functions/cleanup-expired-trials/index.ts` created
**Status**: Deployed

### 3. ⚠️ REMAINING ISSUE: Webhook Not Processing Trial Conversions

## How It SHOULD Work

### Day 0: Trial Starts
1. User subscribes to "Growth Monthly with Free Trial"
2. App calls `validate-receipt` function
3. Creates trial subscription with:
   - `tier = 'free_trial'`
   - `trial_chosen_tier = 'growth'`
   - `trial_end_date = NOW() + 3 days`
   - `original_transaction_id = [Apple's ID]` ✅ FIXED

### Day 3: Trial Ends, Payment Attempted
**What Apple Does:**
1. Attempts to charge user's payment method
2. If successful: Sends `DID_RENEW` webhook notification
3. If failed: Sends `DID_FAIL_TO_RENEW` webhook notification

**What Webhook SHOULD Do:**
1. Receives `DID_RENEW` notification
2. Finds user by `original_transaction_id`
3. Checks if `tier = 'free_trial'` and `offerType = 1` (trial conversion)
4. Updates subscription:
   ```sql
   tier = 'growth'
   trial_converted_date = NOW()
   subscription_start_date = NOW()
   subscription_end_date = NOW() + 30 days
   ```

## Current Status Check

### Webhook URL
**Expected**: `https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/apple-webhook`

**Verify in App Store Connect**:
1. Go to: https://appstoreconnect.apple.com
2. Apps → siFia → General → App Information
3. Scroll to: "App Store Server Notifications"
4. Production Server URL should match above

### Webhook Processing
Check `/supabase/functions/apple-webhook/index.ts`:
- ✅ Has `DID_RENEW` handler
- ✅ Detects trial conversion: `subscription.tier === 'free_trial' && offerType === 1`
- ✅ Updates to paid tier
- ✅ Finds user by `original_transaction_id`

## Why It's Still Not Working

### Possible Issues:

#### 1. Apple Not Sending Notifications
**Symptoms**: Webhook logs show no `DID_RENEW` events
**Causes**:
- App not "Ready for Sale" in App Store Connect
- Subscription products not approved
- Webhook URL not configured
- Server notification version 1 instead of 2

**Fix**: Verify App Store Connect configuration

#### 2. Webhook Can't Find Users
**Symptoms**: Webhook logs show "No user found for original_transaction_id"
**Causes**:
- `original_transaction_id` was NULL (FIXED)
- Webhook querying wrong field

**Fix**: Already deployed

#### 3. Sandbox vs Production Mismatch
**Symptoms**: Works in sandbox, fails in production
**Causes**:
- Different webhook URLs for sandbox/production
- Transaction IDs from sandbox being queried against production API

**Fix**: Ensure webhook handles both environments

## Immediate Actions Needed

### 1. Check Webhook Logs (Last 7 Days)
Look for:
- `[AppleWebhook] DID_RENEW` - Trial conversions
- `[AppleWebhook] 🎉 Trial converting to paid` - Successful conversions
- `[AppleWebhook] No user found` - Lookup failures
- `[AppleWebhook] No transaction info` - Empty notifications

### 2. Verify App Store Connect Configuration
- ✅ Production Server URL: Set
- ❓ App Status: "Ready for Sale"?
- ❓ Subscription Products: Approved?
- ❓ Test Notifications: Sent successfully?

### 3. Manual Test
1. Create new test user
2. Start trial subscription
3. Wait 3 days (or use sandbox accelerated time)
4. Check webhook logs for DID_RENEW
5. Verify user upgraded to paid tier

## Expected Webhook Flow

```
Trial Starts (Day 0)
  ↓
validate-receipt called
  ↓
Stores: tier='free_trial', trial_chosen_tier='growth', original_transaction_id='123'
  ↓
Wait 3 days...
  ↓
Apple charges user
  ↓
Apple sends DID_RENEW webhook
  ↓
Webhook finds user by original_transaction_id='123'
  ↓
Webhook checks: tier='free_trial' + offerType=1 → TRIAL CONVERSION
  ↓
Webhook updates: tier='growth', trial_converted_date=NOW()
  ↓
✅ User automatically on paid tier
```

## If Webhook Fails

Backup mechanism runs daily:
```
cleanup-expired-trials function
  ↓
Finds: tier='free_trial' AND trial_end_date < NOW()
  ↓
Reverts to: tier='seeker'
  ↓
❌ User loses access (not ideal, but prevents stuck trials)
```

## Next Steps

1. **Check webhook logs** to see if Apple is sending DID_RENEW notifications
2. **Verify App Store Connect** webhook configuration
3. **Test with new trial** to confirm end-to-end flow
4. **Monitor conversions** daily until automation is proven

## Long-term Solution

Once working correctly:
- New trials automatically convert when Apple charges
- Webhook processes in real-time
- No manual intervention needed
- Backup cleanup function catches any failures
