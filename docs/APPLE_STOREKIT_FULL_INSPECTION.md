# FULL APPLE STOREKIT & WEBHOOK INSPECTION REPORT

## Executive Summary
**Date:** December 27, 2025
**Status:** 🔴 CRITICAL ISSUES FOUND

### Problems Identified
1. ❌ Webhook payload format mismatch (v1 vs v2)
2. ❌ Transaction ID corruption
3. ❌ Missing App Store Connect webhook configuration
4. ❌ Trial-to-paid conversion failures
5. ❌ Grace period/billing issues not tracked

---

## ISSUE #1: Webhook Payload Format Mismatch

### Current Code (WRONG)
```typescript
// File: supabase/functions/apple-webhook/index.ts:111
const signedTransactionInfo = body.data?.signedTransactionInfo;
```

### What Apple Actually Sends (v2 Format)
```json
{
  "signedPayload": "eyJhbGc..."
}
```

### Why This Breaks
- Your code looks for `body.data.signedTransactionInfo`
- Apple sends `body.signedPayload`
- Result: `type: undefined, subtype: undefined`
- Webhook skips all processing

### Fix Required
```typescript
// DECODE THE SIGNED PAYLOAD FIRST
const signedPayload = body.signedPayload;
if (!signedPayload) {
  console.log('[AppleWebhook] No signedPayload, skipping');
  return new Response('OK', { headers: corsHeaders });
}

// Decode the outer payload to get notification info
const decodedPayload = decodeJWT(signedPayload);
const notificationType = decodedPayload.notificationType;
const subtype = decodedPayload.subtype;
const signedTransactionInfo = decodedPayload.data?.signedTransactionInfo;
```

---

## ISSUE #2: Transaction ID Corruption

### Evidence
From `audit_all_transaction_ids.sql`:
```sql
-- Angel Mary Kathleen (075a3764-40c7-47dc-8d53-be13e9edfce7)
-- Transaction ID: 14 characters (INVALID - should be 15+)
-- Apple API returns: 404 NOT FOUND
```

### Root Cause
Manual overwrites or incorrect transaction ID capture during purchase flow.

### Impact
- Can't query Apple API (404 errors)
- Can't sync subscription status
- Users paid but stuck on trial/seeker

### Fix Required
1. Clear corrupted transaction IDs
2. Let Apple webhook provide correct IDs
3. Add validation: `transaction_id.length >= 15 AND numeric only`

---

## ISSUE #3: Missing App Store Connect Webhook Configuration

### Current State
**App Store Connect → Webhooks:** NOT CONFIGURED

### What Should Be Configured
1. **Webhook URL:** `https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/apple-webhook`
2. **Webhook Secret:** `siFiaWebhook2025SecretKeyABC123xyz789` (from .env)
3. **Event Triggers:**
   - DID_RENEW ✅
   - DID_FAIL_TO_RENEW ✅
   - DID_CHANGE_RENEWAL_STATUS ✅
   - EXPIRED ✅
   - GRACE_PERIOD_EXPIRED ✅
   - REFUND ✅
   - SUBSCRIBED ✅

### Why This Breaks
Without webhook configuration:
- Apple can't send real-time notifications
- Trial conversions don't happen automatically
- Billing failures not detected
- Grace period not tracked

---

## ISSUE #4: Trial-to-Paid Conversion Failures

### Current Flow
1. User starts trial → `createTrial()` in app ✅
2. Trial expires after 3 days ✅
3. Apple charges user → **WEBHOOK SHOULD CONVERT** ❌
4. Webhook fails (payload format) → **USER STUCK ON TRIAL** ❌

### Why It Fails
- Webhook can't read payload → type undefined
- DID_RENEW handler never executes
- User paid but database not updated

### Fix Required
Fix webhook payload parsing + ensure DID_RENEW handler executes for trial conversions.

---

## ISSUE #5: Grace Period/Billing Issues Not Tracked

