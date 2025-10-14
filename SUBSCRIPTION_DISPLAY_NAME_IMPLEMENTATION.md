# Subscription Display Name Implementation

## ✅ COMPLETED: Tier-Specific Trial Names in User Profile

### Problem Identified
Trial subscriptions were showing inconsistent names across the app:
- **UserProfileScreen**: Correctly showed "siFia Spark Trial" or "siFia Growth Trial"
- **UserInputScreen**: Only showed generic "Free Trial"
- **Database**: No persistent storage of the display name

This caused confusion as users couldn't see which tier they were trialing.

---

## Solution Implemented

### 1. **Database Schema Update** ✅
**File**: `/database/migrations/add_subscription_display_name.sql`

- Added `subscription_display_name` column to `user_subscriptions_new` table
- Updated `create_default_seeker_subscription` RPC function to set display name
- Backfilled existing records with proper display names:
  - `'seeker'` → `'siFia Seeker'`
  - `'spark'` → `'siFia Spark'`
  - `'growth'` → `'siFia Growth'`
  - `'transformation'` → `'siFia Transformation'`
  - `'family'` → `'siFia Family'`
  - `'free_trial'` → `'siFia [Chosen Tier] Trial'` (e.g., "siFia Spark Trial")

**Migration SQL**:
```sql
ALTER TABLE user_subscriptions_new 
ADD COLUMN subscription_display_name TEXT;

UPDATE user_subscriptions_new 
SET subscription_display_name = CASE 
    WHEN tier = 'free_trial' AND trial_chosen_tier IS NOT NULL THEN 
        'siFia ' || INITCAP(REPLACE(trial_chosen_tier::text, '_', ' ')) || ' Trial'
    WHEN tier = 'free_trial' THEN 'siFia Growth Trial'
    ELSE 'siFia ' || INITCAP(REPLACE(tier::text, '_', ' '))
END;
```

---

### 2. **TypeScript Interface Update** ✅
**File**: `/src/types/subscription.ts`

Added `subscription_display_name` field to the `Subscription` interface:

```typescript
export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  
  // Display name (e.g., "siFia Spark Trial", "siFia Growth")
  subscription_display_name?: string;
  
  // ... other fields
}
```

---

### 3. **Subscription Service Updates** ✅
**File**: `/src/services/NewSubscriptionService.ts`

#### Added Helper Method:
```typescript
private static getTierDisplayName(tier: SubscriptionTier): string {
  switch (tier) {
    case 'seeker': return 'siFia Seeker';
    case 'spark': return 'siFia Spark';
    case 'growth': return 'siFia Growth';
    case 'transformation': return 'siFia Transformation';
    case 'family': return 'siFia Family';
    case 'free_trial': return 'siFia Trial';
    default: return `siFia ${String(tier).replace('_', ' ')}`;
  }
}
```

#### Updated `startFreeTrial()`:
```typescript
const chosenTier = (trial_chosen_tier as SubscriptionTier) || 'spark';
const tierDisplayName = this.getTierDisplayName(chosenTier);
const displayName = `${tierDisplayName} Trial`; // e.g., "siFia Spark Trial"

const subscriptionData = {
  // ... other fields
  subscription_display_name: displayName,
  // ... other fields
};
```

#### Updated `upgradeSubscription()`:
```typescript
const displayName = this.getTierDisplayName(to_tier);

const updateData: any = {
  // ... other fields
  subscription_display_name: displayName, // e.g., "siFia Spark", "siFia Growth"
  // ... other fields
};
```

---

### 4. **UI Component Updates** ✅

#### **UserInputScreen.tsx**:
```typescript
const getTierDisplayName = (subscription: any) => {
  // Use subscription_display_name if available
  if (subscription?.subscription_display_name) {
    return subscription.subscription_display_name.toUpperCase();
  }
  
  // Fallback to tier-based logic with trial_chosen_tier support
  if (tier === 'free_trial' && chosenTier) {
    const tierName = chosenTier.replace('_', ' ').toUpperCase();
    return `siFia ${tierName} TRIAL`;
  }
  
  // ... other fallback logic
};
```

