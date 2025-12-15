# Trial Offer to Sales Offer Migration Plan

## Executive Summary
Disable the separate Trial Offer screen to comply with Apple's guidelines. Instead, use Sales Offer screen with `.freetrial` products that include a 3-day free trial configured in App Store Connect.

---

## Key Changes Overview

### Current Flow (Non-Compliant)
```
Onboarding → PlaybookReady → SalesOffer → TrialOffer → NotificationSetup
                                    ↓
                              (User cancels)
                                    ↓
                              TrialOffer → NotificationSetup
```

### New Flow (Apple-Compliant)
```
Onboarding → PlaybookReady → SalesOffer (with .freetrial) → NotificationSetup
                                    ↓
                              (User cancels)
                                    ↓
                              NotificationSetup (Seeker tier)
```

---

## Phase 1: Update Sales Offer Screen

### 1.1 Product ID Selection Logic
**File:** `src/screens/onboarding/OnboardingSalesOfferScreen.tsx`

**Current Logic (Lines 516-608):**
- Uses `.freetrial` products ONLY if `canOfferTrial && !isUpgradeMode`
- Sales Offer explicitly excludes `.freetrial` products (line 585)

**New Logic:**
```typescript
// ALWAYS use .freetrial products for first-time users
// Check if user has ever started a trial
const hasEverStartedTrial = Boolean(subscription?.trial_start_date);

// Use .freetrial product if user has never started trial before
const shouldUseTrialProduct = !hasEverStartedTrial && !isUpgradeMode;

if (shouldUseTrialProduct) {
  // Use .freetrial product ID
  productId = `app.sifia.com.${selectedTier}.${billing}.freetrial`;
} else {
  // Use regular product ID (for repeat purchases or upgrades)
  productId = `app.sifia.com.${selectedTier}.${billing}`;
}
```

**Changes Required:**
- Line 520-523: Remove `DEBUG_FORCE_SALES_OFFER` flag
- Line 580-608: Update product selection to use `.freetrial` when eligible
- Add logic to check `trial_start_date` instead of separate trial eligibility

---

### 1.2 Button Text & Copy Updates
**File:** `src/screens/onboarding/OnboardingSalesOfferScreen.tsx`

**Current Button Text (Line 1838):**
```typescript
Unlock {getTierDisplayName(selectedTier)}
```

**New Button Text:**
```typescript
// If eligible for trial (never started before)
hasEverStartedTrial ? 
  `Unlock ${getTierDisplayName(selectedTier)}` : 
  'Start your free 3-day trial'
```

**Additional Copy Changes:**
1. **Pricing Display** (Lines 1600-1650):
   - Show "3 days free, then $X.XX/month" when using `.freetrial` product
   - Show regular pricing for repeat purchases

2. **Feature List** (Lines 1400-1500):
   - Add "Includes: 2 playbooks + 2 devotionals to get you started" for trial-eligible users
   - Hide this for repeat purchases

---

### 1.3 Trial Limits Display
**File:** `src/screens/onboarding/OnboardingSalesOfferScreen.tsx`

**New Section to Add (after pricing summary):**
```typescript
{!hasEverStartedTrial && (
  <View style={styles.trialBenefitsContainer}>
    <ThemedText weight="semiBold" style={styles.trialBenefitsTitle}>
      What you get during your trial:
    </ThemedText>
    <View style={styles.trialBenefitItem}>
      <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
      <ThemedText style={styles.trialBenefitText}>
        2 playbooks + 2 devotionals to get you started
      </ThemedText>
    </View>
    <View style={styles.trialBenefitItem}>
      <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
      <ThemedText style={styles.trialBenefitText}>
        Full access to {getTierDisplayName(selectedTier)} features
      </ThemedText>
    </View>
    <View style={styles.trialBenefitItem}>
      <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
      <ThemedText style={styles.trialBenefitText}>
        Cancel anytime before trial ends
      </ThemedText>
    </View>
  </View>
)}
```

---

## Phase 2: Remove Trial Offer Navigation

### 2.1 Sales Offer Screen - Remove Trial Navigation
**File:** `src/screens/onboarding/OnboardingSalesOfferScreen.tsx`

**Lines to Remove/Update:**

1. **Line 340-476: `handleClose()` function**
   - Remove all `OnboardingTrialOffer` navigation calls
   - Lines 356-363: Remove trial navigation in onboarding flow
   - Lines 410-428: Remove trial navigation from profile context
   - Lines 441-460: Remove trial navigation for cancelled sales

**New `handleClose()` logic:**
```typescript
const handleClose = async () => {
  try { triggerLightHaptic(); } catch {}

  logger.info('Sales offer cancelled - navigating to notification setup');

  // Track opt-out for dynamic pricing
  try {
    await pricingService.trackOptOut(user?.id);
    const discount = await pricingService.getDynamicDiscount();
    
    if (discount && !isUpgradeMode) {
      setDynamicDiscount(discount);
      setShowDynamicModal(true);
      return;
    }
  } catch (error) {
    logger.error('Error checking dynamic discount', error as Error);
  }

  // Navigate based on context
  if (routeParams?.returnTo === 'UserProfile') {
    navigation.goBack();
    return;
  }

  // Default: go to notification setup
  setTimeout(() => {
    if (!routeParams?.skipNotificationPreference) {
      (navigation as any).navigate('OnboardingNotificationSetup', {
        userType: 'freemium',
        fromCancelledSales: true,
      });
    } else {
      navigation.goBack();
    }
  }, 100);
};
```