### Current State
- DID_FAIL_TO_RENEW handler exists ✅
- But webhook never processes it (payload format) ❌
- Grace period logic not executed ❌

### Impact
- Users with payment failures not flagged
- No grace period tracking
- Users lose access immediately instead of 3-day grace

---

# COMPLETE FIX INSTRUCTIONS

## A. Fix Webhook Payload Handling

### Step 1: Update apple-webhook/index.ts

```typescript
// File: supabase/functions/apple-webhook/index.ts

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('[AppleWebhook] Raw payload received');

    // CRITICAL FIX: Handle both v1 and v2 payload formats
    let notificationType: string | undefined;
    let subtype: string | undefined;
    let signedTransactionInfo: string | undefined;

    // Check for v2 format (signedPayload)
    if (body.signedPayload) {
      console.log('[AppleWebhook] v2 format detected (signedPayload)');
      
      // Decode outer signedPayload
      const decodedPayload = decodeJWT(body.signedPayload);
      if (!decodedPayload) {
        console.error('[AppleWebhook] Failed to decode signedPayload');
        return new Response('Bad Request', { status: 400, headers: corsHeaders });
      }

      notificationType = decodedPayload.notificationType;
      subtype = decodedPayload.subtype;
      signedTransactionInfo = decodedPayload.data?.signedTransactionInfo;

      console.log('[AppleWebhook] v2 decoded:', {
        notificationType,
        subtype,
        hasTransactionInfo: !!signedTransactionInfo,
      });
    } 
    // Check for v1 format (body.data.signedTransactionInfo)
    else if (body.notificationType) {
      console.log('[AppleWebhook] v1 format detected');
      notificationType = body.notificationType;
      subtype = body.subtype;
      signedTransactionInfo = body.data?.signedTransactionInfo;
    } 
    else {
      console.error('[AppleWebhook] Unknown payload format');
      return new Response('Bad Request', { status: 400, headers: corsHeaders });
    }

    console.log('[AppleWebhook] Notification:', {
      type: notificationType,
      subtype: subtype,
      timestamp: new Date().toISOString(),
    });

    if (!signedTransactionInfo) {
      console.log('[AppleWebhook] No transaction info, skipping');
      return new Response('OK', { headers: corsHeaders });
    }

    // Rest of webhook logic continues...
    const transaction = decodeTransactionInfo(signedTransactionInfo);
    // ... existing code ...
  }
});

// Add new decodeJWT function for signedPayload
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}
```

---

## B. Configure App Store Connect Webhooks

### Step 1: Go to App Store Connect
1. Navigate to: https://appstoreconnect.apple.com
2. Click **Users and Access**
3. Click **Integrations** tab
4. Click **App Store Server Notifications**

### Step 2: Create Webhook (if not exists)
1. Click **"+"** button to add webhook
2. Enter the following:

**Webhook Configuration:**
```
Name: siFia Production Webhooks
URL: https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/apple-webhook
```

### Step 3: Generate Webhook Secret
1. Click **Generate Secret**
2. Copy the secret Apple provides
3. Update Supabase secrets:

```bash
supabase secrets set APPLE_WEBHOOK_SECRET="<paste-apple-generated-secret>"
```

**Important:** Use Apple's generated secret, not your custom one.

### Step 4: Select Event Triggers
Enable ALL of these:
- ✅ SUBSCRIBED (new subscription)
- ✅ DID_RENEW (trial conversion + renewals)
- ✅ DID_FAIL_TO_RENEW (payment failures)
- ✅ DID_CHANGE_RENEWAL_STATUS (cancellations)
- ✅ EXPIRED (subscription expired)
- ✅ GRACE_PERIOD_EXPIRED (grace period ended)
- ✅ REFUND (refund processed)
- ✅ PRICE_INCREASE (price changes)
- ✅ DID_CHANGE_RENEWAL_PREF (tier changes)

