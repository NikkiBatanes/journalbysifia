# COMPLETE PURCHASE FLOW INSPECTION
**Date:** December 27, 2024
**Scope:** Full trial purchase flow from user tap to paid conversion

---

## 🔍 FLOW ANALYSIS: Trial Purchase Journey

### STEP 1: User Taps "Start 3-Day Free Trial"
**Location:** `OnboardingSalesOfferScreen.tsx:1920-1961`

**What Happens:**
1. User taps button on sales offer screen
2. Code checks `shouldUseTrialProduct` flag
3. If trial eligible → Navigate to `OnboardingTrialOffer` screen
4. If NOT trial eligible → Direct purchase flow

**Code Path:**
```typescript
if (shouldUseTrialProduct) {
  navigation.navigate('OnboardingTrialOffer', {
    selectedTierId: selectedTier,
    billing: isAnnual ? 'annual' : 'monthly',
    onboardingFlow: true,
  });
}
```

**Status:** ✅ CORRECT

---

### STEP 2: Trial Offer Screen - Purchase Initiation
**Location:** `OnboardingTrialOfferScreen.tsx:220-436`

**What Happens:**
1. Check if user already on trial (lines 233-253)
   - If yes → Show success modal immediately
   - If no → Continue to purchase

2. Construct product ID (lines 255-278)
   - Check current tier
   - If already on trial → Use regular product
   - If new user → Use `.freetrial` product
   - Format: `app.sifia.com.{tier}.{billing}.freetrial`

3. Verify product exists in App Store (lines 296-408)
   - Initialize payment service
   - Get available products with 3 retry attempts
   - Find specific trial product
   - If not found → Show detailed error

4. Initiate Apple purchase (lines 410-459)
   - Set trial eligibility flag
   - Call `paymentService.purchaseSubscription(productId, userId)`
   - Show Apple payment sheet

**Critical Code:**
```typescript
const productId = isAlreadyOnTrial
  ? `app.sifia.com.${selectedTierId}.${billing}` // Regular product
  : `app.sifia.com.${selectedTierId}.${billing}.freetrial`; // Trial product

result = await paymentService.purchaseSubscription(productId, user.id);
```

**Status:** ✅ CORRECT - Proper product selection logic

---

### STEP 3: Apple Payment Processing
**Location:** `AppleStoreKitService.ts:505-669`

**What Happens:**
1. Initialize StoreKit service
2. Set up purchase listeners (if not already set)
3. Clear stale transactions in background
4. Store userId for purchase handler
5. Record purchase initiation timestamp
6. Create promise for purchase result
7. Call `requestSubscription()` to show Apple payment sheet
8. Wait for user to complete payment
9. Purchase listener receives update

**Critical Code:**
```typescript
this.purchaseInitiatedTimestamp = Date.now();
const purchasePromise = new Promise<PurchaseResult>((resolve, reject) => {
  this.pendingPurchaseResolvers.set(productId, { resolve, reject });
  setTimeout(() => {
    if (this.pendingPurchaseResolvers.has(productId)) {
      this.pendingPurchaseResolvers.delete(productId);
      reject(new Error('Purchase timeout'));
    }
  }, 60000); // 60 second timeout
});

await requestSubscription({ sku: productId });
const result = await purchasePromise;
```

**Status:** ✅ CORRECT - Proper async handling

---

### STEP 4: Purchase Update Handler
**Location:** `AppleStoreKitService.ts:676-900`

**What Happens:**
1. Receive purchase update from Apple
2. Validate purchase freshness (lines 688-720)
   - Check transaction age
   - Reject if older than 10 minutes
   - Prevents stale cached purchases

3. Finish transaction with Apple (lines 721-750)
   - Call `finishTransaction()`
   - Mark as consumed in App Store

4. Check if trial product (lines 823-881)
   - Get user's current tier from database
   - If tier is `seeker` OR `free_trial` → **SKIP database update**
   - Store `original_transaction_id` for webhook lookup
   - Let trial creation happen separately

