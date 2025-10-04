# 📋 Phase 2 Completion Guide
## Configure Subscription Details & Shared Secret

**Status:** Phase 1 ✅ | Phase 2.1-2.2 ✅ | **Phase 2.3-2.4 ⚠️ IN PROGRESS**

---

## ✅ COMPLETED SO FAR

### Phase 1: App Store Connect Setup
- ✅ Apple Developer Account created
- ⚠️ Tax and banking information (pending - can complete later)

### Phase 2.1: Subscription Group Created
- ✅ **Group Name:** "siFia Subscriptions"
- ✅ **Reference Name:** "siFia Subscriptions"

### Phase 2.2: Products Created
You've created products with this pattern:
- ✅ **Reference Name:** siFia Spark Monthly
- ✅ **Product ID:** app.sifia.com.spark.monthly
- ⚠️ **Status:** Missing metadata

---

## 🎯 NEXT STEPS: Complete Subscription Details

### **2.3 Configure Subscription Details**

You need to complete this for **ALL 8 subscriptions** (4 tiers × 2 billing cycles):
1. siFia Spark Monthly
2. siFia Spark Annual
3. siFia Growth Monthly
4. siFia Growth Annual
5. siFia Transformation Monthly
6. siFia Transformation Annual
7. siFia Family Monthly
8. siFia Family Annual

---

## 📝 STEP-BY-STEP INSTRUCTIONS FOR EACH SUBSCRIPTION

### **Step 1: Add Subscription Display Name**

For each subscription in App Store Connect:

1. Click on the subscription (e.g., "siFia Spark Monthly")
2. Go to **"Subscription Localizations"** section
3. Click **"Add Localization"** or edit existing
4. Select **"English (U.S.)"**
5. Fill in:

**Display Name Examples:**
```
Spark Monthly → "siFia Spark - Monthly"
Spark Annual → "siFia Spark - Annual"
Growth Monthly → "siFia Growth - Monthly"
Growth Annual → "siFia Growth - Annual"
Transformation Monthly → "siFia Transformation - Monthly"
Transformation Annual → "siFia Transformation - Annual"
Family Monthly → "siFia Family - Monthly"
Family Annual → "siFia Family - Annual"
```

---

### **Step 2: Add Description (What User Gets)**

For each tier, use these descriptions:

#### **SPARK Tier Description:**
```
Ignite your faith journey with:
• Unlimited AI-powered playbooks
• Daily devotionals & Bible verses
• Smart journaling with AI insights
• Prayer tracking & reminders
• Faith points & streak tracking
• Priority support

Perfect for individuals seeking spiritual growth.
```

#### **GROWTH Tier Description:**
```
Accelerate your spiritual growth with:
• Everything in Spark
• Advanced AI coaching & personalization
• Deeper biblical insights
• Enhanced devotional content
• Priority generation queue
• Early access to new features

Ideal for committed believers pursuing transformation.
```

#### **TRANSFORMATION Tier Description:**
```
Transform your life with Christ:
• Everything in Growth
• Premium AI intelligence
• Personalized spiritual mentoring
• Advanced analytics & insights
• Custom devotional series
• VIP support & coaching

For those seeking profound spiritual transformation.
```

#### **FAMILY Tier Description:**
```
Grow together in faith:
• Everything in Transformation
• Up to 6 family member accounts
• Family devotionals & challenges
• Shared prayer lists
• Family progress tracking
• Dedicated family support

Perfect for families building faith together.
```

---

### **Step 3: Upload Screenshot (Optional but Recommended)**

**Recommended:** Upload a screenshot showing the subscription tier benefits.

**Screenshot Requirements:**
- Size: 640 x 920 pixels (portrait)
- Format: PNG or JPG
- Content: Show app interface with tier features highlighted

**Quick Option:** You can skip this for now and add later before production launch.

---

### **Step 4: Set Subscription Level (Ranking)**

This determines upgrade/downgrade behavior:

1. Go to each subscription
2. Find **"Subscription Level"** field
3. Set levels:

```
Spark Monthly → Level 1
Spark Annual → Level 1
Growth Monthly → Level 2
Growth Annual → Level 2
Transformation Monthly → Level 3
Transformation Annual → Level 3
Family Monthly → Level 4
Family Annual → Level 4
```

**Why this matters:**
- Level 1 → Level 2 = Upgrade (immediate)
- Level 2 → Level 1 = Downgrade (at end of period)
- Same level (Monthly ↔ Annual) = Crossgrade

---

### **Step 5: Configure Free Trial (3 Days)**

For **EACH** subscription:

1. Click on the subscription
2. Go to **"Subscription Prices"** section
3. Click **"Add Free Trial"** or **"Edit Free Trial"**
4. Configure:

```
Trial Duration: 3 Days
Eligibility: New Subscribers Only
Countries/Regions: All territories
```

5. Click **"Save"**

**IMPORTANT:** 
- Only NEW subscribers get the trial
- After 3 days, they're automatically charged
- Users can cancel anytime during trial

---

### **Step 6: Set Introductory Offer (Optional)**

**Skip this for now** unless you want to offer special pricing.

Examples of introductory offers:
- First month 50% off
- First 3 months at reduced price
- Pay-as-you-go for first month

**Recommendation:** Start without introductory offers, add later if needed.

---

### **Step 7: Add Localized Content**

If you want to support other languages:

1. Click **"Add Localization"**
2. Select language (e.g., Spanish, Chinese)
3. Translate display name and description
4. Save

**For now:** Just complete English (U.S.) localization.

---

## 🔐 STEP 8: Set Up Shared Secret (CRITICAL)

### **2.4 Generate App-Specific Shared Secret**

