# 🍎 Apple StoreKit - Next Steps Guide
## Updated: October 7, 2025 | 7:15 PM

---

## 📊 OVERALL PROGRESS: 75% COMPLETE

```
Progress Bar: ███████████████░░░░░ 75%
```

| Phase | Status | Completion | Time Remaining |
|-------|--------|------------|----------------|
| **Phase 1: App Store Connect Setup** | ✅ Complete | 90% | 0 min (tax pending) |
| **Phase 2: Subscription Configuration** | ✅ Complete | 100% | 0 min |
| **Phase 3: Code Review & Integration** | ⏳ In Progress | 80% | 30-60 min |
| **Phase 4: Testing** | ⏳ Not Started | 0% | 2-3 hours |
| **Phase 5: App Submission** | ⏳ Not Started | 0% | 1-2 hours |

**Estimated Time to Launch: 4-6 hours**

---

## ✅ WHAT YOU'VE COMPLETED

### Phase 1: App Store Connect Setup (90% Complete)
- ✅ Apple Developer Account active
- ✅ App created in App Store Connect
- ✅ Bundle ID registered: `app.sifia.com`
- ✅ In-App Purchase capability enabled
- ⚠️ Tax and banking information (can complete later)

### Phase 2: Subscription Configuration (100% Complete)
- ✅ Created subscription group: "siFia Subscriptions"
- ✅ Created 16 subscriptions:
  - ✅ 4 tiers (Spark, Growth, Transformation, Family)
  - ✅ 2 billing periods (Monthly, Annual)
  - ✅ 2 variants (With/Without free trial)
- ✅ Configured display names and descriptions
- ✅ Set up 3-day free trial on `.freetrial` products
- ✅ Configured billing grace period (16 days)
- ✅ Generated and saved App-Specific Shared Secret

---

## 🎯 WHAT YOU NEED TO DO NEXT

### **PHASE 3: Code Review & Integration** ⏳ 30-60 minutes

#### Step 3.1: Verify Product IDs in Code (5 minutes)
Your code already has all 16 product IDs defined:

```typescript
// File: src/services/AppleStoreKitService.ts
// Lines 55-79

✅ Monthly (No Trial):
   - app.sifia.com.spark.monthly
   - app.sifia.com.growth.monthly
   - app.sifia.com.transformation.monthly
   - app.sifia.com.family.monthly

✅ Annual (No Trial):
   - app.sifia.com.spark.annual
   - app.sifia.com.growth.annual
   - app.sifia.com.transformation.annual
   - app.sifia.com.family.annual

✅ Monthly (With Trial):
   - app.sifia.com.spark.monthly.freetrial
   - app.sifia.com.growth.monthly.freetrial
   - app.sifia.com.transformation.monthly.freetrial
   - app.sifia.com.family.monthly.freetrial

✅ Annual (With Trial):
   - app.sifia.com.spark.annual.freetrial
   - app.sifia.com.growth.annual.freetrial
   - app.sifia.com.transformation.annual.freetrial
   - app.sifia.com.family.annual.freetrial
```

**Action:** No changes needed - already correct! ✅

---

#### Step 3.2: Verify Shared Secret in .env File (2 minutes)

**Check your `.env` file has:**
```bash
APPLE_SHARED_SECRET=your_actual_secret_here
```

**Action:**
- [ ] Open `/Users/nikkimaebatanes/CascadeProjects/siFia/.env`
- [ ] Verify `APPLE_SHARED_SECRET` is set with the secret you generated
- [ ] Confirm `.env` is in `.gitignore` (already done ✅)

---

#### Step 3.3: Review Purchase Flow Integration (20-40 minutes)

**Files to review:**
1. **OnboardingSalesOfferScreen.tsx** - Where users see subscription options
2. **Your purchase handler** - Where subscription purchase is triggered

**What to check:**
```typescript
// When showing subscriptions to NEW USERS:
// Use .freetrial products (3-day free trial)
const productId = isNewUser 
  ? 'app.sifia.com.growth.monthly.freetrial'  // With trial
  : 'app.sifia.com.growth.monthly';            // Without trial

// When user clicks purchase:
await paymentService.purchaseSubscription(productId, userId);
```

**Action:**
- [ ] Find where subscriptions are displayed to users
- [ ] Ensure new users see `.freetrial` products
- [ ] Ensure existing users/upgrades see regular products
- [ ] Test the logic in your code

---

#### Step 3.4: Add User Eligibility Logic (10-20 minutes)

**Create a helper function:**

