# APP STORE CONNECT SETUP - STEP BY STEP
**Based on Apple Developer Documentation (December 2024)**

## ✅ OPTION C COMPLETE: Database Schema Verified
All required columns exist in `user_subscriptions_new`:
- ✅ `original_transaction_id` (text)
- ✅ `billing_issue` (boolean)
- ✅ `grace_period_end_date` (timestamp)
- ✅ `trial_converted_date` (timestamp)
- ✅ `auto_renew_enabled` (boolean)
- ✅ `billing_cycle` (text)

**No database migrations needed.**

---

## PART 1: Configure App Store Server Notifications (CRITICAL)

### Method 1: Via App Information (Recommended - Per Apple Docs)
1. Go to: https://appstoreconnect.apple.com
2. Click **Apps** (top navigation)
3. Select **siFia** app
4. In sidebar, under **General**, click **App Information**
5. Scroll to **App Store Server Notifications** section

### Configure Production Server URL
1. Under **Production Server URL**, click **Set Up URL** (or **Edit** if already configured)
2. Enter webhook URL:
   ```
   https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/apple-webhook
   ```
3. **CRITICAL:** Look for a dropdown or radio button labeled **"Version"** or **"Notification Version"**
   - If you see options: Select **"Version 2"** or **"App Store Server Notifications V2"**
   - If you DON'T see version options: Apple may have defaulted to V2 (this is good!)
4. Click **Save**