---

### 2.2 Playbook Ready Screen - Remove Trial Navigation
**File:** `src/screens/onboarding/OnboardingPlaybookReadyScreenNew.tsx`

**Lines 79-85:** Update navigation guard
```typescript
// Remove OnboardingSalesOffer from allowed navigation
// Only allow MainTabs
if (e.data?.action?.payload?.name === 'MainTabs') {
  return; // Let it proceed
}
```

**Lines 430-436:** Already navigates to SalesOffer - no changes needed

---

### 2.3 Dynamic Pricing Modal
**File:** `src/components/DynamicPricingModal.tsx`

Search for any `OnboardingTrialOffer` navigation and replace with direct navigation to `OnboardingNotificationSetup`.

---

## Phase 3: Update Feature Gating

### 3.1 Devotional Modal
**File:** `src/components/DevotionalModal.tsx`

**Search Pattern:** `OnboardingSalesOffer` navigation calls

**Changes:**
- Ensure all upgrade flows go directly to `OnboardingSalesOffer`
- Remove any trial offer navigation
- Update route params to include `upgradeMode: true`

---

### 3.2 Playbook Detail Screen
**File:** `src/screens/PlaybookDetailScreenNew.tsx`

**Search Pattern:** `OnboardingSalesOffer` navigation

**Verify:**
- Feature gating navigates to `OnboardingSalesOffer` with `upgradeMode: true`
- No trial offer navigation exists

---

### 3.3 User Profile Screen
**File:** `src/screens/UserProfileScreen.tsx`

**Search Pattern:** `OnboardingSalesOffer` navigation

**Verify:**
- Usage counter upgrade flows go to `OnboardingSalesOffer`
- Profile settings upgrade goes to `OnboardingSalesOffer`

---

### 3.4 Calendar & Planning Gating
**Files:**
- `src/hooks/useCalendarGating.ts`
- `src/hooks/usePlanningGating.ts`

**Verify:**
- All gating hooks navigate to `OnboardingSalesOffer`
- No trial offer navigation

---

### 3.5 Journal Editors
**Files:**
- `src/components/journal/ReflectionLogEditor.tsx`
- `src/components/journal/GratitudeLogEditor.tsx`
- `src/components/journal/PrayerLogEditor.tsx`
- `src/components/journal/TimeBlockLogEditor.tsx`

**Verify:**
- Smart journaling gating navigates to `OnboardingSalesOffer`
- No trial offer navigation

---

## Phase 4: Navigation & Types Cleanup

### 4.1 Remove Trial Offer from Navigation Types
**File:** `src/navigation/types.ts`

**Lines 35-38:** Remove or comment out
```typescript
// OnboardingTrialOffer: {
//   source?: string;
//   feature?: string;
// } | undefined;
```

---

### 4.2 Remove Trial Offer Screen Registration
**File:** `src/navigation/RootStackNavigator.tsx`

**Lines 251-260:** Comment out or remove
```typescript
// <Stack.Screen
//   name="OnboardingTrialOffer"
//   component={OnboardingTrialOfferScreen as React.ComponentType}
//   options={{
//     headerShown: false,
//     presentation: 'modal',
//     animation: 'slide_from_bottom',
//     animationDuration: 350,
//     gestureEnabled: true,
//     gestureDirection: 'vertical',
//   }}
// />
```

---

### 4.3 Archive Trial Offer Screen
**File:** `src/screens/onboarding/OnboardingTrialOfferScreen.tsx`

**Action:** Rename to `OnboardingTrialOfferScreen.tsx.archived`

This preserves the code for reference but removes it from the build.

---

## Phase 5: Database & Service Updates

### 5.1 Subscription Service - Trial Start Logic
**File:** `src/services/NewSubscriptionService.ts`

**Lines 131-183: `startFreeTrial()` function**

**Current Behavior:**
- Creates subscription with `tier: 'free_trial'`
- Sets `playbooks_limit: 2`, `devotionals_limit: 2`
- Sets `trial_start_date` and `trial_end_date`

**New Behavior:**
- This function is now called AFTER Apple purchase succeeds
- Apple's `.freetrial` product handles the 3-day trial period
- Our database just tracks the trial limits (2/2)

**No changes needed** - function already works correctly!

---

### 5.2 Apple StoreKit Service
**File:** `src/services/AppleStoreKitService.ts`

**Verify:**
- Handles `.freetrial` product purchases correctly
- Calls `NewSubscriptionService.startFreeTrial()` after purchase validation
- Sets up trial limits (2 playbooks + 2 devotionals)

**No changes needed** - service already handles `.freetrial` products!

---

## Phase 6: Testing Checklist

