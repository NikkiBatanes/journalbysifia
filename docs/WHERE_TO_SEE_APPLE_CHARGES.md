# Where to See ACTUAL Apple Charges (Not 2-Day Delayed Data)

## Problem
- App Store Connect shows 5 paid subscriptions
- Your database shows 0 paid receipts (only trial receipts)
- App Store Connect has 2-day delay
- You need to see REAL-TIME charges

---

## Where to Check ACTUAL Transactions

### 1. **App Store Server API - Transaction History** (Real-time)
**Location**: Direct API call to Apple

**Endpoint**: `https://api.storekit.itunes.apple.com/inApps/v1/history/{originalTransactionId}`

**What it shows**: 
- ALL transactions for a user
- Real-time data (no 2-day delay)
- Shows if trial converted to paid
- Shows exact charge amounts and dates

**How to use**:
```bash
# You need the original_transaction_id from your database
curl -H "Authorization: Bearer {JWT_TOKEN}" \
  "https://api.storekit.itunes.apple.com/inApps/v1/history/{originalTransactionId}"
```

**For Sandbox**:
```bash
curl -H "Authorization: Bearer {JWT_TOKEN}" \
  "https://api.storekit-sandbox.itunes.apple.com/inApps/v1/history/{originalTransactionId}"
```

### 2. **App Store Connect - Sales and Trends** (Delayed)
**Location**: App Store Connect → Sales and Trends → Subscriptions

**Shows**:
- Number of paid subscriptions
- Revenue
- Conversions
- **BUT**: 2-day delay

**URL**: https://appstoreconnect.apple.com/trends/subscriptions

### 3. **App Store Connect - Payments and Financial Reports** (Most Accurate)
**Location**: App Store Connect → Payments and Financial Reports

**Shows**:
- Actual money transferred
- Subscription proceeds
- Per-transaction details
- Monthly financial reports

**URL**: https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/da/jumpTo?page=paymentsAndFinancialReports

### 4. **Sandbox Tester Receipts** (For Testing)
**Location**: Settings → App Store → Sandbox Account (on device)

**Shows**:
- Test purchases
- Subscription status
- Receipt data

---

## Why Your Database Shows 0 Paid Receipts

### Root Cause
Your `validate-receipt` function only gets called when:
1. User makes purchase in app
2. App sends receipt to your server

**But**: If webhook fails OR user never opens app after trial converts, you won't have the paid receipt.

### The Missing Link
Apple charges users automatically when trial ends, but:
- ❌ Webhook didn't process (the bug we fixed)
- ❌ User never opened app after trial ended
- ❌ App didn't send new receipt to server

**Result**: Apple has the transaction, but your database doesn't.

---

## How to Get the Missing Transaction Data

### Option 1: Check Apple's Transaction History API (Recommended)
For each user with `original_transaction_id`, query Apple's API to get their complete transaction history.

### Option 2: Force Receipt Refresh in App
When user opens app, trigger receipt validation which will fetch latest receipt from Apple.

### Option 3: Use Webhook Notifications (Already fixed)
When webhook processes, it should trigger receipt validation.

---

## Immediate Actions

### 1. Check App Store Connect Financial Reports
**Go to**: Payments and Financial Reports → Financial Reports → Monthly Reports

**Look for**:
- December 2025 report
- Subscription proceeds
- Number of actual charges

This shows ACTUAL money collected, not just subscriptions started.

### 2. Get Original Transaction IDs
Run this query:
```sql
SELECT 
    user_id,
    original_transaction_id,
    trial_end_date,
    tier
FROM user_subscriptions_new 
WHERE trial_end_date < NOW() 
  AND original_transaction_id IS NOT NULL
ORDER BY trial_end_date DESC;
```

### 3. Query Apple Transaction History API
For each `original_transaction_id`, query Apple's API to see their complete transaction history.

### 4. Compare Numbers
- App Store Connect: 5 paid subscriptions
- Your database: 0 paid receipts
- Financial Reports: X actual charges

The Financial Reports number is the TRUTH.

---

## App Store Connect Navigation

### See Paid Subscriptions (Real-time-ish)
1. Go to: https://appstoreconnect.apple.com
2. Click: Apps → Your App
3. Click: Features → In-App Purchases
4. Click: Subscription Groups → Your Group
5. Look at: Active Subscriptions count

### See Actual Revenue (Delayed but Accurate)
1. Go to: https://appstoreconnect.apple.com
2. Click: Payments and Financial Reports
3. Click: Financial Reports
4. Download: Latest monthly report
5. Look at: Subscription proceeds line

### See Transaction Details (Most Accurate)
1. Go to: https://appstoreconnect.apple.com
2. Click: Sales and Trends
3. Click: Subscriptions
4. Filter by: Date range
5. Look at: Individual transactions

---

## The Real Answer

To know if those 5 subscriptions actually PAID:

**Check Financial Reports** → If it shows $X in subscription proceeds, that's real money charged.

**Don't trust**: Sales and Trends (2-day delay)
**Don't trust**: Your database (missing data due to webhook bug)
**Trust**: Financial Reports (actual money transferred)

---

## Next Steps

1. **Check Financial Reports** for actual charges
2. **Get original_transaction_ids** from database
3. **Query Apple Transaction History API** for each user
4. **Update your database** with the actual transaction data
5. **Manually upgrade users** who paid but are still on seeker tier
