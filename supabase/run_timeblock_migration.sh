#!/bin/bash

# Script to run the timeblocks schema migration
# This will fix the missing columns that are causing timeblock save errors

echo "🔧 Running timeblocks schema migration..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Navigate to the supabase directory
cd "$(dirname "$0")"

# Run the migration
echo "📝 Applying migration: 20241126_timeblocks_schema_update.sql"
supabase db push

echo "✅ Migration completed successfully!"
echo "📋 The timeblocks table has been updated with missing columns:"
echo "   - alarm_minutes (for calendar alarm functionality)"
echo "   - repeat_frequency (for repeat scheduling)"
echo "   - repeat_end_date (for repeat end date)"
echo "   - repeat_custom_frequency (for custom repeat intervals)"
echo "🔄 You may need to restart your app for the changes to take effect."
echo "🔄 You may also need to clear the schema cache in Supabase."
