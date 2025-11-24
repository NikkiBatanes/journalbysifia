#!/bin/bash

# Script to run the affirmations text length fix migration
# This will fix the database constraint that's causing affirmation save errors

echo "🔧 Running affirmations text length constraint fix migration..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Navigate to the supabase directory
cd "$(dirname "$0")"

# Run the migration
echo "📝 Applying migration: 20241124_fix_affirmations_text_length.sql"
supabase db push

echo "✅ Migration completed successfully!"
echo "📋 The affirmations text length constraint has been increased to 1000 characters."
echo "🔄 You may need to restart your app for the changes to take effect."
