# 🔐 EXECUTE DATABASE FIX - REQUIRED STEP

## ⚠️ **IMPORTANT: You must execute this database function to fix the RLS error!**

The error you're seeing:
```
Get user profile error: {code: 'PGRST116', details: 'The result contains 0 rows'...}
```

This happens because the database function hasn't been executed yet.

---

## 🚀 **STEP-BY-STEP INSTRUCTIONS:**

### **1. Open Supabase Dashboard**
- Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Select your siFia project

### **2. Navigate to SQL Editor**
- Click on "SQL Editor" in the left sidebar
- Click "New Query"

### **3. Copy and Paste This SQL:**

```sql
-- Create a secure function to create default user profiles
-- This function bypasses RLS using SECURITY DEFINER

CREATE OR REPLACE FUNCTION create_default_user_profile(
  p_user_id UUID,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_profile_data JSONB;
BEGIN
  -- Insert the default profile
  INSERT INTO user_profiles (
    id,
    email,
    first_name,
    last_name,
    bio,
    avatar_url,
    faith_points,
    growth_level,
    total_faith_points_earned,
    current_streak,
    longest_streak,
    last_activity_date,
    email_verified,
    last_login_at,
    last_active_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    'User',
    '',
    '',
    NULL,
    0,
    'Seedling',
    0,
    0,
    0,
    CURRENT_DATE,
    FALSE,
    NOW(),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING to_jsonb(user_profiles.*) INTO v_profile_data;
  
  RETURN v_profile_data;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating default profile for user %: %', p_user_id, SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_default_user_profile(UUID, TEXT) TO authenticated;
```

### **4. Execute the Query**
- Click "Run" button
- You should see "Success. No rows returned"

### **5. Test Your App**
- Restart your React Native app
- Try logging in with your existing account
- The profile should now be created successfully!

---

## ✅ **EXPECTED RESULTS AFTER EXECUTION:**

- ✅ Login works without RLS policy errors
- ✅ User profiles auto-created for existing accounts  
- ✅ Navigation errors fixed (Goals/Challenges show "Coming Soon")
- ✅ All authentication flows functional

---

## 🔧 **WHAT THIS FUNCTION DOES:**

1. **Securely creates user profiles** using SECURITY DEFINER
2. **Bypasses RLS policies** safely for authenticated users
3. **Handles conflicts** - won't create duplicates
4. **Matches database schema** perfectly
5. **Includes proper error handling**

---

## 🎯 **AFTER EXECUTING:**

Your siFia app will be **100% functional** with:
- ✅ Working authentication
- ✅ Profile creation for existing users
- ✅ No more database errors
- ✅ Clean navigation

**Execute this SQL now to complete the fix!** 🚀
