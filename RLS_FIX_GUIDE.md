# 🔧 Complete Step-by-Step Fix for RLS Policy Error

## Error: "new row violates row-level security policy for table 'journal_entries'"

This comprehensive guide will help you fix the Row Level Security (RLS) policy error that's preventing data from saving in your app.

---

## **Step 1: Debug Current Authentication State**

### 1.1 Use the Auth Debugger Component
I've added an `AuthDebugger` component to your Journal screen. 

**How to use it:**
1. Run your app: `npx react-native run-ios`
2. Navigate to the Journal tab
3. You'll see the Auth Debugger at the top
4. Tap the buttons to diagnose issues:
   - **"🔍 Full Diagnostic"** - Comprehensive auth analysis
   - **"🔧 Fix Authentication"** - Attempt to fix session issues
   - **"🧪 Test Database Auth"** - Test if database operations work

### 1.2 Check Console Logs
Open your development console and look for:
- Authentication status
- User ID format (must be UUID)
- Access token presence
- Session expiry status

---

## **Step 2: Fix Supabase RLS Policies**

### 2.1 Access Supabase Dashboard
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Open your siFia project
4. Navigate to **SQL Editor**

### 2.2 Run the RLS Policy Fix Script
Copy and paste the contents of `fix-rls-policies.sql` into the SQL Editor and execute it.

**What this script does:**
- Enables RLS on all tables
- Drops existing conflicting policies
- Creates comprehensive policies for:
  - `journal_entries`
  - `prayers`
  - `devotionals`
  - `playbooks`
- Allows authenticated users to CRUD their own data

### 2.3 Verify Policies Were Created
The script includes a verification query at the end. You should see policies like:
- "Users can view their own journal entries"
- "Users can insert their own journal entries"
- "Users can update their own journal entries"
- "Users can delete their own journal entries"

---

## **Step 3: Test the Fix**

### 3.1 Test with Auth Debugger
1. In your app, tap **"🧪 Test Database Auth"**
2. Check if you get a success message
3. If it fails, note the specific error message

### 3.2 Test Real App Functionality
1. Try adding a todo item
2. Try adding a gratitude entry
3. Try updating existing entries
4. Check console for any remaining errors

---

## **Step 4: Common Issues and Solutions**

### Issue 1: User Not Authenticated
**Symptoms:** Auth Debugger shows "❌ Not Authenticated"
**Solution:**
1. Make sure you're signed in to the app
2. Check if login is working properly
3. Verify credentials are correct

### Issue 2: Invalid User ID Format
**Symptoms:** User ID is not a valid UUID
**Solution:**
1. Check your authentication flow
2. Ensure you're using Supabase Auth properly
3. User ID should be a UUID like: `123e4567-e89b-12d3-a456-426614174000`

### Issue 3: Session Expired
**Symptoms:** Auth Debugger shows session expired
**Solution:**
1. Tap **"🔧 Fix Authentication"** in the debugger
2. Or sign out and sign back in
3. Check if auto-refresh is working

### Issue 4: RLS Policies Still Blocking
**Symptoms:** Database test fails even with valid auth
**Solution:**
1. Double-check the SQL script ran successfully
2. Verify policies exist in Supabase dashboard
3. Check if `auth.uid()` matches your user ID

---

## **Step 5: Verify Everything Works**

### 5.1 Remove Debug Component
Once everything is working, remove the AuthDebugger:
1. Open `src/screens/JournalScreen.tsx`
2. Remove the `<AuthDebugger />` line
3. Remove the import statement

### 5.2 Test All App Features
- ✅ Journal entries (todos, gratitude, etc.)
- ✅ Prayer entries
- ✅ Devotional progress
- ✅ Playbook actions

---

## **Step 6: Troubleshooting**

### If Issues Persist:

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs
   - Look for authentication or RLS errors

2. **Verify Table Structure:**
   - Ensure `user_id` columns are UUID type
   - Check that all tables have proper RLS enabled

3. **Test with Supabase SQL Editor:**
   ```sql
   -- Test if you can insert as authenticated user
   INSERT INTO journal_entries (user_id, content_type, content, selected_date)
   VALUES (auth.uid(), 'gratitude', 'Test entry', current_date);
   ```

4. **Check Network Requests:**
   - Use React Native Debugger
   - Verify API calls include proper Authorization headers

---

## **Expected Results After Fix:**

✅ **Auth Debugger shows:**
- Authentication: ✅ Authenticated
- User ID Format: valid-uuid
- Access Token: ✅ Present
- Session Expired: ✅ (not expired)

✅ **Database Test:** "Database test successful - authentication is working"

✅ **App Functionality:** All data saving operations work normally

---

## **Files Created/Modified:**

1. `src/components/debug/AuthDebugger.tsx` - Debug component
2. `src/utils/authFix.ts` - Authentication utilities
3. `src/screens/JournalScreen.tsx` - Added debugger (temporary)
4. `fix-rls-policies.sql` - Database policy fixes

---

## **Need Help?**

If you're still experiencing issues after following this guide:

1. Run the **"🔍 Full Diagnostic"** and share the results
2. Check the console logs for specific error messages
3. Verify your Supabase project configuration
4. Ensure you're using the correct environment variables

The most common cause is authentication state issues, followed by RLS policy configuration problems. This guide addresses both systematically.
