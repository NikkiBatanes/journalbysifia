# StoreKit Trial Issue - Diagnosis & Fix

## Problem
When subscribing through the **Sales Offer Screen** in TestFlight, Apple is showing "3 day free trial" even though this screen should offer immediate paid subscriptions (no trial).

## Root Cause
Your app has a **two-screen subscription strategy**:

1. **Sales Offer Screen** (`OnboardingSalesOfferScreen.tsx`) - Should offer PAID subscriptions (no trial)
2. **Trial Offer Screen** (`OnboardingTrialOfferScreen.tsx`) - Should offer 3-day FREE TRIAL subscriptions

This requires **TWO SEPARATE PRODUCTS** in App Store Connect for each tier/billing combination:

### Non-Trial Products (for Sales Offer Screen)
- `app.sifia.com.spark.monthly`
- `app.sifia.com.spark.annual`
- `app.sifia.com.growth.monthly`
- `app.sifia.com.growth.annual`
- `app.sifia.com.transformation.monthly`
- `app.sifia.com.transformation.annual`
- `app.sifia.com.family.monthly`
- `app.sifia.com.family.annual`

**Configuration:** NO introductory offers, NO free trial

### Trial Products (for Trial Offer Screen)
- `app.sifia.com.spark.monthly.freetrial`
- `app.sifia.com.spark.annual.freetrial`
- `app.sifia.com.growth.monthly.freetrial`
- `app.sifia.com.growth.annual.freetrial`
- `app.sifia.com.transformation.monthly.freetrial`
- `app.sifia.com.transformation.annual.freetrial`
- `app.sifia.com.family.monthly.freetrial`
- `app.sifia.com.family.annual.freetrial`

**Configuration:** 3-day free trial introductory offer

## Why You're Seeing "3 Day Free Trial"

One of these scenarios is happening:

### Scenario 1: Missing Non-Trial Products
The non-trial products (without `.freetrial` suffix) don't exist in App Store Connect. When the code tries to purchase, it falls back to constructing the product ID, but Apple doesn't recognize it, so it might be using a trial product instead.

### Scenario 2: Non-Trial Products Have Trial Configured
The non-trial products exist BUT they also have a 3-day free trial introductory offer configured in App Store Connect (which is wrong).

### Scenario 3: Both Products in Same Subscription Group
Both trial and non-trial products are in the same subscription group, and Apple is automatically applying the trial offer to all products in that group.

## How to Fix

### Step 1: Check App Store Connect Configuration

1. Go to **App Store Connect** → Your App → **Subscriptions**
2. For each tier (spark, growth, transformation, family):
   - Verify you have BOTH the regular product AND the `.freetrial` product
   - Check that regular products have **NO introductory offers**
   - Check that `.freetrial` products have **3-day free trial** configured

### Step 2: Verify Subscription Groups

Both types of products should be in the **SAME subscription group** so users can only have one active subscription at a time. However, Apple should respect the individual product's introductory offer configuration.

### Step 3: Check TestFlight Logs

The code now includes comprehensive debugging. When you test in TestFlight:

1. Open the Sales Offer Screen
2. Try to subscribe
3. Check the logs for these messages:

```
📦 All available products from App Store:
  - Shows all products Apple returned
  
✅ Found non-trial product for Sales Offer
  - Shows which product was selected
  
❌ No non-trial product found!
  - Shows what was searched for vs what was found
```

This will tell you exactly which products Apple is returning and which one is being selected.

### Step 4: Test the Fix

After configuring App Store Connect correctly:

1. Wait 1-2 hours for changes to propagate to TestFlight
2. Delete and reinstall the TestFlight app
3. Test subscribing through the Sales Offer Screen
4. It should show immediate payment (e.g., "$9.99/month") with NO trial mention
5. Test subscribing through the Trial Offer Screen
6. It should show "Free for 3 days, then $9.99/month"

## Code Changes Made

I've updated `OnboardingSalesOfferScreen.tsx` to:

1. **Explicitly exclude** `.freetrial` products when selecting a product:
   ```typescript
   const targetProduct = products.find(p =>
     p.tier === selectedTier &&
     p.productId.includes(billing) &&
     !p.productId.includes('.freetrial')  // ← This is critical
   );
   ```

2. **Add comprehensive debugging** to help diagnose the issue:
   - Logs all available products from App Store
   - Shows exactly what the code is looking for
   - Shows what products match the tier and billing period

## Important Notes

### Apple's Trial Eligibility Rules
- Users can only get ONE free trial per subscription group
- If a user already used a trial on any product in the group, Apple won't offer trials on other products
- This is enforced by Apple, not your app

### TestFlight Sandbox Behavior
- In TestFlight/Sandbox, you can test trials multiple times by deleting and reinstalling
- In production, Apple enforces the one-trial-per-user rule strictly

### Product ID Naming Convention
The `.freetrial` suffix is just a naming convention to help you distinguish the products. Apple doesn't care about the suffix - it only looks at the introductory offer configuration in App Store Connect.

## Next Steps

1. ✅ Code is now fixed to explicitly exclude trial products
2. ⏳ Check App Store Connect configuration
3. ⏳ Wait for changes to propagate to TestFlight
4. ⏳ Test and verify the fix works

## Questions to Answer

When you test in TestFlight, check the logs and answer:

1. How many products does Apple return? (Should be 16 total: 8 regular + 8 trial)
2. Does it find a non-trial product for your selected tier?
3. If not, which products ARE available for that tier?
4. What product ID is actually being used for the purchase?

This will help us determine if the issue is in App Store Connect configuration or somewhere else.
