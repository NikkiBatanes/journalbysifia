#!/bin/bash

# Test the daily review notification for a specific user
# Usage: ./test-daily-review-notification.sh <user_id>

USER_ID=${1:-""}

if [ -z "$USER_ID" ]; then
  echo "❌ Error: Please provide a user_id"
  echo "Usage: ./test-daily-review-notification.sh <user_id>"
  exit 1
fi

echo "🔔 Testing daily review notification for user: $USER_ID"

# Get Supabase URL and function name from environment or use defaults
SUPABASE_URL=${SUPABASE_URL:-"https://your-project.supabase.co"}
FUNCTION_NAME="schedule-daily-notifications"

# Call the edge function with test_user_id
curl -X POST \
  "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"test_user_id": "'"$USER_ID"'"}' \
  -v

echo ""
echo "✅ Test completed. Check the response above for details."
