# 🎁 Promotional Offers Setup Guide (DISABLED FOR LAUNCH)

## ⚠️ IMPORTANT: DISABLED FOR LAUNCH

**Dynamic discount pricing has been DISABLED for the initial launch.**

- Focus on **FREE TRIAL** only for launch
- No promotional offers needed in App Store Connect right now
- Code is ready but commented out
- Can be re-enabled post-launch when ready

## Overview (For Future Reference)
This guide explains how to set up **ONE promotional offer per subscription** (Tier 1 discount only) in App Store Connect when you're ready to enable it post-launch.

---

## 📋 Part 1: App Store Connect Setup

### Step 1: Create ONE Promotional Offer for Each Subscription

For **EACH of your 8 subscriptions**, create **ONLY ONE** promotional offer:

#### **Tier 1 Discount (One Step Down Pricing)**
- **Promotional Offer Reference Name:** `First Month Discount`
- **Promotional Offer Identifier:** `discount_tier_1`
- **Discount Type:** Choose "Pay As You Go" or "Pay Up Front"
- **Duration:** 1 billing period
- **Price:** Set one step down from regular price (Apple will auto-convert to all countries)
  - **Spark Monthly ($7.99):** Set to **$6.99**
  - **Spark Annual ($79.99):** Set to **$69.99**
  - **Growth Monthly ($14.99):** Set to **$12.99**
  - **Growth Annual ($149.99):** Set to **$129.99**
  - **Transformation Monthly ($24.99):** Set to **$19.99**
  - **Transformation Annual ($249.99):** Set to **$219.99**
  - **Family Monthly ($44.99):** Set to **$36.99**
  - **Family Annual ($449.99):** Set to **$399.99**

---

### Step 2: Handle Country-Specific Pricing

#### **For Most Countries:**
1. Set the US price
2. Click **"Generate Prices"** or **"Apply Price Tier"**
3. Apple automatically converts to all 175 countries

