#!/bin/bash

# Reset the "shown today" flag for streak celebration
# Usage: ./reset-streak-shown.sh

USER_ID="9f85144e-f565-4121-811c-32c0df348e9b"
SUPABASE_URL="https://aesmrjinczhknchlrsmt.supabase.co"

# Load environment variables
source .env

echo "Resetting streak 'shown today' flag for user $USER_ID..."

# Delete the AsyncStorage key for today's streak shown
# This is stored in AsyncStorage on the device, but we can't directly delete it from the server
# You need to do this from the app's code or clear app data

echo "⚠️  To reset the flag, you need to:"
echo "   1. Clear app data in Settings > Apps > siFia > Clear Data"
echo "   2. Or add this code to your app temporarily:"
echo ""
echo "   import AsyncStorage from '@react-native-async-storage/async-storage';"
echo "   const today = new Date();"
echo "   const year = today.getFullYear();"
echo "   const month = String(today.getMonth() + 1).padStart(2, '0');"
echo "   const day = String(today.getDate()).padStart(2, '0');"
echo "   const dateString = \`\${year}-\${month}-\${day}\`;"
echo "   await AsyncStorage.removeItem(\`visible_streak_shown_${USER_ID}_\${dateString}\`);"
