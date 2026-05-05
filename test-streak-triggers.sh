#!/bin/bash

# Test script to manually trigger streak events for StreakPlanScreen
# Usage: ./test-streak-triggers.sh <activity_type>
# Example: ./test-streak-triggers.sh journal_win_added

USER_ID="9f85144e-f565-4121-811c-32c0df348e9b"
SUPABASE_URL="https://aesmrjinczhknchlrsmt.supabase.co"

# Load environment variables
source .env

ACTIVITY_TYPE=$1

if [ -z "$ACTIVITY_TYPE" ]; then
  echo "Usage: $0 <activity_type>"
  echo ""
  echo "Available activity types:"
  echo "  action_step_completed"
  echo "  affirmation_read_aloud"
  echo "  gratitude_saved"
  echo "  journal_win_added"
  echo "  journal_looking_forward_added"
  echo "  prayer_saved"
  echo "  reflection_saved"
  echo "  journal_gratitude_added"
  echo ""
  echo "Example: $0 journal_win_added"
  exit 1
fi

# Insert faith_points_log entry
curl -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"activity_type\": \"$ACTIVITY_TYPE\",
    \"points\": 1,
    \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"
  }"

echo ""
echo "✅ Inserted $ACTIVITY_TYPE for user $USER_ID"
echo ""
echo "To reset the 'shown today' flag (so streak shows again), run:"
echo "curl -X POST '$SUPABASE_URL/rest/v1/rpc/reset_streak_shown' \\"
echo "  -H 'apikey: $SUPABASE_ANON_KEY' \\"
echo "  -H 'Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"user_id\": \"$USER_ID\"}'"
