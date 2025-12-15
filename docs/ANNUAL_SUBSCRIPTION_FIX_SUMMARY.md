# Annual Subscription Fix - Complete Summary

## ✅ Fixed Components

### 1. **AppleStoreKitService.ts**
- ✅ Product IDs include annual variants (`spark_annual`, `growth_annual`, `transformation_annual`)
- ✅ `getSubscriptionTierFromProductId()` correctly extracts and returns annual tier names
- ✅ Purchases save with `_annual` suffix to database

### 2. **GooglePlayBillingService.ts**
- ✅ Updated `PRODUCT_IDS` to include annual variants
- ✅ `getSubscriptionTierFromProductId()` now handles annual detection

### 3. **platformSubscriptionService.ts**
- ✅ `extractTierFromSku()` returns annual tier names

### 4. **NewSubscriptionService.ts**
- ✅ `getTierLimits()` maps annual variants to base tier limits
- ✅ `getTierDisplayName()` returns "Annual" suffix for annual tiers
- ✅ All upgrade/trial conversion logic preserves `_annual` suffix

### 5. **SubscriptionTier Type**
- ✅ Updated `/src/types/subscription.ts` to include:
  - `'spark_annual'`
  - `'growth_annual'`
  - `'transformation_annual'`

### 6. **Utility Files**
- ✅ `tierLockingRules.ts` - Added annual variants to all rule objects
- ✅ `guidedPromptGating.ts` - Added annual variants
- ✅ `TrialManagementService.ts` - Added annual tier names

### 7. **Apple Webhook** (supabase/functions/apple-webhook/index.ts)
- ✅ `getTierFromProductId()` - NEW function to extract tier from productId
- ✅ `getTierLimits()` - Now handles annual variants
- ✅ `getTierDisplayName()` - Now shows "Annual" for annual tiers
- ✅ Trial conversions use actual productId to determine correct tier

## ❌ Action Required

### **Database Migration**
Run the migration script to update CHECK constraint:

```sql
-- File: database_migration_annual_support.sql
ALTER TABLE user_subscriptions_new 
DROP CONSTRAINT IF EXISTS user_subscriptions_new_trial_chosen_tier_check;

ALTER TABLE user_subscriptions_new 
ADD CONSTRAINT user_subscriptions_new_trial_chosen_tier_check 
CHECK (trial_chosen_tier IN (
  'spark', 'spark_annual',
  'growth', 'growth_annual',
  'transformation', 'transformation_annual'
));
```

### **Deploy Webhook Update**
Deploy the updated Apple webhook to Supabase:
```bash
supabase functions deploy apple-webhook
```

## 🧪 Testing Steps

1. **Make a new annual purchase** (e.g., Transformation Yearly)
2. **Check database** - Verify tier is saved as `transformation_annual`
3. **Check UI** - User Profile should display "Annual" billing period
4. **Test webhook** - Cancel/renew to verify webhook handles annual correctly

## 📊 How to Identify Existing Annual Users

Since we can't determine annual vs monthly from current database data alone:

1. **Check App Store Connect** - Filter revenue by product ID containing "annual"
2. **Check productId** if you have Apple transaction logs
3. **Ask users directly** if unsure

## 🔄 Manual Fix for Existing Users

Once identified, update manually:
```sql
UPDATE user_subscriptions_new 
SET tier = 'transformation_annual'
WHERE user_id = 'USER_ID' AND tier = 'transformation';
```

## Summary

- ✅ Code is ready for annual subscriptions
- ✅ New purchases will work correctly
- ❌ Database needs migration (CHECK constraint)
- ❌ Webhook needs deployment
- ⚠️ Existing annual users need manual database update