### 6.1 New User Flow (First Time)
- [ ] Complete onboarding
- [ ] See playbook ready screen
- [ ] Tap "Continue" → Goes to Sales Offer
- [ ] Button shows "Start your free 3-day trial"
- [ ] Pricing shows "3 days free, then $X.XX/month"
- [ ] Shows "2 playbooks + 2 devotionals to get you started"
- [ ] Purchase uses `.freetrial` product
- [ ] Trial starts with 2/2 limits
- [ ] Navigate to notification setup

### 6.2 New User Flow (Cancel)
- [ ] Complete onboarding
- [ ] See playbook ready screen
- [ ] Tap "Continue" → Goes to Sales Offer
- [ ] Tap "X" to close
- [ ] Goes directly to Notification Setup (Seeker tier)
- [ ] No trial offer screen appears

### 6.3 Repeat Purchase Flow
- [ ] User already completed trial
- [ ] Navigate to Sales Offer from feature gating
- [ ] Button shows "Unlock [Tier Name]"
- [ ] Pricing shows regular price (no trial mention)
- [ ] No "2 playbooks + 2 devotionals" message
- [ ] Purchase uses regular product (no `.freetrial`)
- [ ] Full tier limits applied

### 6.4 Upgrade Flow (From Seeker)
- [ ] Seeker user hits playbook limit
- [ ] Upgrade modal appears
- [ ] Tap "Upgrade" → Goes to Sales Offer
- [ ] `upgradeMode: true` in route params
- [ ] Shows appropriate upgrade tiers
- [ ] Purchase completes and returns to previous screen

### 6.5 Upgrade Flow (From Paid Tier)
- [ ] Spark user hits limit
- [ ] Upgrade modal appears
- [ ] Tap "Upgrade" → Goes to Sales Offer
- [ ] Only shows Growth and Transformation tiers
- [ ] Purchase completes and returns to previous screen

---

## Implementation Order

### Step 1: Update Sales Offer Screen ✅
1. Update product ID selection logic
2. Add trial eligibility check based on `trial_start_date`
3. Update button text (dynamic based on trial eligibility)
4. Add trial benefits section
5. Update pricing display

### Step 2: Remove Trial Navigation ✅
1. Update `handleClose()` in Sales Offer
2. Remove all `OnboardingTrialOffer` navigation calls
3. Update navigation guards in Playbook Ready

### Step 3: Verify Feature Gating ✅
1. Check all feature gating modals
2. Verify upgrade flows
3. Test all entry points to Sales Offer

### Step 4: Clean Up Navigation ✅
1. Update navigation types
2. Remove screen registration
3. Archive trial offer screen file

### Step 5: Test All Flows ✅
1. Test new user onboarding
2. Test repeat purchase
3. Test upgrade flows
4. Test cancellation flows

---

## Files Modified Summary

### Core Changes (Must Modify)
1. `src/screens/onboarding/OnboardingSalesOfferScreen.tsx` - Main changes
2. `src/navigation/RootStackNavigator.tsx` - Remove screen registration
3. `src/navigation/types.ts` - Remove type definition

### Verification Needed (Check for Trial Navigation)
4. `src/components/DevotionalModal.tsx`
5. `src/screens/PlaybookDetailScreenNew.tsx`
6. `src/screens/UserProfileScreen.tsx`
7. `src/hooks/useCalendarGating.ts`
8. `src/hooks/usePlanningGating.ts`
9. `src/components/journal/ReflectionLogEditor.tsx`
10. `src/components/journal/GratitudeLogEditor.tsx`
11. `src/components/journal/PrayerLogEditor.tsx`
12. `src/components/journal/TimeBlockLogEditor.tsx`
13. `src/components/DynamicPricingModal.tsx`

### Archive
14. `src/screens/onboarding/OnboardingTrialOfferScreen.tsx` → `.archived`

---

## Risk Mitigation

### Risk 1: Users Who Already Started Trial
**Mitigation:** Check `trial_start_date` field - if exists, use regular products

### Risk 2: Apple Review Rejection
**Mitigation:** Ensure all trial messaging matches App Store Connect configuration

### Risk 3: Product ID Mismatch
**Mitigation:** Log all product IDs during purchase, verify `.freetrial` products exist

### Risk 4: Navigation Loops
**Mitigation:** Remove all trial offer navigation, direct flow to notification setup

---

## Success Criteria

✅ No separate trial offer screen in navigation flow
✅ Sales offer uses `.freetrial` products for first-time users
✅ Button text shows "Start your free 3-day trial" for eligible users
✅ Shows "2 playbooks + 2 devotionals to get you started" for trial
✅ Repeat purchases use regular products without trial
✅ All feature gating flows work correctly
✅ No navigation loops or dead ends
✅ Apple review compliance achieved

---

## Rollback Plan

If issues arise:
1. Revert `OnboardingSalesOfferScreen.tsx` changes
2. Re-enable `OnboardingTrialOfferScreen` registration
3. Restore navigation types
4. Re-add trial navigation in `handleClose()`

All changes are isolated to navigation and product selection logic - no database schema changes required.