### Step 5: Test Webhook
1. Click **Test** button in App Store Connect
2. Check Supabase logs:
```bash
supabase functions logs apple-webhook
```
3. Should see: `[AppleWebhook] v2 format detected`

---

## C. Verify App Store Connect API Keys

### Step 1: Check Existing Keys
1. Go to: https://appstoreconnect.apple.com
2. Click **Users and Access**
3. Click **Integrations** tab
4. Click **App Store Connect API**
5. Find key: **UNR2UMA26W**

### Step 2: Verify Key Details
```
Key ID: UNR2UMA26W
Issuer ID: 364a1398-a4cc-4488-888c-c9dbf1709855
Access: App Store Connect API
Status: Active
```

### Step 3: Verify Private Key in Supabase
```bash
# Check if key is set
supabase secrets list

# Should show:
# APPLE_KEY_ID
# APPLE_ISSUER_ID
# APPLE_PRIVATE_KEY
```

### Step 4: If Missing, Re-upload Private Key
```bash
# Read private key file
cat /path/to/SubscriptionKey_UNR2UMA26W.p8

# Set in Supabase (paste entire key including headers)
supabase secrets set APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
<paste-key-here>
-----END PRIVATE KEY-----"
```

---

## D. Fix Transaction ID Validation

### Step 1: Add Database Constraint
```sql
-- Add check constraint to prevent invalid transaction IDs
ALTER TABLE user_subscriptions_new 
ADD CONSTRAINT valid_transaction_id 
CHECK (
  original_transaction_id IS NULL 
  OR (
    LENGTH(original_transaction_id) >= 15 
    AND original_transaction_id ~ '^[0-9]+$'
  )
);

ALTER TABLE validated_receipts 
ADD CONSTRAINT valid_transaction_id 
CHECK (
  transaction_id IS NULL 
  OR (
    LENGTH(transaction_id) >= 15 
    AND transaction_id ~ '^[0-9]+$'
  )
);
```

### Step 2: Clean Existing Corrupted IDs
```sql
-- Clear corrupted transaction IDs (let webhooks repopulate)
UPDATE user_subscriptions_new 
SET original_transaction_id = NULL 
WHERE LENGTH(original_transaction_id) < 15 
   OR original_transaction_id !~ '^[0-9]+$';

UPDATE validated_receipts 
SET transaction_id = NULL 
WHERE LENGTH(transaction_id) < 15 
   OR transaction_id !~ '^[0-9]+$';
```

---

## E. Manual Fix for Angel Mary Kathleen

### Immediate Fix (Manual Upgrade)
```sql
-- Angel paid on 2024-12-25, upgrade her to Growth Monthly
UPDATE user_subscriptions_new 
SET 
    tier = 'growth',
    subscription_display_name = 'siFia Growth Monthly',
    playbooks_limit = 20,
    devotionals_limit = 20,
    smart_journaling_enabled = true,
    subscription_start_date = '2024-12-25',
    subscription_end_date = '2025-01-25',  -- Next billing on the 25th
    auto_renew_enabled = true,
    billing_issue = false,
    grace_period_end_date = NULL,
    status = 'active',
    original_transaction_id = NULL,  -- Clear corrupted ID
    updated_at = NOW()
WHERE user_id = '075a3764-40c7-47dc-8d53-be13e9edfce7';
```

---

## F. Verify StoreKit 2 vs StoreKit 1

### Current Setup: StoreKit 1 (react-native-iap)
```typescript
// Evidence: AppleStoreKitService.ts uses react-native-iap
import * as RNIapModule from 'react-native-iap';
```

### Is This Correct?
**YES** - react-native-iap supports:
- ✅ Receipt validation
- ✅ App Store Server Notifications (webhooks)
- ✅ Transaction History API
- ✅ StoreKit 1 and StoreKit 2 compatibility

### No Changes Needed
Your StoreKit implementation is correct. The issue is webhook payload parsing, not StoreKit version.

