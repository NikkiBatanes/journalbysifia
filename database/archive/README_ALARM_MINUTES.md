# Time Block Alarm Minutes Migration

## Overview
This migration adds the `alarm_minutes` column to the `time_blocks` table to support user-configurable alarm preferences for calendar events.

## Files
- `add_alarm_minutes_to_time_blocks.sql` - Main migration
- `add_alarm_minutes_to_time_blocks_rollback.sql` - Rollback script

## How to Run

### Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `add_alarm_minutes_to_time_blocks.sql`
4. Click **Run** to execute the migration

### Using Supabase CLI
```bash
# Apply migration
supabase db push

# Or manually run the SQL file
psql -h your-db-host -U postgres -d your-db-name -f add_alarm_minutes_to_time_blocks.sql
```

## After Running Migration

Once the migration is successfully applied:

1. Open `/src/components/journal/TimeBlockReactQuery.tsx`
2. Find the two commented lines (search for "TODO: Uncomment after running database migration"):
   - Line ~826 in the edit flow
   - Line ~930 in the create flow
3. Uncomment both lines:
   ```typescript
   // Change from:
   // alarm_minutes: alertToMinutes(newBlock.alert), // TODO: Uncomment after running database migration
   
   // To:
   alarm_minutes: alertToMinutes(newBlock.alert),
   ```
4. Save the file

## What This Enables

After the migration and code update:
- ✅ Users can select custom alarm times (5 min, 15 min, 30 min, 1 hour, etc.)
- ✅ Alarm preference is saved to the database
- ✅ Calendar events are created with the user's chosen alarm time
- ✅ No more hardcoded 15-minute alarms

## Rollback

If you need to rollback this migration:
```sql
-- Run the rollback script
-- This will remove the alarm_minutes column and its index
```

Copy and paste the contents of `add_alarm_minutes_to_time_blocks_rollback.sql` in the SQL Editor.

## Verification

After running the migration, verify it worked:
```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'time_blocks' AND column_name = 'alarm_minutes';

-- Should return:
-- column_name   | data_type | is_nullable
-- alarm_minutes | integer   | YES
```
