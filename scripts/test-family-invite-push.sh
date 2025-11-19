#!/bin/bash

# Test script to manually trigger push notification processing
# This helps debug why family invitation push notifications aren't being sent

echo "🔍 Testing Family Invitation Push Notifications"
echo "================================================"
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

SUPABASE_URL="https://aesmrjinczhknchlrsmt.supabase.co"
USER_ID="3ddd0e8f-c209-47df-bd97-520a6aaec277"

echo "1️⃣ Checking notification queue for family invitations..."
echo ""

# Call the edge function to process the queue
echo "2️⃣ Manually triggering notification queue processor..."
curl -X POST \
  "${SUPABASE_URL}/functions/v1/process-notification-queue" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
echo ""
echo "3️⃣ Check the results by running this SQL in Supabase:"
echo ""
echo "SELECT * FROM notification_queue"
echo "WHERE type = 'family_invitation'"
echo "  AND user_id = '${USER_ID}'"
echo "ORDER BY created_at DESC"
echo "LIMIT 5;"
echo ""
echo "4️⃣ Check delivery logs:"
echo ""
echo "SELECT * FROM notification_delivery_log"
echo "WHERE user_id = '${USER_ID}'"
echo "ORDER BY created_at DESC"
echo "LIMIT 5;"
echo ""
echo "✅ Done! Check Supabase logs for any errors."
