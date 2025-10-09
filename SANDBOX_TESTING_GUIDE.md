# Complete Sandbox Testing Guide
**For Real Apple Sandbox Testing with Sandbox Account**

---

## 🎯 Your Sandbox Account
- **Email:** nikki.batanes+sandboxtester@sifia.app
- **Password:** abcdefgH8.
- **Created in:** App Store Connect → Users and Access → Sandbox Testers

---

## 📱 Device Setup (Step-by-Step)

### Step 1: Sign Out of Production Apple ID (IMPORTANT!)

**On your iPhone/iPad:**
```
Settings → [Your Name at top] → Sign Out
```

⚠️ **CRITICAL:** You MUST sign out of your real Apple ID completely. Sandbox won't work if you're signed into production.

**What to expect:**
- You'll be asked if you want to keep data on device
- Choose "Keep on My iPhone/iPad"
- Enter your Apple ID password to turn off Find My
- Confirm sign out

---

### Step 2: DO NOT Sign Into Sandbox in Settings

❌ **DO NOT DO THIS:**
```
Settings → App Store → Sign In (with sandbox account)
```

✅ **CORRECT APPROACH:**
- Leave Settings → App Store signed out
- You'll sign in DURING the first purchase in your app
- This is how Apple sandbox testing works

---

### Step 3: Configure Sandbox Account in Settings (iOS 15+)

**Only for iOS 15 and later:**
```
Settings → App Store → Sandbox Account
```
- Tap "Sandbox Account"
- Enter: nikki.batanes+sandboxtester@sifia.app
- Enter password: abcdefgH8.
- Tap "Sign In"

**If you don't see "Sandbox Account" option:**
- You're on iOS 14 or earlier
- Skip this step
- You'll sign in during first purchase

---

## 🔧 Xcode Configuration

### Step 1: Ensure Sandbox Mode in Code

Your app is already configured for sandbox (✅ Already done):
```typescript
// In AppleStoreKitService.ts
const result = await validateReceiptIos({ 
  receiptBody, 
  isTest: __DEV__  // This makes it use sandbox
});
```

### Step 2: Build Configuration

1. **Open Xcode**
2. **Select your target:** siFia
3. **Select your device** (not simulator - sandbox works best on real device)
4. **Build and Run** (⌘R)

---

## 🧪 Testing Flow

### Test 1: First Purchase (Trial Flow)

#### Steps:
1. **Launch app** on device
2. **Sign in** with your real Apple ID (for app authentication)
3. **Navigate** to OnboardingTrialOfferScreen
4. **Tap** "Start Free Trial"
5. **Apple payment sheet appears**

#### What You'll See:
```
┌─────────────────────────────────┐
│  Subscribe to Growth Monthly    │
│                                 │
│  3 Days Free, Then $14.99/Month │
│                                 │
│  [Sandbox Account]              │
│  nikki.batanes+sandboxtester... │
│                                 │
│  [Subscribe]                    │
│  [Cancel]                       │
└─────────────────────────────────┘
```

#### If Not Signed Into Sandbox:
```
┌─────────────────────────────────┐
│  Sign In to iTunes Store        │
│                                 │
│  Email: [                    ]  │
│  Password: [                 ]  │
│                                 │
│  This is a Sandbox Environment  │
│                                 │
│  [Sign In]                      │
│  [Cancel]                       │
└─────────────────────────────────┘
```

**Enter:**
- Email: `nikki.batanes+sandboxtester@sifia.app`
- Password: `abcdefgH8.`

#### After Signing In:
- Payment sheet shows subscription details
- Tap **"Subscribe"**
- May ask for password again (enter: `abcdefgH8.`)
- Purchase completes
- App receives transaction

---

### Test 2: Verify Trial Created

#### Check Console Logs:
```
[StoreKit] Purchase updated: {productId: 'app.sifia.com.growth.monthly.freetrial'}
[StoreKit] Receipt validation successful
[NewSubscriptionService] Creating trial with data: {
  tier: 'free_trial',
  playbooks_limit: 2,
  devotionals_limit: 2
}
[NewSubscriptionService] ✅ Trial subscription created
```

#### Check Database:
```sql
SELECT 
  tier,
  playbooks_limit,
  devotionals_limit,
  trial_start_date,
  trial_end_date
FROM user_subscriptions_new 
WHERE user_id = '<your-user-id>';
```

