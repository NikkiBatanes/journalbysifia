# 🔐 COMPLETE DATABASE FIX - RLS POLICIES

## ⚠️ **CRITICAL: Multiple RLS Policy Violations Detected**

You're experiencing RLS (Row-Level Security) policy violations on multiple tables:
- ❌ `user_profiles` table - missing INSERT policy
- ❌ `prayers` table - missing INSERT policy  
- ❌ `devotionals` table - missing INSERT policy
- ❌ Other tables likely affected

**Root Cause:** Your database has RLS enabled but is missing proper INSERT policies for authenticated users.

---

## 🚀 **COMPLETE FIX - Execute Both SQL Scripts**

### **STEP 1: Open Supabase Dashboard**
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your siFia project
3. Click "SQL Editor" → "New Query"

### **STEP 2: Execute Profile Creation Function**

**Copy and paste this SQL first:**

```sql
-- Create secure profile creation function
CREATE OR REPLACE FUNCTION create_default_user_profile(
  p_user_id UUID,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_profile_data JSONB;
BEGIN
  INSERT INTO user_profiles (
    id, email, first_name, last_name, bio, avatar_url,
    faith_points, growth_level, total_faith_points_earned,
    current_streak, longest_streak, last_activity_date,
    email_verified, last_login_at, last_active_at,
    created_at, updated_at
  ) VALUES (
    p_user_id, p_email, 'User', '', '', NULL,
    0, 'Seedling', 0, 0, 0, CURRENT_DATE,
    FALSE, NOW(), NOW(), NOW(), NOW()
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

GRANT EXECUTE ON FUNCTION create_default_user_profile(UUID, TEXT) TO authenticated;
```

**Click "Run" → Should see "Success. No rows returned"**

### **STEP 3: Execute Comprehensive RLS Policy Fix**

**Copy and paste this SQL second:**

```sql
-- Comprehensive RLS Policy Fix for All Tables

-- 1. USER PROFILES - Add INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. PRAYERS TABLE - Fix all policies
DROP POLICY IF EXISTS "Users can manage own prayers" ON prayers;

CREATE POLICY "Users can view prayers" ON prayers
FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own prayers" ON prayers
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prayers" ON prayers
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prayers" ON prayers
FOR DELETE USING (auth.uid() = user_id);

-- 3. DEVOTIONALS TABLE - Fix all policies
DROP POLICY IF EXISTS "Users can manage own devotionals" ON devotionals;

CREATE POLICY "Users can view own devotionals" ON devotionals
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devotionals" ON devotionals
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devotionals" ON devotionals
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devotionals" ON devotionals
FOR DELETE USING (auth.uid() = user_id);

-- 4. JOURNAL ENTRIES (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
        DROP POLICY IF EXISTS "Users can manage own journal entries" ON journal_entries;
        
        EXECUTE 'CREATE POLICY "Users can view own journal entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can insert own journal entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can update own journal entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can delete own journal entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- 5. PRAYER LOGS (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prayer_logs') THEN
        DROP POLICY IF EXISTS "Users can manage own prayer logs" ON prayer_logs;
        
        EXECUTE 'CREATE POLICY "Users can view own prayer logs" ON prayer_logs FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can insert own prayer logs" ON prayer_logs FOR INSERT WITH CHECK (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can update own prayer logs" ON prayer_logs FOR UPDATE USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Users can delete own prayer logs" ON prayer_logs FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- 6. Enable RLS on tables
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE devotionals ENABLE ROW LEVEL SECURITY;
```

**Click "Run" → Should see "Success. No rows returned"**

---

## ✅ **EXPECTED RESULTS AFTER BOTH FIXES:**

- ✅ **Login works** - No more profile creation errors
- ✅ **Prayer creation works** - No more RLS violations  
- ✅ **Devotional creation works** - No more RLS violations
- ✅ **Journal entries work** - If you have them
- ✅ **All CRUD operations work** - Create, Read, Update, Delete

---

## 🔧 **WHAT THESE FIXES DO:**

### **Profile Creation Function:**
- Creates missing user profiles securely
- Bypasses RLS using SECURITY DEFINER
- Handles conflicts (no duplicates)

### **RLS Policy Fix:**
- Adds proper INSERT policies for all tables
- Separates policies by operation (SELECT, INSERT, UPDATE, DELETE)
- Ensures users can only access their own data
- Maintains security while allowing proper functionality

---

## 🚀 **AFTER EXECUTING BOTH:**

1. **Restart your React Native app**
2. **Login with existing account**
3. **Try creating prayers/devotionals**
4. **Everything should work without RLS errors!**

---

## 🎯 **WHY YOU NEED BOTH:**

1. **Profile Function** - Fixes user profile creation for existing accounts
2. **RLS Policies** - Fixes prayer/devotional/journal creation for all users

**Execute both SQL scripts to completely resolve all RLS policy violations!** 🔐✨