#### **For Philippines (Custom Pricing):**
Since you have custom PHP pricing (₱199 instead of Apple's converted ₱449), you need to:

1. After generating prices, click **"View All Countries"**
2. Find **Philippines** in the list
3. Manually override the promotional price (one step down):
   - **Spark Monthly (₱199 base):** Set to **₱149**
   - **Spark Annual (₱1990 base):** Set to **₱1490**
   - **Growth Monthly (₱399 base):** Set to **₱299**
   - **Growth Annual (₱3990 base):** Set to **₱2990**
   - **Transformation Monthly (₱599 base):** Set to **₱449**
   - **Transformation Annual (₱5990 base):** Set to **₱4490**
   - **Family Monthly (₱1290 base):** Set to **₱990**
   - **Family Annual (₱11990 base):** Set to **₱8990**

#### **For Countries with "Same or Higher Price" Warning:**
- Option 1: **Ignore it** - Those countries won't see promotional offers
- Option 2: **Manually adjust** - Lower the price for those specific countries
- Option 3: **Lower US price** - Set a lower base promotional price

---

## 💻 Part 2: How Your Code Works

### **Simplified Discount Flow:**

1. **User opts out** → `pricingService.trackOptOut()` increments count
2. **User returns** → `pricingService.getDynamicDiscount()` returns:
   - **Always 10% discount** → Maps to `discount_tier_1`
   - No escalation, no complexity

3. **Modal displays discount** with actual prices from Apple
4. **User clicks purchase** → Code always uses `discount_tier_1`:

```typescript
// pricingService.ts
getPromotionalOfferIdentifier(10) // Returns 'discount_tier_1'
// Always returns tier_1 regardless of opt-out count
```

5. **Purchase with promotional offer:**

```typescript
// AppleStoreKitService.ts
purchaseSubscription(productId, userId, 'discount_tier_1')
```

6. **Apple charges the promotional price** you set in App Store Connect (one step down)

---

## 🔧 Part 3: Integration in Your Purchase Flow

### **Where to Add the Offer Identifier:**

In your purchase handler (likely in `OnboardingSalesOfferScreen.tsx` or similar):

```typescript
const handlePurchase = async () => {
  // Get the dynamic discount
  const discount = await pricingService.getDynamicDiscount(userId, tierId, billing);
  
  // Map to promotional offer identifier
  const offerIdentifier = discount 
    ? pricingService.getPromotionalOfferIdentifier(discount.percentage)
    : undefined;
  
  // Purchase with promotional offer
  const result = await paymentService.purchaseSubscription(
    productId,
    userId,
    offerIdentifier // Pass the offer identifier
  );
};
```

---

## 🌍 Part 4: Fetching Localized Promotional Prices

### **Display Actual Promotional Prices (Not Calculated):**

```typescript
// Get promotional offers from Apple
const offers = await paymentService.getPromotionalOffers(productId);

// Find the offer for current discount tier
const currentOffer = offers.find(offer => 
  offer.identifier === pricingService.getPromotionalOfferIdentifier(discountPercentage)
);

// Display in user's local currency
<Text>Was: {product.localizedPrice}</Text>
<Text>Now: {currentOffer?.localizedPrice}</Text>
```

This ensures:
- ✅ US users see: "$7.99" → "$5.99"
- ✅ Philippines users see: "₱199" → "₱99"
- ✅ UK users see: "£6.99" → "£4.99"
- ✅ All 175 countries see correct local currency

---

## ✅ Part 5: Checklist

### **App Store Connect (SIMPLIFIED - Only 8 Offers Total):**
- [ ] Create 1 promotional offer for Spark Monthly (`discount_tier_1`)
- [ ] Create 1 promotional offer for Spark Annual (`discount_tier_1`)
- [ ] Create 1 promotional offer for Growth Monthly (`discount_tier_1`)
- [ ] Create 1 promotional offer for Growth Annual (`discount_tier_1`)
- [ ] Create 1 promotional offer for Transformation Monthly (`discount_tier_1`)
- [ ] Create 1 promotional offer for Transformation Annual (`discount_tier_1`)
- [ ] Create 1 promotional offer for Family Monthly (`discount_tier_1`)
- [ ] Create 1 promotional offer for Family Annual (`discount_tier_1`)
- [ ] Override Philippines pricing for all 8 offers
- [ ] Review and handle "same or higher price" warnings (if any)

### **Code Integration:**
- [x] AppleStoreKitService updated to support promotional offers
- [x] PlatformPaymentService updated to pass offer identifiers
- [x] pricingService updated to map percentages to identifiers
- [ ] Update purchase flow to pass offer identifier
- [ ] Update UI to display actual promotional prices from Apple
- [ ] Test with sandbox account

---

## 🧪 Part 6: Testing

### **Sandbox Testing:**
1. Create a sandbox test account in App Store Connect
2. Sign in with sandbox account on device
3. Trigger opt-out flow to get discount
4. Verify promotional price displays correctly
5. Complete purchase with promotional offer
6. Verify subscription activates with correct pricing

### **Test Cases:**
- [ ] 1st opt-out shows discount (Tier 1 - one step down)
- [ ] 2nd+ opt-outs show same discount (always Tier 1)
- [ ] Promotional prices display in local currency
- [ ] Purchase completes successfully with discount
- [ ] Subscription activates with correct tier
- [ ] Discount can only be used once per user

---

## 📝 Notes

- **Promotional offer identifiers are permanent** - Cannot be changed or reused
- **SIMPLIFIED: Only 8 offers total** - 1 offer per subscription (not 24!)
- **Apple handles currency conversion** - You only set US prices (except custom markets like Philippines)
- **Offers are per-user** - Each user can only use a promotional offer once
- **Always shows same discount** - No escalation, always Tier 1 (one step down pricing)

---

## 🚨 Common Issues

### Issue: "Promotional price same or higher than base price"
**Solution:** Manually adjust those countries or ignore (they won't see offers)

### Issue: Philippines shows wrong promotional price
**Solution:** Manually override PHP pricing for each promotional offer

### Issue: Promotional offer not applying at purchase
**Solution:** Verify offer identifier matches exactly (case-sensitive)

### Issue: User sees calculated discount instead of Apple's price
**Solution:** Fetch promotional offers from Apple and display `localizedPrice`

---

## 📞 Next Steps

1. **Complete App Store Connect setup** (Only 8 promotional offers - much simpler!)
2. **Update purchase flow** to pass offer identifier (`discount_tier_1`)
3. **Update UI** to display actual promotional prices from Apple
4. **Test with sandbox account**
5. **Submit for review**

## 🎉 Benefits of Simplified Approach

- ✅ **Only 8 offers to create** instead of 24
- ✅ **No complex escalation logic** - always same discount
- ✅ **Easier to manage** in App Store Connect
- ✅ **Consistent user experience** - predictable discount
- ✅ **Less confusion** for users and developers
- ✅ **Faster setup** - 3x less work!

Good luck! 🎉