```typescript
// src/services/subscriptionEligibilityService.ts

export class SubscriptionEligibilityService {
  /**
   * Determine if user is eligible for free trial
   */
  static async isEligibleForTrial(userId: string): Promise<boolean> {
    // Check if user has ever had a subscription
    const subscription = await NewSubscriptionService.getUserSubscription(userId);
    
    // New users (no subscription history) are eligible
    if (!subscription) {
      return true;
    }
    
    // Users who have never had a paid subscription are eligible
    if (subscription.tier === 'basic' || subscription.tier === 'free_trial') {
      return true;
    }
    
    // Users with subscription history are NOT eligible
    return false;
  }

  /**
   * Get the correct product ID based on trial eligibility
   */
  static getProductId(
    tier: 'spark' | 'growth' | 'transformation' | 'family',
    billing: 'monthly' | 'annual',
    isEligibleForTrial: boolean
  ): string {
    const base = `app.sifia.com.${tier}.${billing}`;
    return isEligibleForTrial ? `${base}.freetrial` : base;
  }
}
```

**Action:**
- [ ] Create this file or add this logic to existing service
- [ ] Use it in your purchase flow

---

### **PHASE 4: Testing** ⏳ 2-3 hours

#### Step 4.1: Create Sandbox Test Account (10 minutes)

**In App Store Connect:**
1. Go to **"Users and Access"** (top navigation)
2. Click **"Sandbox"** tab
3. Click **"Testers"** in left sidebar
4. Click **"+"** to add new tester
5. Fill in:
   - **First Name:** Test
   - **Last Name:** User
   - **Email:** testuser+sifia@yourdomain.com
   - **Password:** Create a strong password
   - **Country/Region:** United States (or your test market)
6. Click **"Invite"**
7. **Save credentials** in password manager

**Action:**
- [ ] Create sandbox test account
- [ ] Save credentials securely

---

#### Step 4.2: Configure Test Device (15 minutes)

**On your iPhone/iPad:**
1. Go to **Settings** → **App Store**
2. Scroll down to **"Sandbox Account"**
3. Sign in with your sandbox test account
4. **Important:** Do NOT sign in with sandbox account in regular Settings → Apple ID
5. Only use it in Settings → App Store → Sandbox Account

**Action:**
- [ ] Sign in to sandbox account on test device
- [ ] Verify you're signed in (Settings → App Store → Sandbox Account)

---

#### Step 4.3: Test Subscription Purchase Flow (1-2 hours)

**Test Case 1: New User with Free Trial**
- [ ] Create new user account in your app
- [ ] Navigate to subscription screen
- [ ] Verify `.freetrial` products are shown
- [ ] Select Growth Monthly (with trial)
- [ ] Complete purchase (should show $0.00 for trial)
- [ ] Verify subscription activates immediately
- [ ] Verify user has Growth tier features
- [ ] Check database: subscription status should be 'active'

**Test Case 2: Subscription Without Trial**
- [ ] Create another user account
- [ ] Mark user as "not eligible for trial" (or use existing user)
- [ ] Navigate to subscription screen
- [ ] Verify regular products (no trial) are shown
- [ ] Select Spark Monthly
- [ ] Complete purchase (should charge immediately)
- [ ] Verify subscription activates
- [ ] Check database: subscription status should be 'active'

**Test Case 3: Restore Purchases**
- [ ] Delete and reinstall app
- [ ] Sign in with same user
- [ ] Tap "Restore Purchases"
- [ ] Verify subscription is restored
- [ ] Verify user still has tier features

**Test Case 4: Subscription Cancellation**
- [ ] Go to Settings → App Store → Sandbox Account
- [ ] Tap on your email
- [ ] Tap "Manage"
- [ ] Find siFia subscription
- [ ] Cancel subscription
- [ ] Verify app handles cancellation gracefully
- [ ] Verify user retains access until period ends

**Action:**
- [ ] Complete all 4 test cases
- [ ] Document any issues found
- [ ] Fix issues before proceeding

---

#### Step 4.4: Test Trial Expiration (Optional - can test in production)

**Note:** Trial expiration takes 3 days in production, but sandbox accelerates time:
- 3-day trial = 3 minutes in sandbox
- 1 month = 5 minutes in sandbox
- 1 year = 1 hour in sandbox

**Test:**
- [ ] Purchase trial subscription
- [ ] Wait 3 minutes
- [ ] Verify trial expires
- [ ] Verify user is charged for first billing period
- [ ] Verify subscription continues as paid

---

### **PHASE 5: App Submission** ⏳ 1-2 hours

#### Step 5.1: Build and Upload App Binary (30-60 minutes)

**Build for iOS:**
```bash
# Navigate to iOS folder
cd ios

# Install pods
pod install

# Go back to root
cd ..

# Build and archive
# Option A: Using Xcode
# - Open ios/siFia.xcworkspace in Xcode
# - Select "Any iOS Device" as target
# - Product → Archive
# - Upload to App Store Connect

# Option B: Using command line (if configured)
npx expo build:ios
```

**Action:**
- [ ] Build your app
- [ ] Archive the build
- [ ] Upload to App Store Connect
- [ ] Wait for processing (10-30 minutes)

---

#### Step 5.2: Create App Version and Add Subscriptions (15 minutes)

**In App Store Connect:**
1. Go to **"My Apps"** → **"siFia"**
2. Click **"+"** next to iOS App
3. Select **"1.0"** (or your version number)
4. Fill in version information
5. Scroll to **"In-App Purchases and Subscriptions"**
6. Click **"+"** button
7. **Select ALL 16 subscriptions** to include in this version
8. Click **"Done"**