**Expected:**
- tier: `'free_trial'`
- playbooks_limit: `2`
- devotionals_limit: `2`
- trial_start_date: `<current-date>`
- trial_end_date: `<current-date + 3 days>`

---

### Test 3: Sales Offer Flow (Paid Subscription)

#### Prerequisites:
- Cancel previous trial (see "Managing Subscriptions" below)
- Or use a different product tier

#### Steps:
1. **Navigate** to OnboardingSalesOfferScreen
2. **Select** Growth tier
3. **Tap** "Continue My Journey"
4. **Payment sheet appears**
5. **Tap** "Subscribe"
6. **Enter password** if prompted: `abcdefgH8.`

#### Expected Result:
```
[NewSubscriptionService] Creating subscription with tier: growth
[NewSubscriptionService] ✅ Subscription created: {
  tier: 'growth',
  playbooks_limit: 20,
  devotionals_limit: 20
}
```

---

## 🔍 Managing Sandbox Subscriptions

### View Active Subscriptions:

**On Device:**
```
Settings → [Your Name] → Subscriptions
```
⚠️ This won't work because you're signed out of production

**Alternative - In App:**
Your app should have a "Manage Subscription" button that opens:
```swift
if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
  UIApplication.shared.open(url)
}
```

**Best Way - App Store Connect:**
```
App Store Connect → My Apps → siFia → TestFlight → Sandbox Testers
→ Click on your tester → View Subscriptions
```

---

### Cancel Subscription:

**Method 1: Through App (Recommended)**
- Your app should have "Cancel Subscription" option
- This opens Apple's subscription management

**Method 2: Through Settings (If signed in)**
```
Settings → [Sandbox Account Name] → Subscriptions → siFia → Cancel
```

**Method 3: Sign Out and Back In**
```
Settings → App Store → Sign Out
→ Launch app → Make new purchase → Sign in again
```

---

## 🐛 Troubleshooting

### Issue 1: "Cannot connect to iTunes Store"
**Solution:**
- Check internet connection
- Make sure you're signed out of production Apple ID
- Try signing out of sandbox and back in

### Issue 2: "This Apple ID has not been set up for use in the App Store"
**Solution:**
- Your sandbox account isn't properly created
- Go to App Store Connect → Users and Access → Sandbox Testers
- Verify the account exists
- Try creating a new sandbox tester

### Issue 3: "Invalid Product ID"
**Solution:**
- Products not created in App Store Connect
- Product IDs don't match
- Products not approved for sandbox testing
- Wait 24 hours after creating products

### Issue 4: Still Asking for Real Apple ID
**Solution:**
- You're not signed out of production
- Go to Settings → [Your Name] → Sign Out
- Completely sign out, then try again

### Issue 5: "Sandbox Receipt Validation Failed"
**Solution:**
- Check you're using `isTest: true` in validation
- Check shared secret is correct
- Try using sandbox receipt validation URL

---

## 📊 Testing Checklist

### Before Testing:
- [ ] Signed out of production Apple ID
- [ ] App built in Xcode (Debug mode)
- [ ] Running on real device (not simulator)
- [ ] Internet connection active
- [ ] Products created in App Store Connect

### During First Purchase:
- [ ] Payment sheet appears
- [ ] Shows "Sandbox Environment" or sandbox email
- [ ] Can enter sandbox credentials
- [ ] Purchase completes successfully
- [ ] App receives transaction

### After Purchase:
- [ ] Console shows purchase logs
- [ ] Database updated correctly
- [ ] App shows correct tier
- [ ] Limits enforced properly
- [ ] Trial dates set (if trial)

---

## 🎯 Expected Sandbox Behavior

### Trial Subscriptions:
- **Day 1-3:** Free trial active
- **Day 4:** Apple charges $14.99
- **Renewal:** Every month (accelerated in sandbox)

### Sandbox Time Acceleration:
Apple accelerates subscription renewals in sandbox:
- **1 week subscription** → Renews every 3 minutes
- **1 month subscription** → Renews every 5 minutes
- **2 months subscription** → Renews every 10 minutes
- **3 months subscription** → Renews every 15 minutes
- **6 months subscription** → Renews every 30 minutes
- **1 year subscription** → Renews every 1 hour

