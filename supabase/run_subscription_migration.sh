#!/bin/bash

# Script to create the subscription tables needed for payment validation
# This creates user_subscriptions_new and validated_receipts tables

echo "🔧 Creating subscription tables for payment validation..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Navigate to the supabase directory
cd "$(dirname "$0")"

# Run the migration
echo "📝 Applying migration: 20251127_create_subscription_tables.sql"
supabase db push

echo "✅ Migration completed successfully!"
echo "📋 Created tables:"
echo "   - user_subscriptions_new (for subscription management)"
echo "   - validated_receipts (for receipt validation logging)"
echo "🔄 Restart your app for the changes to take effect."
echo "🔒 Your payment validation should now work properly!"
