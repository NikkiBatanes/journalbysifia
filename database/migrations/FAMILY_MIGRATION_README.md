# Family Subscription Database Migration

## Overview

This migration creates the database tables and structures needed for the Family Subscription feature with invite codes (5 members max: 1 admin + 4 additional).

## Files

- `family_subscription_tables.sql` - Main migration (creates tables)
- `family_subscription_tables_rollback.sql` - Rollback migration (removes tables)

## What Gets Created

### Tables

1. **family_subscription_groups**
   - Stores family groups
   - Max 5 members (enforced by constraint)
   - Tracks admin, member count, status

2. **family_invitations**
   - Stores 8-character invite codes
   - Expires after 7 days
   - Tracks status (pending, accepted, declined, expired)

### Columns Added to Existing Tables

- `user_subscriptions_new.family_group_id` - Links user to family group
- `user_subscriptions_new.family_role` - User's role (admin or member)

### Security Features

- ✅ Row Level Security (RLS) policies
- ✅ Only admin can manage family group
- ✅ Only admin can create/cancel invitations
- ✅ Members can only view their own group
- ✅ Constraints enforce 5-member limit

### Helper Functions

- `family_group_has_space(group_id)` - Check if group can accept new member
- `increment_family_member_count(group_id)` - Add member to count
- `decrement_family_member_count(group_id)` - Remove member from count

## How to Run Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy contents of `family_subscription_tables.sql`
5. Paste and click **Run**
6. Check for success messages in output

### Option 2: Supabase CLI

```bash
# Make sure you're in the project root
cd /Users/nikkimaebatanes/CascadeProjects/siFia

# Run the migration
supabase db push --db-url "your-database-url" < database/migrations/family_subscription_tables.sql
```

### Option 3: psql Command Line

```bash
psql "your-database-connection-string" -f database/migrations/family_subscription_tables.sql
```

## Verification

After running the migration, you should see these success messages:

```
✅ family_subscription_groups table created successfully
✅ family_invitations table created successfully
✅ family_group_id column added to user_subscriptions_new
✅ family_role column added to user_subscriptions_new
✅ Family subscription migration completed successfully
```

### Manual Verification

Run this query to verify tables exist:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('family_subscription_groups', 'family_invitations');

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions_new' 
AND column_name IN ('family_group_id', 'family_role');

-- Check constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'family_subscription_groups';
```

## Rollback (If Needed)

⚠️ **WARNING**: This will delete all family subscription data!

```bash
# Run rollback migration
psql "your-database-connection-string" -f database/migrations/family_subscription_tables_rollback.sql
```

Or in Supabase Dashboard:
1. Open SQL Editor
2. Copy contents of `family_subscription_tables_rollback.sql`
3. Run the query

## Testing After Migration

### 1. Test Table Creation

```sql
-- Should return 2 rows
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name IN ('family_subscription_groups', 'family_invitations');
```

### 2. Test Constraints

```sql
-- This should FAIL (max_members must be 5)
INSERT INTO family_subscription_groups (admin_user_id, group_name, max_members)
VALUES ('00000000-0000-0000-0000-000000000000', 'Test', 6);

-- This should SUCCEED
INSERT INTO family_subscription_groups (admin_user_id, group_name, max_members)
VALUES ('00000000-0000-0000-0000-000000000000', 'Test', 5);
```

### 3. Test Helper Functions

```sql
-- Test family_group_has_space function
SELECT family_group_has_space('your-group-id-here');
```

## Troubleshooting

### Error: "relation already exists"

The tables already exist. You can either:
1. Drop them first using the rollback migration
2. Skip this migration

### Error: "column already exists"

The columns were already added. This is safe to ignore.

### Error: "permission denied"

Make sure you're running as a user with CREATE TABLE privileges.

### Error: "uuid_generate_v4() does not exist"

Run this first:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Next Steps After Migration

1. ✅ Verify tables created successfully
2. ✅ Test family group creation in app
3. ✅ Test invite code generation
4. ✅ Test member acceptance flow
5. ✅ Monitor for any errors

## Database Schema Diagram

```
┌─────────────────────────────────┐
│  family_subscription_groups     │
├─────────────────────────────────┤
│ id (PK)                         │
│ admin_user_id (FK)              │
│ group_name                      │
│ max_members (always 5)          │
│ current_members                 │
│ platform_subscription_id        │
│ status                          │
│ created_at                      │
│ updated_at                      │
└─────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────┐
│  family_invitations             │
├─────────────────────────────────┤
│ id (PK)                         │
│ family_group_id (FK)            │
│ invited_email                   │
│ invited_by_user_id (FK)         │
│ invitation_code (8 chars)       │
│ status                          │
│ expires_at                      │
│ created_at                      │
│ updated_at                      │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  user_subscriptions_new         │
├─────────────────────────────────┤
│ ... existing columns ...        │
│ family_group_id (FK) ← NEW      │
│ family_role ← NEW               │
└─────────────────────────────────┘
```

## Support

If you encounter any issues:
1. Check the error message carefully
2. Verify your database connection
3. Ensure you have proper permissions
4. Check if tables already exist
5. Review the migration logs

---

**Migration Version**: 1.0  
**Created**: November 11, 2025  
**Last Updated**: November 11, 2025