**Action:**
- [ ] Create app version
- [ ] Add all 16 subscriptions to version
- [ ] Save

---

#### Step 5.3: Set Subscription Levels (5 minutes)

**Now the subscription level field will appear!**

For each subscription, set the level:
- [ ] All Spark subscriptions → **Level 1**
- [ ] All Growth subscriptions → **Level 2**
- [ ] All Transformation subscriptions → **Level 3**
- [ ] All Family subscriptions → **Level 4**

**Action:**
- [ ] Set levels for all 16 subscriptions
- [ ] Save each one

---

#### Step 5.4: Complete App Submission Form (30 minutes)

**Fill in required fields:**
- [ ] App name
- [ ] Subtitle
- [ ] Description
- [ ] Keywords
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Screenshots (all required sizes)
- [ ] App icon
- [ ] Age rating
- [ ] Copyright
- [ ] Contact information

**Subscription-specific:**
- [ ] Add subscription screenshot showing pricing
- [ ] Add review notes explaining subscription features
- [ ] Provide test account credentials (if needed)

**Action:**
- [ ] Complete all required fields
- [ ] Upload all assets
- [ ] Review everything

---

#### Step 5.5: Submit for Review (5 minutes)

**Final checks:**
- [ ] All subscriptions are included in version
- [ ] Subscription levels are set
- [ ] App binary is uploaded and processed
- [ ] All metadata is complete
- [ ] Screenshots uploaded
- [ ] Review notes added

**Submit:**
1. Click **"Add for Review"** button
2. Click **"Submit to App Review"**
3. Wait for confirmation email

**Action:**
- [ ] Submit app for review
- [ ] Note submission date and time
- [ ] Wait for Apple review (typically 1-3 days)

---

## 📋 QUICK CHECKLIST

### Completed ✅
- [x] Phase 1: App Store Connect Setup (90%)
- [x] Phase 2: Subscription Configuration (100%)

### To Do ⏳
- [ ] **Phase 3: Code Review (30-60 min)**
  - [ ] Verify product IDs
  - [ ] Check shared secret in .env
  - [ ] Review purchase flow
  - [ ] Add trial eligibility logic

- [ ] **Phase 4: Testing (2-3 hours)**
  - [ ] Create sandbox account
  - [ ] Configure test device
  - [ ] Test purchase flow (4 test cases)
  - [ ] Test trial expiration (optional)

- [ ] **Phase 5: Submission (1-2 hours)**
  - [ ] Build and upload binary
  - [ ] Create app version
  - [ ] Set subscription levels
  - [ ] Complete submission form
  - [ ] Submit for review

---

## 🎯 RECOMMENDED SCHEDULE

### Today (October 7):
- ✅ Complete Phase 3 (Code Review) - 30-60 minutes
- ⏳ Start Phase 4 (Testing) - Begin sandbox testing

### Tomorrow (October 8):
- ⏳ Complete Phase 4 (Testing) - Finish all test cases
- ⏳ Start Phase 5 (Submission) - Build and upload

### October 9:
- ⏳ Complete Phase 5 (Submission) - Submit for review

### October 10-12:
- ⏳ Wait for Apple review
- ⏳ Respond to any review feedback

### Target Launch: October 12-15, 2025

---

## 🚨 IMPORTANT NOTES

### About Free Trials:
- **New users** should see `.freetrial` products (3-day trial)
- **Existing users** should see regular products (no trial)
- **Trial is per Apple ID** - users can only get one trial per subscription group
- **Sandbox testing** accelerates time (3 days = 3 minutes)

### About Subscription Levels:
- **Cannot be changed** after first submission
- **Must be set** before submitting for review
- **Determines upgrade/downgrade** behavior
- **Same tier, different billing** = same level (crossgrade)

### About App Review:
- **First review** typically takes 1-3 days
- **Subscriptions require** careful review
- **Be prepared** to answer questions about features
- **Test account** may be requested

---

## 📞 SUPPORT & RESOURCES

### If You Get Stuck:
1. **Apple Documentation:** https://developer.apple.com/in-app-purchase/
2. **App Store Connect Help:** https://developer.apple.com/help/app-store-connect/
3. **Developer Forums:** https://developer.apple.com/forums/
4. **Technical Support:** https://developer.apple.com/contact/

### Common Issues:
- **"Shared secret invalid"** → Regenerate in App Store Connect
- **"Product IDs not found"** → Wait 2-4 hours after creating subscriptions
- **"Cannot connect to iTunes Store"** → Check sandbox account is signed in
- **"Subscription not available"** → Ensure subscription is in "Ready to Submit" status

---

## 🎉 YOU'RE ALMOST THERE!

You've completed 75% of the work. The remaining 25% is mostly testing and submission paperwork.

**Next immediate action:** Start Phase 3 (Code Review) - should take 30-60 minutes.

Good luck! 🚀