**CRITICAL FINDING - POTENTIAL ISSUE:**
```typescript
// Lines 839-856
if (currentTier === 'seeker' || currentTier === 'free_trial') {
  Logger.info('Trial-related purchase - skipping database update', {
    message: currentTier === 'seeker'
      ? 'New trial - will be handled by createTrial()'
      : 'User already on trial - webhook will handle conversion after 3 days',
  });
  
  // Store transaction IDs but DON'T update tier
  await supabase
    .from('user_subscriptions_new')
    .update({
      original_transaction_id: purchase.transactionId,
      platform_transaction_id: purchase.transactionId,
      platform_subscription_id: purchase.transactionId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', this.currentUserId);
}
```

**Status:** ⚠️ CORRECT BUT RELIES ON NEXT STEP

---

### STEP 5: Trial Creation in Database
**Location:** `OnboardingTrialOfferScreen.tsx:477-518`

**What Happens:**
1. After successful purchase, call `NewSubscriptionService.startFreeTrial()`
2. This creates/updates subscription record with:
   - `tier: 'free_trial'`
   - `trial_start_date: now`
   - `trial_end_date: now + 3 days`
   - `trial_chosen_tier: selectedTierId` (e.g., 'spark', 'growth')
   - `billing_cycle: 'monthly' or 'annual'`
   - `playbooks_limit: 2`
   - `devotionals_limit: 2`

**Critical Code:**
```typescript
await NewSubscriptionService.startFreeTrial({
  user_id: user.id,
  duration_days: 3,
  trial_chosen_tier: selectedTierId,
  billing_cycle: isAnnual ? 'annual' : 'monthly',
});
```

**Implementation:** `NewSubscriptionService.ts:268-384`
- Uses `upsert` with retry logic (3 attempts)
- Verifies tier is set to `free_trial` after upsert
- Forces correction if tier mismatch detected

**Status:** ✅ CORRECT - Robust retry logic

---

### STEP 6: Subscription Sync
**Location:** `OnboardingTrialOfferScreen.tsx:523-569`

**What Happens:**
1. Call `storeKitService.checkAndSyncSubscriptionStatus()`
2. Invalidate React Query cache
3. Force UI refresh across all hooks

**Status:** ✅ CORRECT

---

### STEP 7: Trial Active (3 Days)
**User Experience:**
- User has `free_trial` tier
- 2 playbooks, 2 devotionals available
- Smart journaling enabled
- No charges yet

**Database State:**
```
tier: 'free_trial'
trial_start_date: '2024-12-27T12:00:00Z'
trial_end_date: '2024-12-30T12:00:00Z'
trial_chosen_tier: 'spark' (or growth/transformation)
billing_cycle: 'monthly' (or annual)
original_transaction_id: '2000000123456789'
playbooks_limit: 2
devotionals_limit: 2
```

**Status:** ✅ CORRECT

---

### STEP 8: Trial Expires - Apple Charges User
**What Happens:**
1. 3 days pass
2. Apple automatically charges user
3. Apple sends `DID_RENEW` webhook to your server

**Webhook URL:** `https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/apple-webhook`

**Status:** ✅ CONFIGURED (you set this up today)

---

### STEP 9: Webhook Receives DID_RENEW
**Location:** `supabase/functions/apple-webhook/index.ts:225-298`

**What Happens:**
1. Webhook receives notification from Apple
2. Decodes signed payload (Version 2 format)
3. Extracts transaction info
4. Finds user by `original_transaction_id`
5. Routes to `DID_RENEW` handler

