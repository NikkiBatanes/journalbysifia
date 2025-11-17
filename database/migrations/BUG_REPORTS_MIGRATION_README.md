# Bug Reports and Feature Requests Migration

## Overview
This migration creates the necessary database tables for the bug reporting and feature request functionality in the siFia app.

## What This Migration Does

### Tables Created:
1. **`bug_reports`** - Stores user-submitted bug reports
2. **`feature_requests`** - Stores user-submitted feature requests and suggestions

### Features:
- ✅ Proper foreign key relationships to `auth.users`
- ✅ Row Level Security (RLS) policies for data protection
- ✅ Indexes for optimal query performance
- ✅ Auto-updating timestamps
- ✅ Status tracking for both bugs and features
- ✅ Vote counting for feature requests
- ✅ Platform and version tracking

## How to Apply This Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `bug_reports_and_feature_requests.sql`
5. Paste into the SQL editor
6. Click **Run** to execute the migration

### Option 2: Supabase CLI
```bash
# Make sure you're in the project root
cd /Users/nikkimaebatanes/CascadeProjects/siFia

# Apply the migration
supabase db push database/migrations/bug_reports_and_feature_requests.sql
```

### Option 3: Direct psql Connection
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f database/migrations/bug_reports_and_feature_requests.sql
```

## Verification

After applying the migration, verify it worked:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bug_reports', 'feature_requests');

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('bug_reports', 'feature_requests');

-- Test insert (should work)
INSERT INTO bug_reports (user_id, message, platform, os_version, screen)
VALUES (auth.uid(), 'Test bug report', 'ios', '17.0', 'TestScreen');
```

## Rollback

If you need to undo this migration:

```sql
-- Run the rollback script
-- Copy contents from bug_reports_and_feature_requests_rollback.sql
```

## Schema Details

### bug_reports Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users (nullable) |
| message | TEXT | Bug description |
| platform | TEXT | 'ios' or 'android' |
| os_version | TEXT | OS version number |
| screen | TEXT | Screen where bug occurred |
| app_version | TEXT | App version (nullable) |
| extra | JSONB | Additional metadata |
| status | TEXT | 'new', 'investigating', 'fixed', 'wont_fix', 'duplicate' |
| created_at | TIMESTAMPTZ | Auto-generated |
| updated_at | TIMESTAMPTZ | Auto-updated |

### feature_requests Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users (nullable) |
| message | TEXT | Feature description |
| category | TEXT | Feature category |
| platform | TEXT | 'ios' or 'android' |
| os_version | TEXT | OS version number |
| screen | TEXT | Screen where requested |
| app_version | TEXT | App version (nullable) |
| extra | JSONB | Additional metadata |
| status | TEXT | 'new', 'under_review', 'planned', 'in_progress', 'completed', 'declined' |
| votes | INTEGER | Vote count (default 0) |
| created_at | TIMESTAMPTZ | Auto-generated |
| updated_at | TIMESTAMPTZ | Auto-updated |

## Security

Both tables have Row Level Security (RLS) enabled with the following policies:
- Users can insert their own reports/requests
- Users can only view their own submissions
- Service role has full access for admin purposes

## Next Steps

After applying this migration:
1. ✅ Test bug report submission in the app
2. ✅ Test feature request submission in the app
3. ✅ Verify data appears in Supabase dashboard
4. ✅ Check logs for any errors

## Troubleshooting

### Error: "relation 'bug_reports' does not exist"
- The migration hasn't been applied yet. Follow the steps above.

### Error: "permission denied for table bug_reports"
- RLS policies may not be set up correctly. Re-run the migration.

### Error: "new row violates row-level security policy"
- User is not authenticated or user_id doesn't match auth.uid()
- Make sure the user is logged in before submitting

## Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify RLS policies are active
3. Ensure user is authenticated
4. Check app logs for detailed error messages
