#!/bin/bash

# Industry-Standard Auth Migration Script
# This script updates all files to use the new industry-standard authentication

echo "🔐 Migrating to Industry-Standard Authentication..."

# Update import statements
find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/useEnhancedAuth/useAuth/g'
find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' "s/import { useEnhancedAuth } from '..\/context\/EnhancedAuthContext';/import { useAuth } from '..\/context\/IndustryStandardAuthContext';/g"
find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' "s/import { useEnhancedAuth } from '..\/..\/context\/EnhancedAuthContext';/import { useAuth } from '..\/..\/context\/IndustryStandardAuthContext';/g"

# Update specific patterns for auth usage
find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/const { user } = useEnhancedAuth();/const { user } = useAuth();/g'
find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/const { user, logout } = useEnhancedAuth();/const { user, signOut } = useAuth();/g'

echo "✅ Migration complete!"
echo ""
echo "📋 Manual updates still needed:"
echo "1. Update logout calls to use signOut"
echo "2. Update login calls to use signIn"
echo "3. Test all authentication flows"