**Critical Code (AFTER YOUR FIX):**
```typescript
case 'DID_RENEW': {
  const isTrialProduct = (productId || '').includes('freetrial');
  const isNewTrialStart = subscription.tier === 'seeker' && isTrialProduct;
  
  // FIX: Simplified trial conversion detection
  const isTrialConversion = subscription.tier === 'free_trial';
  
  if (isNewTrialStart) {
    // Skip - app handles new trials
    break;
  } else if (isTrialConversion) {
    // CONVERT TRIAL TO PAID
    const actualTier = getTierFromProductId(productId);
    const paidLimits = getTierLimits(actualTier);
    const billingCycle = productId.includes('annual') ? 'annual' : 'monthly';
    
    await supabaseClient
      .from('user_subscriptions_new')
      .update({
        tier: actualTier, // e.g., 'spark', 'growth', 'transformation'
        subscription_display_name: getTierDisplayName(actualTier),
        billing_cycle: billingCycle,
        playbooks_limit: paidLimits.playbooks_limit, // 8, 20, or unlimited
        devotionals_limit: paidLimits.devotionals_limit,
        playbooks_used: 0, // Reset usage
        devotionals_used: 0,
        last_usage_reset: now.toISOString(),
        smart_journaling_enabled: paidLimits.smart_journaling_enabled,
        platform_transaction_id: transactionId,
        subscription_start_date: now.toISOString(),
        subscription_end_date: subscriptionEndDate.toISOString(),
        trial_converted_date: now.toISOString(),
        billing_issue: false,
        grace_period_end_date: null,
        status: 'active',
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId);
  }
}
```

**Status:** ✅ FIXED TODAY - No longer requires `offerType === 1`

---

### STEP 10: User Upgraded to Paid Tier
**Database State After Conversion:**
```
tier: 'spark' (or growth/transformation)
subscription_display_name: 'siFia Spark'
billing_cycle: 'monthly'
playbooks_limit: 10 (spark) or 25 (growth) or 999999 (transformation)
devotionals_limit: 10 (spark) or 25 (growth) or 999999 (transformation)
playbooks_used: 0
devotionals_used: 0
trial_converted_date: '2024-12-30T12:00:00Z'
subscription_start_date: '2024-12-30T12:00:00Z'
subscription_end_date: '2025-01-30T12:00:00Z' (monthly) or '2025-12-30T12:00:00Z' (annual)
status: 'active'
```

**User Experience:**
- Immediately sees paid tier limits
- Can generate 8/20/unlimited playbooks
- Can generate 8/20/unlimited devotionals
- Smart journaling remains enabled