This is **REQUIRED** for receipt validation.

#### **Instructions:**

1. **Navigate to Shared Secret:**
   - Go to App Store Connect
   - Click on your app ("siFia")
   - Go to **"Features"** → **"In-App Purchases"**
   - Scroll down to **"App-Specific Shared Secret"** section

2. **Generate Secret:**
   - Click **"Generate"** button
   - A long string will appear (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
   - **COPY THIS IMMEDIATELY** - you can only view it once!

3. **Save to Environment File:**
   
   Open or create `.env` file in your project root:
   ```bash
   # Apple In-App Purchase Configuration
   APPLE_SHARED_SECRET=paste_your_generated_secret_here
   
   # Example (DO NOT use this - use your actual secret):
   # APPLE_SHARED_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

4. **Add to .gitignore:**
   
   Verify `.env` is in your `.gitignore` file:
   ```
   # Environment variables
   .env
   .env.local
   .env.production
   ```

5. **Update Production Environment:**
   
   For production deployment, add the secret to:
   - Supabase Edge Functions environment variables
   - Your backend server environment variables
   - CI/CD pipeline secrets

---

## 🎨 RECOMMENDED PRICING STRUCTURE

Based on your app's value proposition:

| Tier | Monthly | Annual | Annual Savings |
|------|---------|--------|----------------|
| **Spark** | $9.99 | $99.99 | 17% ($20 off) |
| **Growth** | $19.99 | $199.99 | 17% ($40 off) |
| **Transformation** | $29.99 | $299.99 | 17% ($60 off) |
| **Family** | $39.99 | $399.99 | 17% ($80 off) |

**Why 17% discount for annual?**
- Industry standard: 15-20% for annual commitment
- Encourages annual subscriptions (better retention)
- Competitive with similar apps

**Alternative Pricing (More Aggressive):**
- 20% discount: Spark Annual = $95.99
- 25% discount: Spark Annual = $89.99

---

## ✅ COMPLETION CHECKLIST

### For EACH of the 8 Subscriptions:

**Spark Monthly (app.sifia.com.spark.monthly):**
- [ ] Display name: "siFia Spark - Monthly"
- [ ] Description added (see above)
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 1
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None (skip)
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $9.99

**Spark Annual (app.sifia.com.spark.annual):**
- [ ] Display name: "siFia Spark - Annual"
- [ ] Description added (see above)
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 1
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None (skip)
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $99.99

**Growth Monthly (app.sifia.com.growth.monthly):**
- [ ] Display name: "siFia Growth - Monthly"
- [ ] Description added
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 2
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $19.99

**Growth Annual (app.sifia.com.growth.annual):**
- [ ] Display name: "siFia Growth - Annual"
- [ ] Description added
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 2
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $199.99

**Transformation Monthly (app.sifia.com.transformation.monthly):**
- [ ] Display name: "siFia Transformation - Monthly"
- [ ] Description added
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 3
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $29.99

**Transformation Annual (app.sifia.com.transformation.annual):**
- [ ] Display name: "siFia Transformation - Annual"
- [ ] Description added
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 3
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $299.99

**Family Monthly (app.sifia.com.family.monthly):**
- [ ] Display name: "siFia Family - Monthly"
- [ ] Description added
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 4
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $39.99

**Family Annual (app.sifia.com.family.annual):**
- [ ] Display name: "siFia Family - Annual"
- [ ] Description added
- [ ] Screenshot uploaded (optional)
- [ ] Subscription level: 4
- [ ] Free trial: 3 days configured
- [ ] Introductory offer: None
- [ ] Localization: English (U.S.) complete
- [ ] Price: Set to $399.99

### Shared Secret:
- [ ] Generated in App Store Connect
- [ ] Copied to `.env` file
- [ ] `.env` added to `.gitignore`
- [ ] Secret saved securely (password manager)

---

## 🚨 COMMON ISSUES & SOLUTIONS

### Issue 1: "Missing Metadata" Status
**Solution:** Complete all fields in subscription localization (display name + description).

### Issue 2: Can't Add Free Trial
**Solution:** Make sure subscription is in "Ready to Submit" status first.

### Issue 3: Shared Secret Not Showing
**Solution:** You need at least one subscription created before the shared secret option appears.

### Issue 4: Products Not Appearing in App
**Solution:** Products must be in "Ready to Submit" status and app must be submitted for review.

---

## ⏱️ TIME ESTIMATE

**Per Subscription:** ~5-10 minutes  
**Total for 8 Subscriptions:** 40-80 minutes  
**Shared Secret Setup:** 5 minutes  

**Total Time:** ~1-1.5 hours

---

## 🎯 AFTER COMPLETION

Once you complete Phase 2.3 and 2.4:

1. **Verify Status:** All 8 subscriptions should show "Ready to Submit"
2. **Test Product IDs:** Products should be fetchable via StoreKit API
3. **Move to Phase 3:** Xcode configuration
4. **Sandbox Testing:** Create test accounts and test purchases

---

## 📞 NEED HELP?

**Apple Documentation:**
- [In-App Purchase Configuration](https://developer.apple.com/in-app-purchase/)
- [Subscription Groups](https://developer.apple.com/app-store/subscriptions/)

**Common Questions:**
- **Q: Can I change product IDs later?**  
  A: No, product IDs are permanent. Choose carefully.

- **Q: Can I change prices later?**  
  A: Yes, you can update prices anytime.

- **Q: Do I need screenshots?**  
  A: Optional but recommended for better conversion.

- **Q: Can I test without completing tax info?**  
  A: Yes, sandbox testing works without tax info.

---

**Next:** Once complete, proceed to **Phase 3: Xcode Configuration** 🚀