**For 3-day trial:**
- Trial expires in ~3 minutes (accelerated)
- Then charges and converts to paid

---

## 🔐 Security Notes

### Sandbox vs Production:
- **Sandbox:** Test environment, fake purchases
- **Production:** Real environment, real money
- **Never mix:** Don't use production credentials in sandbox

### Receipt Validation:
```typescript
// Sandbox URL
const sandboxURL = 'https://sandbox.itunes.apple.com/verifyReceipt';

// Production URL
const productionURL = 'https://buy.itunes.apple.com/verifyReceipt';

// Your code should use sandbox in development
const url = __DEV__ ? sandboxURL : productionURL;
```

---

## 📝 Step-by-Step Testing Script

### Complete Test Flow:

```
1. SETUP
   ├─ Sign out of production Apple ID
   ├─ Build app in Xcode (Debug mode)
   └─ Install on real device

2. FIRST LAUNCH
   ├─ Sign in with real Apple ID (app authentication)
   └─ Navigate to trial offer screen

3. START TRIAL
   ├─ Tap "Start Free Trial"
   ├─ Payment sheet appears
   ├─ Sign in with sandbox account (first time only)
   │  └─ Email: nikki.batanes+sandboxtester@sifia.app
   │  └─ Password: abcdefgH8.
   ├─ Tap "Subscribe"
   └─ Wait for confirmation

4. VERIFY TRIAL
   ├─ Check console logs
   ├─ Check database
   ├─ Verify tier: free_trial
   ├─ Verify limits: 2/2
   └─ Verify trial dates set

5. WAIT FOR CONVERSION (3 minutes in sandbox)
   ├─ Trial expires
   ├─ Apple charges
   ├─ App receives renewal notification
   └─ Tier upgrades to growth (20/20)

6. TEST SALES OFFER
   ├─ Cancel trial subscription
   ├─ Navigate to sales offer screen
   ├─ Tap "Continue My Journey"
   ├─ Payment sheet appears
   ├─ Tap "Subscribe"
   └─ Verify immediate full access

7. VERIFY PAID SUBSCRIPTION
   ├─ Check tier: growth
   ├─ Check limits: 20/20
   ├─ Check no trial dates
   └─ Verify full access
```

---

## ✅ Success Criteria

### Trial Flow Success:
- ✅ Payment sheet shows 3-day free trial
- ✅ Sandbox account email visible
- ✅ Purchase completes without errors
- ✅ Database shows `free_trial` tier
- ✅ Limits are 2/2
- ✅ Trial dates set correctly
- ✅ After 3 minutes, converts to paid

### Sales Offer Success:
- ✅ Payment sheet shows immediate charge
- ✅ Purchase completes without errors
- ✅ Database shows `growth` tier
- ✅ Limits are 20/20
- ✅ No trial dates
- ✅ Full access immediately

---

## 🚀 Next Steps After Sandbox Testing

1. **TestFlight Testing**
   - Upload build to TestFlight
   - Test with external testers
   - Still uses sandbox

2. **Production Testing**
   - Submit to App Store
   - Test with real purchases
   - Use real Apple ID
   - Real money charged

3. **Monitoring**
   - Set up server-to-server notifications
   - Monitor subscription renewals
   - Track cancellations
   - Handle refunds

---

## 📞 Need Help?

### Common Questions:

**Q: Can I test on simulator?**
A: Sandbox works best on real device. Simulator has limitations.

**Q: How long do I wait for products to appear?**
A: Up to 24 hours after creating in App Store Connect.

**Q: Can I use the same sandbox account for multiple apps?**
A: Yes, sandbox accounts work across all your apps.

**Q: What if I forget sandbox password?**
A: Reset it in App Store Connect → Sandbox Testers.

**Q: Can I test family sharing?**
A: Yes, create multiple sandbox accounts and test.

---

## 🎯 Summary

**To test with sandbox:**
1. ✅ Sign out of production Apple ID
2. ✅ Build app in Debug mode
3. ✅ Run on real device
4. ✅ Make purchase in app
5. ✅ Sign in with sandbox account when prompted
6. ✅ Complete purchase
7. ✅ Verify in database and console

**Your sandbox account:**
- Email: `nikki.batanes+sandboxtester@sifia.app`
- Password: `abcdefgH8.`

**Ready to test!** 🚀