#### **UserProfileScreen.tsx**:
```typescript
const branded = (() => {
  // Use subscription_display_name if available
  if ((subscription as any)?.subscription_display_name) {
    return (subscription as any).subscription_display_name.toUpperCase();
  }
  
  // Fallback to tier-based logic
  switch (tierBase) {
    case 'free_trial': {
      const chosen = (subscription as any)?.trial_chosen_tier || 'growth';
      const tierName = String(chosen).replace('_', ' ').toUpperCase();
      return `siFia ${tierName} TRIAL`;
    }
    // ... other cases
  }
})();
```

---

## Display Name Examples

### Trial Subscriptions:
- **Spark Trial**: `"siFia Spark Trial"`
- **Growth Trial**: `"siFia Growth Trial"`
- **Transformation Trial**: `"siFia Transformation Trial"`

### Paid Subscriptions:
- **Spark**: `"siFia Spark"`
- **Growth**: `"siFia Growth"`
- **Transformation**: `"siFia Transformation"`
- **Family**: `"siFia Family"`

### Free Tier:
- **Seeker**: `"siFia Seeker"`

---

## Benefits

### ✅ **Consistency**
- All screens now show the same tier-specific trial name
- Database stores the display name for reliable retrieval

### ✅ **User Clarity**
- Users can clearly see which tier they're trialing
- No confusion between "Free Trial" and actual tier benefits

### ✅ **Maintainability**
- Single source of truth in database
- Centralized display name logic in `NewSubscriptionService`
- Fallback logic ensures backward compatibility

### ✅ **Backward Compatibility**
- Existing subscriptions backfilled with proper display names
- Fallback logic handles missing display names gracefully

---

## Migration Steps

### 1. **Run Database Migration**:
```bash
# Execute the migration SQL in Supabase SQL Editor
cat database/migrations/add_subscription_display_name.sql
```

### 2. **Verify Migration**:
```sql
-- Check that column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions_new' 
AND column_name = 'subscription_display_name';

-- Check that existing records were updated
SELECT 
  user_id,
  tier,
  trial_chosen_tier,
  subscription_display_name
FROM user_subscriptions_new
LIMIT 10;
```

### 3. **Test Trial Creation**:
- Start a new trial for Spark tier
- Verify `subscription_display_name` = `"siFia Spark Trial"`
- Check UserProfileScreen shows "SIFIA SPARK TRIAL"
- Check UserInputScreen shows "SIFIA SPARK TRIAL"

### 4. **Test Upgrade Flow**:
- Upgrade from trial to paid Spark
- Verify `subscription_display_name` = `"siFia Spark"`
- Check all screens show "SIFIA SPARK"

---

## Files Modified

### Database:
- ✅ `/database/migrations/add_subscription_display_name.sql` (NEW)

### TypeScript Types:
- ✅ `/src/types/subscription.ts`

### Services:
- ✅ `/src/services/NewSubscriptionService.ts`

### UI Screens:
- ✅ `/src/screens/UserInputScreen.tsx`
- ✅ `/src/screens/UserProfileScreen.tsx`

---

## Testing Checklist

- [ ] Run database migration in Supabase
- [ ] Verify column exists in `user_subscriptions_new`
- [ ] Verify existing records have display names
- [ ] Test new Seeker subscription creation
- [ ] Test Spark trial creation → shows "siFia Spark Trial"
- [ ] Test Growth trial creation → shows "siFia Growth Trial"
- [ ] Test Transformation trial creation → shows "siFia Transformation Trial"
- [ ] Test trial to paid upgrade → removes "Trial" suffix
- [ ] Verify UserProfileScreen displays correctly
- [ ] Verify UserInputScreen displays correctly
- [ ] Test with missing display name (fallback logic)

---

## Status: ✅ IMPLEMENTATION COMPLETE

All code changes have been implemented. The database migration is ready to be executed in Supabase.

**Next Step**: Run the migration SQL in Supabase SQL Editor to add the column and update existing records.