**TROUBLESHOOTING:** If you don't see a version selector:
- The field might be hidden if V2 is already default
- Check if there's a small dropdown arrow next to the URL field
- Look for "Advanced Options" or "Settings" link
- If still not visible, V2 is likely already enabled (Apple's default for new setups)

### Configure Sandbox Server URL (For Testing)
1. Under **Sandbox Server URL**, click **Set Up URL**
2. Enter same webhook URL:
   ```
   https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/apple-webhook
   ```
3. Choose **Version 2 notifications**
4. Click **Save**

**IMPORTANT NOTE:** If you don't provide a Sandbox URL, Apple will send both sandbox AND production notifications to your Production URL. This is acceptable for your setup since your webhook handles both environments.

### Verify Configuration
After saving, you should see:
- ✅ Production Server URL: Configured (Version 2)
- ✅ Sandbox Server URL: Configured (Version 2) OR using Production URL

**What This Enables:**
Your webhook will automatically receive notifications for:
- ✅ DID_RENEW (trial conversion, monthly renewals)
- ✅ DID_FAIL_TO_RENEW (payment failures)
- ✅ DID_CHANGE_RENEWAL_STATUS (cancellations, re-subscriptions)
- ✅ EXPIRED (subscription ended)
- ✅ GRACE_PERIOD_EXPIRED (grace period ended without payment)
- ✅ REFUND (refund processed)
- ✅ All other subscription lifecycle events

**No need to manually select events** - Version 2 webhooks receive all events automatically.

**IMPORTANT:** There is NO "Test" button for App Store Server Notifications in the App Information page. To test:
1. Use a sandbox test account and make a real purchase
2. Monitor webhook logs in Supabase Dashboard
3. Check for automatic notifications from Apple

**DO NOT configure webhooks in Users and Access → Integrations → Webhooks** - that's for App Store Connect API events (builds, TestFlight), NOT subscriptions.

---

## PART 2: Verify API Keys

### Check Existing Key
1. Still in **App Store Connect**
2. Click **App Store Connect API** (left section under Integrations)
3. Find your key: **UNR2UMA26W**
4. Verify:
   - Status: **Active** ✅
   - Access: **App Store Connect API** ✅
   - Key ID: **UNR2UMA26W** ✅

### If Key is Missing or Revoked
1. Click **"+"** to generate new key
2. Name: **siFia Subscription Key**
3. Access: Select **App Store Connect API**
4. Click **Generate**
5. **DOWNLOAD THE .p8 FILE IMMEDIATELY** (can't download again)
6. Upload to Supabase:

```bash
# Read the .p8 file
cat /path/to/SubscriptionKey_*.p8

# Set in Supabase (include the entire key with headers)
supabase secrets set APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
<paste-entire-key-here>
-----END PRIVATE KEY-----"

# Also set Key ID and Issuer ID
supabase secrets set APPLE_KEY_ID="<key-id>"
supabase secrets set APPLE_ISSUER_ID="<issuer-id>"
```

### Current Configuration (Verify These Match)
```
Key ID: UNR2UMA26W
Issuer ID: 364a1398-a4cc-4488-888c-c9dbf1709855
Bundle ID: app.sifia.com
```

---

## PART 3: Verify In-App Purchase Configuration

### Check Products
1. Go to: **My Apps** → **siFia** → **Subscriptions**
2. Verify these products exist:

**Monthly Products:**
- `app.sifia.com.spark.monthly.freetrial`
- `app.sifia.com.growth.monthly.freetrial`
- `app.sifia.com.transformation.monthly.freetrial`

**Annual Products:**
- `app.sifia.com.spark.annual.freetrial`
- `app.sifia.com.growth.annual.freetrial`
- `app.sifia.com.transformation.annual.freetrial`

### Check Free Trial Offer
For each product:
1. Click product → **Subscription Prices** tab
2. Verify **3-day free trial** is configured
3. Check **Available in all territories** ✅

### Check Shared Secret (for receipt validation)
1. Go to: **My Apps** → **siFia** → **General** → **App Information**
2. Scroll to **App-Specific Shared Secret**
3. Current value: stored in your local `.env` and Supabase secrets only.
4. Verify this matches your .env:

```bash
# In .env file
APPLE_SHARED_SECRET=your_app_store_shared_secret
```

---

## PART 4: Test Webhook Delivery

### Manual Test from App Store Connect
1. Go back to **Webhooks** section
2. Click your webhook name
3. Click **Test** button
4. Select notification type: **DID_RENEW**
5. Click **Send Test**

### Check Supabase Logs
```bash
supabase functions logs apple-webhook --tail
```

Expected:
```
[AppleWebhook] Raw payload received
[AppleWebhook] v2 format detected (signedPayload)
[AppleWebhook] v2 decoded: { notificationType: 'DID_RENEW', ... }
```

If you see:
```
[AppleWebhook] No transaction info, skipping
```

This is NORMAL for test notifications (they don't include transaction data).

### Test with Real Transaction
1. Use a test Apple ID
2. Subscribe to free trial in your app
3. Wait ~1 minute
4. Check webhook logs for SUBSCRIBED notification
5. Fast-forward time in Sandbox (optional)
6. Check for DID_RENEW after trial expires

---

## PART 5: Deploy Database Fixes

### Fix Transaction ID Validation
```bash
# Run this SQL in Supabase SQL Editor
# File: fix_transaction_id_validation.sql
```

This will:
- Clear corrupted transaction IDs
- Add validation constraints
- Prevent future corruption

### Fix Angel's Subscription
```bash
# Run this SQL in Supabase SQL Editor
# File: fix_angel_correct_billing.sql
```

This will:
- Upgrade Angel to Growth Monthly
- Set correct billing dates (25th of each month)
- Clear corrupted transaction ID
- Reset usage counters

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

### Webhook Configuration
- [ ] Webhook URL added: `https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/apple-webhook`
- [ ] Webhook secret generated and saved to Supabase
- [ ] All event triggers enabled (9 events)
- [ ] Test notification sent successfully
- [ ] Logs show "v2 format detected"

### API Key Configuration
- [ ] Key ID: UNR2UMA26W (Active)
- [ ] Issuer ID: 364a1398-a4cc-4488-888c-c9dbf1709855
- [ ] Private key uploaded to Supabase
- [ ] All 3 secrets verified: APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY

### Database Fixes
- [ ] Transaction ID validation SQL executed
- [ ] No invalid transaction IDs remain
- [ ] Constraints added to both tables
- [ ] Angel's subscription upgraded to Growth Monthly
- [ ] Angel's billing dates correct (2024-12-25 → 2025-01-25)

### Code Deployment
- [ ] Webhook v2 payload handling deployed
- [ ] `supabase functions deploy apple-webhook` completed
- [ ] No deployment errors

---

## EXPECTED BEHAVIOR AFTER FIXES

### Trial Conversion (Automatic)
1. User starts trial → App creates free_trial tier ✅
2. Trial expires after 3 days ✅
3. Apple charges user → Sends DID_RENEW webhook ✅
4. Webhook processes → Upgrades user to paid tier ✅
5. Database updated → User sees paid features immediately ✅

### Billing Failure (Automatic)
1. Apple can't charge → Sends DID_FAIL_TO_RENEW webhook ✅
2. Webhook sets billing_issue = true ✅
3. Grace period started (3 days) ✅
4. User keeps access during grace ✅
5. After 3 days → GRACE_PERIOD_EXPIRED → Reverts to seeker ✅

### Monthly Renewal (Automatic)
1. Billing date arrives (e.g., 25th) ✅
2. Apple charges → Sends DID_RENEW webhook ✅
3. Webhook resets usage → playbooks_used = 0 ✅
4. subscription_end_date updated (+30 days) ✅

---

## TROUBLESHOOTING

### Webhook Not Receiving Notifications
**Check:**
1. Webhook URL is correct (no typos)
2. Webhook is enabled (not paused)
3. All event triggers are selected
4. Test notification works from App Store Connect

**Fix:**
- Delete and recreate webhook
- Ensure URL is accessible (curl test)
- Check Supabase function is deployed

### "No transaction info, skipping"
**This is normal for:**
- Test notifications (don't include transaction data)
- Some notification types

**This is a problem for:**
- Real DID_RENEW events
- Real purchases

**Fix:**
- Check if webhook v2 format handling is deployed
- Verify logs show "v2 format detected"
- Check Apple is sending signedTransactionInfo

### Transaction ID Still Corrupted
**Check:**
1. Validation SQL executed successfully
2. Constraints added to database
3. No manual overwrites happening

**Fix:**
- Re-run validation SQL
- Check for manual UPDATE queries
- Ensure app code doesn't overwrite IDs

### User Paid But Not Upgraded
**Immediate fix:**
1. Check Apple Financial Reports for payment
2. Find user's Subscriber ID
3. Match to user_id in database
4. Run manual upgrade SQL (like Angel's fix)

**Long-term fix:**
- Ensure webhook is configured
- Verify webhook receives DID_RENEW
- Check logs for processing errors

---

## MONITORING

### Watch Webhook Logs (24-48 hours)
```bash
# Live tail
supabase functions logs apple-webhook --tail

# Check specific user
supabase functions logs apple-webhook | grep "075a3764"
```

### Check for Errors
Look for:
- ❌ "Failed to decode signedPayload"
- ❌ "User not found for original transaction"
- ❌ "Failed to decode transaction"

### Success Indicators
Look for:
- ✅ "v2 format detected"
- ✅ "Trial converting to paid"
- ✅ "Renewal processed"
- ✅ "Grace period activated"

---

## SUPPORT CONTACTS

**Apple Developer Support:** https://developer.apple.com/contact/
**App Store Connect:** https://appstoreconnect.apple.com
**Supabase Dashboard:** https://supabase.com/dashboard/project/aesmrjinczhknchlrsmt
**Documentation:** https://developer.apple.com/documentation/appstoreservernotifications

---

## NEXT PAYMENT TEST

Angel Mary Kathleen's next payment:
- **Current billing date:** 25th of each month
- **Next charge:** January 25, 2025
- **Expected webhook:** DID_RENEW on 2025-01-25
- **Expected behavior:** Usage reset, subscription_end_date → 2025-02-25

Monitor logs on January 25 to confirm automatic renewal works.
