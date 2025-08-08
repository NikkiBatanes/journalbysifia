# 🚀 Database Setup Instructions

## Issue: Faith Points Not Saving

The animated notifications are working, but faith points aren't being saved because the database tables don't exist yet.

## 🔧 Quick Fix

### Option 1: Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste the contents of `database/faith_points_minimal.sql`**
4. **Click "RUN"**

### Option 2: Supabase CLI

```bash
cd /Users/nikkimaebatanes/CascadeProjects/siFia
supabase db push
```

## 📋 What This Creates

- ✅ `faith_points_log` - Records all faith points transactions
- ✅ `faith_points_profiles` - User profiles with levels and streaks  
- ✅ **Indexes** for performance
- ✅ **Row Level Security (RLS)** for data protection
- ✅ **Policies** so users can only see their own data

## 🧪 After Setup

1. **Click the "Test Faith Points" button** again
2. **Check the console** - should show successful database operations
3. **Check your profile** - progress bar should move
4. **Generate a playbook** - should award 10 points automatically

## 🔍 Verify Setup

Run this in Supabase SQL Editor to check if tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('faith_points_log', 'faith_points_profiles');
```

Should return both table names.

## 🚨 Common Issues

- **Permission Denied**: Make sure you're using the correct Supabase project
- **RLS Errors**: The policies ensure users can only access their own data
- **UUID Errors**: Make sure `uuid-ossp` extension is enabled

## 📞 Need Help?

If you see any errors, share the exact error message from the Supabase SQL Editor.
