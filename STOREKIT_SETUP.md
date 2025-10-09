# StoreKit Testing Setup Guide

## 🎯 Problem
Your device keeps asking for your real Apple ID instead of using the sandbox account.

## ✅ Solution: Use Local StoreKit Testing

Local StoreKit testing allows you to test subscriptions **without** needing a sandbox account or real Apple servers.

---

## 📋 Setup Instructions

### Step 1: Open Xcode
1. Open your project in Xcode
2. Make sure you're on the `siFia` target

### Step 2: Configure StoreKit
1. Go to: **Product → Scheme → Edit Scheme...**
2. Select **"Run"** in the left sidebar
3. Click the **"Options"** tab
4. Under **"StoreKit Configuration"**:
   - Click the dropdown
   - Select **"StoreKitConfiguration.storekit"**
   - (The file was just created in your project root)

### Step 3: Add StoreKit File to Xcode
1. In Xcode, right-click on your project folder
2. Select **"Add Files to 'siFia'..."**
3. Navigate to: `/Users/nikkimaebatanes/CascadeProjects/siFia/`
4. Select **`StoreKitConfiguration.storekit`**
5. Click **"Add"**

### Step 4: Build and Run
1. **Clean Build Folder**: Product → Clean Build Folder (⇧⌘K)
2. **Build**: Product → Build (⌘B)
3. **Run**: Product → Run (⌘R)

---

## 🧪 Testing Subscriptions

### With Local StoreKit:
- ✅ No sandbox account needed
- ✅ No real Apple ID needed
- ✅ Instant purchases (no waiting)
- ✅ Can test trial flows immediately
- ✅ Can test subscription upgrades
- ✅ Can test cancellations

### How to Purchase:
1. Navigate to subscription screen
2. Tap "Continue My Journey" or "Start Free Trial"
3. **StoreKit will show a test purchase dialog**
4. Click "Subscribe" (no password needed)
5. Purchase completes instantly ✅

### How to Manage Subscriptions:
1. In Xcode, go to: **Debug → StoreKit → Manage Transactions**
2. You'll see all test purchases
3. You can:
   - Cancel subscriptions
   - Refund purchases
   - Expire trials
   - Test renewals

---

## 🔍 Debugging

### View Transaction Manager:
```
Xcode → Debug → StoreKit → Manage Transactions
```

### View Transaction Log:
```
Xcode → Debug → StoreKit → Transaction Log
```

### Clear All Purchases:
```
Xcode → Debug → StoreKit → Clear Purchases
```

---

## 📊 What's in StoreKitConfiguration.storekit

The file includes:
- ✅ `app.sifia.com.spark.monthly.freetrial` - $7.99/month with 3-day trial
- ✅ `app.sifia.com.spark.annual.freetrial` - $79.99/year with 3-day trial
- ✅ `app.sifia.com.growth.monthly.freetrial` - $14.99/month with 3-day trial
- ✅ `app.sifia.com.growth.annual.freetrial` - $149.99/year with 3-day trial
- ✅ `app.sifia.com.spark.monthly` - $7.99/month (no trial)
- ✅ `app.sifia.com.growth.monthly` - $14.99/month (no trial)

---

## 🎯 Testing Trial Flow

### Test 3-Day Free Trial:
1. Navigate to trial offer screen
2. Tap "Start Free Trial"
3. StoreKit shows purchase dialog
4. Click "Subscribe"
5. **Trial starts immediately** ✅

### Simulate Trial Expiration:
1. In Xcode: **Debug → StoreKit → Manage Transactions**
2. Find your trial subscription
3. Click **"Expire Subscription"**
4. Trial ends immediately
5. Test what happens after expiration

---

## 🎯 Testing Sales Offer Flow

### Test Direct Purchase:
1. Navigate to sales offer screen
2. Select Growth tier
3. Tap "Continue My Journey"
4. StoreKit shows purchase dialog
5. Click "Subscribe"
6. **Full subscription starts immediately** ✅

---

## ⚠️ Important Notes

### Local Testing vs Sandbox:
- **Local Testing**: For development, no Apple servers
- **Sandbox Testing**: For pre-production, uses Apple sandbox servers
- **Production**: Real purchases, real money

### When to Use Each:
- **Local**: During development (NOW)
- **Sandbox**: Before TestFlight
- **Production**: After App Store approval

### Limitations of Local Testing:
- ❌ Doesn't test real Apple servers
- ❌ Doesn't test receipt validation
- ❌ Doesn't test server-to-server notifications
- ✅ Perfect for testing UI flows
- ✅ Perfect for testing business logic
- ✅ Perfect for testing trial/paid flows

---

## 🚀 Next Steps

### After Local Testing Works:
1. Test with sandbox account (Settings → App Store → Sandbox)
2. Test on TestFlight
3. Test in production

### For Sandbox Testing Later:
1. Go to: Settings → App Store → Sandbox Account
2. Sign in: `nikki.batanes+sandboxtester@sifia.app`
3. Password: `abcdefgH8.`
4. In Xcode: Product → Scheme → Edit Scheme → Options
5. Set StoreKit Configuration to: **"None"**
6. Run app and test with real Apple sandbox servers

---

## ✅ Checklist

Before testing:
- [ ] StoreKitConfiguration.storekit added to Xcode
- [ ] Scheme configured to use StoreKit Configuration
- [ ] Clean build completed
- [ ] App running on simulator/device

During testing:
- [ ] Can see products in app
- [ ] Can purchase with one tap (no password)
- [ ] Trial starts immediately
- [ ] Paid subscription starts immediately
- [ ] Can view transactions in Xcode

---

## 🐛 Troubleshooting

### "No products available"
- Check StoreKit Configuration is selected in scheme
- Rebuild the app
- Check product IDs match exactly

### "Purchase failed"
- Check Xcode console for errors
- Check Debug → StoreKit → Transaction Log
- Try clearing purchases and retrying

### Still asking for Apple ID
- You're not using local StoreKit
- Check scheme configuration
- Make sure StoreKitConfiguration.storekit is selected

---

## 📝 Summary

**Use Local StoreKit Testing for now:**
1. ✅ No sandbox account needed
2. ✅ No password prompts
3. ✅ Instant testing
4. ✅ Perfect for development

**Switch to Sandbox later when:**
1. Ready for TestFlight
2. Need to test real Apple servers
3. Need to test receipt validation