**Status:** ✅ CORRECT (after today's fix)

---

## 🐛 ISSUES FOUND

### Issue #1: Duplicate Trial Creation Logic ❌
**Location:** Two different paths create trials

**Path A:** `OnboardingTrialOfferScreen.tsx:498-503`
```typescript
await NewSubscriptionService.startFreeTrial({
  user_id: user.id,
  duration_days: 3,
  trial_chosen_tier: selectedTierId,
  billing_cycle: isAnnual ? 'annual' : 'monthly',
});
```

**Path B:** `OnboardingSalesOfferScreen.tsx:787-804` (UPGRADE MODE)
```typescript
const trialResult = await TrialManagementService.createTrial(
  user?.id || '',
  selectedTier as SubscriptionTier,
  productId,
  result.transactionId,
  isAnnual ? 'annual' : 'monthly',
);
```

**Problem:** Two different services (`NewSubscriptionService` vs `TrialManagementService`) create trials
- `NewSubscriptionService.startFreeTrial()` does NOT store `original_transaction_id`
- `TrialManagementService.createTrial()` DOES store `original_transaction_id`

**Impact:** If trial is created via `NewSubscriptionService.startFreeTrial()`, webhook cannot find user!

**Evidence:**
`NewSubscriptionService.ts:287-302` - NO `original_transaction_id` field:
```typescript
const subscriptionData = {
  user_id: user_id,
  status: 'active',
  tier: 'free_trial',
  trial_start_date: new Date().toISOString(),
  trial_end_date: trialEndDate.toISOString(),
  trial_chosen_tier: chosenTier,
  billing_cycle: billing_cycle || 'monthly',
  subscription_display_name: displayName,
  playbooks_limit: trialLimits.playbooks_limit,
  devotionals_limit: trialLimits.devotionals_limit,
  smart_journaling_enabled: trialLimits.smart_journaling_enabled,
  playbooks_used: 0,
  devotionals_used: 0,
  updated_at: new Date().toISOString(),
  // ❌ MISSING: original_transaction_id
  // ❌ MISSING: platform_transaction_id
  // ❌ MISSING: platform_subscription_id
};
```

`TrialManagementService.ts:67-89` - HAS `original_transaction_id`:
```typescript
await supabase
  .from('user_subscriptions_new')
  .update({
    tier: 'free_trial',
    subscription_display_name: displayName,
    trial_start_date: trialStartDate.toISOString(),
    trial_end_date: trialEndDate.toISOString(),
    trial_chosen_tier: chosenTier,
    billing_cycle: billingCycle || 'monthly',
    playbooks_limit: trialLimits.playbooks_limit,
    devotionals_limit: trialLimits.devotionals_limit,
    playbooks_used: 0,
    devotionals_used: 0,
    smart_journaling_enabled: trialLimits.smart_journaling_enabled,
    platform_subscription_id: platformSubscriptionId,
    platform_transaction_id: transactionId,
    original_transaction_id: transactionId, // ✅ PRESENT
    subscription_start_date: trialStartDate.toISOString(),
    updated_at: new Date().toISOString(),
  })
```

**Severity:** 🔴 CRITICAL - This breaks trial conversion for OnboardingTrialOfferScreen users

---

### Issue #2: AppleStoreKitService Stores Transaction IDs (Partial Fix) ⚠️
**Location:** `AppleStoreKitService.ts:858-881`

**What Happens:**
After purchase, if user is on `seeker` or `free_trial` tier, StoreKit service stores transaction IDs:
```typescript
if (currentTier === 'seeker' || currentTier === 'free_trial') {
  await supabase
    .from('user_subscriptions_new')
    .update({
      original_transaction_id: purchase.transactionId,
      platform_transaction_id: purchase.transactionId,
      platform_subscription_id: purchase.transactionId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', this.currentUserId);
}
```

**Problem:** This happens AFTER `NewSubscriptionService.startFreeTrial()` is called
- Race condition: Which update wins?
- If `startFreeTrial()` runs after this, it overwrites with missing transaction IDs

**Severity:** ⚠️ MEDIUM - Race condition may cause webhook lookup failures

---

## ✅ WHAT'S WORKING

1. ✅ Product selection logic (trial vs regular)
2. ✅ Apple payment sheet integration
3. ✅ Purchase validation and freshness checks
4. ✅ Webhook configuration (Version 2)
5. ✅ Webhook trial conversion logic (fixed today)
6. ✅ Grace period handling
7. ✅ Database schema (all columns present)

---

## 🔧 REQUIRED FIXES

### Fix #1: Consolidate Trial Creation (CRITICAL)
**Problem:** Two different services create trials, one missing transaction IDs

**Solution:** Update `NewSubscriptionService.startFreeTrial()` to accept and store transaction IDs

**File:** `src/services/NewSubscriptionService.ts`
**Lines:** 268-384

**Required Change:**
```typescript
// Add parameters
static async startFreeTrial(options: TrialStartOptions & {
  platform_transaction_id?: string;
  original_transaction_id?: string;
  platform_subscription_id?: string;
}): Promise<Subscription>

// Update subscriptionData
const subscriptionData = {
  user_id: user_id,
  status: 'active',
  tier: 'free_trial',
  trial_start_date: new Date().toISOString(),
  trial_end_date: trialEndDate.toISOString(),
  trial_chosen_tier: chosenTier,
  billing_cycle: billing_cycle || 'monthly',
  subscription_display_name: displayName,
  playbooks_limit: trialLimits.playbooks_limit,
  devotionals_limit: trialLimits.devotionals_limit,
  smart_journaling_enabled: trialLimits.smart_journaling_enabled,
  playbooks_used: 0,
  devotionals_used: 0,
  updated_at: new Date().toISOString(),
  // ADD THESE:
  platform_transaction_id: options.platform_transaction_id,
  original_transaction_id: options.original_transaction_id,
  platform_subscription_id: options.platform_subscription_id,
};
```

**Then update caller:**
`OnboardingTrialOfferScreen.tsx:498-503`
```typescript
await NewSubscriptionService.startFreeTrial({
  user_id: user.id,
  duration_days: 3,
  trial_chosen_tier: selectedTierId as any,
  billing_cycle: isAnnual ? 'annual' : 'monthly',
  // ADD THESE:
  platform_transaction_id: result.transactionId,
  original_transaction_id: result.transactionId,
  platform_subscription_id: result.transactionId,
});
```

---

### Fix #2: Remove Duplicate Trial Creation Logic
**Problem:** `TrialManagementService.createTrial()` is redundant

**Solution:** Use only `NewSubscriptionService.startFreeTrial()` everywhere

**Files to update:**
- `OnboardingSalesOfferScreen.tsx:787-804` (UPGRADE MODE path)
- `OnboardingSalesOfferScreen.tsx:1003-1020` (ONBOARDING MODE path)

**Change from:**
```typescript
const trialResult = await TrialManagementService.createTrial(
  user?.id || '',
  selectedTier as SubscriptionTier,
  productId,
  result.transactionId,
  isAnnual ? 'annual' : 'monthly',
);
```

**Change to:**
```typescript
await NewSubscriptionService.startFreeTrial({
  user_id: user?.id || '',
  duration_days: 3,
  trial_chosen_tier: selectedTier as any,
  billing_cycle: isAnnual ? 'annual' : 'monthly',
  platform_transaction_id: result.transactionId,
  original_transaction_id: result.transactionId,
  platform_subscription_id: result.transactionId,
});
```

---

## 📊 FLOW DIAGRAM

```
User Taps "Start Trial"
         ↓
OnboardingTrialOfferScreen
         ↓
Construct product ID (.freetrial)
         ↓
Verify product exists
         ↓
Call paymentService.purchaseSubscription()
         ↓
AppleStoreKitService.purchaseSubscription()
         ↓
Show Apple payment sheet
         ↓
User completes payment
         ↓
handlePurchaseUpdate() receives update
         ↓
Check tier: seeker or free_trial?
         ↓ YES
Store transaction IDs only (skip tier update)
         ↓
Return success to screen
         ↓
Screen calls NewSubscriptionService.startFreeTrial() ❌ MISSING TRANSACTION IDS
         ↓
Database: tier = 'free_trial', limits = 2/2
         ↓
[3 DAYS PASS]
         ↓
Apple charges user
         ↓
Apple sends DID_RENEW webhook
         ↓
Webhook looks up user by original_transaction_id ❌ MAY FAIL IF MISSING
         ↓
If found: Convert tier to paid (spark/growth/transformation)
         ↓
Database: tier = paid, limits = 8/20/unlimited
```

---

## 🎯 SUMMARY

### Current State
- ✅ Webhook logic fixed (no longer requires offerType)
- ✅ Webhook deployed
- ✅ App Store Connect configured
- ❌ Trial creation missing transaction IDs
- ❌ Race condition between StoreKit and trial creation

### Impact
- **OnboardingTrialOfferScreen users:** Trial conversion will FAIL (webhook can't find user)
- **OnboardingSalesOfferScreen users:** May work if StoreKit update wins race condition

### Required Action
1. Fix `NewSubscriptionService.startFreeTrial()` to accept transaction IDs
2. Update all callers to pass transaction IDs
3. Test trial conversion flow in sandbox
4. Monitor webhook logs for successful conversions

### Priority
🔴 **CRITICAL** - Must fix before users start trials, or they won't convert to paid