---

# DEPLOYMENT CHECKLIST

## 1. Fix Webhook Handler
- [ ] Update `apple-webhook/index.ts` with v2 payload handling
- [ ] Deploy: `supabase functions deploy apple-webhook`
- [ ] Test with Apple's test notification

## 2. Configure App Store Connect
- [ ] Add webhook URL
- [ ] Generate and set webhook secret
- [ ] Enable all event triggers
- [ ] Test webhook delivery

## 3. Fix Transaction IDs
- [ ] Add database constraints
- [ ] Clear corrupted IDs
- [ ] Verify with audit query

## 4. Manual Fixes
- [ ] Upgrade Angel Mary Kathleen
- [ ] Identify other affected users from Financial Report
- [ ] Upgrade them manually

## 5. Verify API Keys
- [ ] Confirm key ID: UNR2UMA26W
- [ ] Confirm issuer ID: 364a1398-a4cc-4488-888c-c9dbf1709855
- [ ] Verify private key in Supabase secrets

## 6. Test End-to-End
- [ ] Start new trial (test user)
- [ ] Wait for trial to expire
- [ ] Verify webhook processes DID_RENEW
- [ ] Verify user upgraded to paid tier
- [ ] Check grace period handling (cancel card)

---

# EXPECTED BEHAVIOR AFTER FIXES

## Trial Conversion Flow
1. User starts trial → App creates trial with 3-day limit ✅
2. Apple charges after 3 days → DID_RENEW webhook sent ✅
3. Webhook decodes payload → Detects trial conversion ✅
4. Database updated → User upgraded to paid tier ✅
5. Usage reset → playbooks_used = 0, devotionals_used = 0 ✅

## Billing Failure Flow
1. Apple can't charge card → DID_FAIL_TO_RENEW webhook sent ✅
2. Webhook sets billing_issue = true ✅
3. Grace period activated (3 days) ✅
4. User keeps access during grace period ✅
5. If not resolved → GRACE_PERIOD_EXPIRED → Reverts to seeker ✅

## Renewal Flow
1. Monthly billing date arrives ✅
2. Apple charges user → DID_RENEW webhook sent ✅
3. Usage reset → playbooks_used = 0, devotionals_used = 0 ✅
4. subscription_end_date updated (+30 days) ✅

---

# ROOT CAUSE SUMMARY

## Why Trial Conversions Failed
1. **Webhook payload format mismatch** - Code expects v1, Apple sends v2
2. **No App Store Connect webhook configured** - Apple can't send notifications
3. **Transaction ID corruption** - Can't query Apple API for verification

## Why Grace Period Doesn't Work
1. **Webhook can't process DID_FAIL_TO_RENEW** - Payload parsing fails
2. **No real-time notification delivery** - Webhook not configured

## Why Angel Is Stuck
1. **Webhook failed to process her trial conversion**
2. **Transaction ID corrupted** - Can't query Apple for status
3. **Manual upgrade required** until webhook is fixed

---

# NEXT STEPS

1. **IMMEDIATE:** Fix webhook payload handling (30 min)
2. **IMMEDIATE:** Configure App Store Connect webhooks (15 min)
3. **IMMEDIATE:** Manually upgrade Angel and other paid users (10 min)
4. **CLEANUP:** Add transaction ID validation (20 min)
5. **TEST:** End-to-end trial conversion test (1 hour)
6. **MONITOR:** Watch webhook logs for 48 hours

**Total Time to Fix:** ~2-3 hours
**Impact:** ALL paid users will be upgraded automatically going forward

---

# CONTACT INFORMATION

**Apple Developer Support:** https://developer.apple.com/contact/
**App Store Connect:** https://appstoreconnect.apple.com
**Supabase Dashboard:** https://supabase.com/dashboard/project/aesmrjinczhknchlrsmt
**Webhook Logs:** `supabase functions logs apple-webhook`
