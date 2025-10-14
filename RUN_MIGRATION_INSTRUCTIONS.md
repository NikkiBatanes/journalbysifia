# 🚀 Run Subscription Display Name Migration

## Quick Start (2 minutes)

The migration needs to be run in the **Supabase SQL Editor** because it requires DDL (Data Definition Language) permissions to add a new column.

---

## Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your **siFia** project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

---

## Step 2: Copy & Paste Migration SQL

Copy the **entire contents** of this file:
```
database/migrations/add_subscription_display_name.sql
```

Or copy this SQL directly:

```sql
-- Add subscription_display_name column to user_subscriptions_new table
-- This stores the user-friendly display name like "siFia Spark Trial" or "siFia Growth"

DO $$ 
BEGIN
    -- Check if subscription_display_name column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions_new' 
        AND column_name = 'subscription_display_name'
    ) THEN
        -- Add the subscription_display_name column
        ALTER TABLE user_subscriptions_new 
        ADD COLUMN subscription_display_name TEXT;
        
        RAISE NOTICE 'Added subscription_display_name column to user_subscriptions_new table';
    ELSE
        RAISE NOTICE 'subscription_display_name column already exists in user_subscriptions_new table';
    END IF;
END $$;

-- Update the create_default_seeker_subscription function to set display name
CREATE OR REPLACE FUNCTION create_default_seeker_subscription(target_user_id UUID)
RETURNS void AS $$
DECLARE
    tier_limits RECORD;
BEGIN
    -- Get tier limits for seeker
    SELECT * INTO tier_limits FROM get_tier_limits('seeker');
    
    -- Create seeker subscription with display name
    INSERT INTO user_subscriptions_new (
        user_id,
        tier,
        status,
        subscription_display_name,
        playbooks_limit,
        devotionals_limit,
        smart_journaling_enabled,
        playbooks_used,
        devotionals_used
    ) VALUES (
        target_user_id,
        'seeker',
        'active',
        'siFia Seeker',
        tier_limits.playbooks_limit,
        tier_limits.devotionals_limit,
        tier_limits.smart_journaling_enabled,
        0,
        0
    )
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing records to have proper display names
UPDATE user_subscriptions_new 
SET subscription_display_name = CASE 
    WHEN tier = 'seeker' THEN 'siFia Seeker'
    WHEN tier = 'spark' THEN 'siFia Spark'
    WHEN tier = 'growth' THEN 'siFia Growth'
    WHEN tier = 'transformation' THEN 'siFia Transformation'
    WHEN tier = 'family' THEN 'siFia Family'
    WHEN tier = 'free_trial' AND trial_chosen_tier IS NOT NULL THEN 
        'siFia ' || INITCAP(REPLACE(trial_chosen_tier::text, '_', ' ')) || ' Trial'
    WHEN tier = 'free_trial' THEN 'siFia Growth Trial' -- Default to Growth if no chosen tier
    ELSE 'siFia ' || INITCAP(REPLACE(tier::text, '_', ' '))
END
WHERE subscription_display_name IS NULL;

-- Show the updated records
SELECT 
    user_id,
    tier,
    trial_chosen_tier,
    subscription_display_name,
    created_at
FROM user_subscriptions_new
ORDER BY created_at DESC
LIMIT 10;

COMMENT ON COLUMN user_subscriptions_new.subscription_display_name IS 'User-friendly display name for the subscription (e.g., "siFia Spark Trial", "siFia Growth")';
```

---

## Step 3: Run the Migration

1. Paste the SQL into the SQL Editor
2. Click **Run** (or press `Cmd/Ctrl + Enter`)
3. Wait for the query to complete (should take 1-2 seconds)

---

## Step 4: Verify Success

You should see output like:

```
NOTICE: Added subscription_display_name column to user_subscriptions_new table
```

And a table showing your updated subscriptions with their display names.

---

## Step 5: Test in Your App

1. **Restart your app** (if running)
2. **Check UserProfileScreen** - Should show tier-specific trial names
3. **Check UserInputScreen** - Should show tier-specific trial names
4. **Create a new trial** - Should automatically get the correct display name

---

## Expected Results

### Before Migration:
- UserInputScreen: "Free Trial" ❌
- Database: `subscription_display_name` = NULL ❌

### After Migration:
- UserInputScreen: "siFia Spark Trial" ✅
- Database: `subscription_display_name` = "siFia Spark Trial" ✅

---

## Troubleshooting

### Error: "column already exists"
✅ **This is fine!** The migration is idempotent and won't break if run multiple times.

### Error: "permission denied"
❌ Make sure you're using the **service role key** or running in the Supabase SQL Editor (which has admin permissions).

### No records updated
⚠️ Check if you have any subscriptions in the `user_subscriptions_new` table:
```sql
SELECT COUNT(*) FROM user_subscriptions_new;
```

---

## Alternative: Run Verification Only

If you just want to check if the migration already ran:

```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions_new' 
AND column_name = 'subscription_display_name';

-- Check existing display names
SELECT tier, subscription_display_name, COUNT(*) 
FROM user_subscriptions_new 
GROUP BY tier, subscription_display_name;
```

---

## ✅ Migration Complete!

Once you see the success message, your app will automatically use the new `subscription_display_name` field to show tier-specific trial names like:

- **"siFia Spark Trial"**
- **"siFia Growth Trial"**
- **"siFia Transformation Trial"**

No app restart or code changes needed - the TypeScript code is already updated! 🎉
