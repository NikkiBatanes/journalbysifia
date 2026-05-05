#!/bin/bash

# Test script to trigger ALL streak scenarios at once
# This inserts faith_points_log entries for all activity types

USER_ID="9f85144e-f565-4121-811c-32c0df348e9b"
SUPABASE_URL="https://aesmrjinczhknchlrsmt.supabase.co"

# Load environment variables
source .env

echo "🔥 Triggering ALL streak scenarios for user $USER_ID..."
echo ""

# Playbook-dependent triggers
echo "📝 Inserting action_step_completed..."
curl -s -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"activity_type\": \"action_step_completed\", \"points\": 1, \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}" > /dev/null

echo "📖 Inserting affirmation_read_aloud..."
curl -s -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"activity_type\": \"affirmation_read_aloud\", \"points\": 1, \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}" > /dev/null

# Journal walkthrough triggers (always trigger)
echo "🏆 Inserting journal_today_win..."
curl -s -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"activity_type\": \"journal_today_win\", \"points\": 1, \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}" > /dev/null

echo "🔮 Inserting journal_looking_forward..."
curl -s -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"activity_type\": \"journal_looking_forward\", \"points\": 1, \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}" > /dev/null

echo "🙏 Inserting journal_prayer_completed..."
curl -s -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"activity_type\": \"journal_prayer_completed\", \"points\": 1, \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}" > /dev/null

echo "💝 Inserting journal_gratitude_added..."
curl -s -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"activity_type\": \"journal_gratitude_added\", \"points\": 1, \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}" > /dev/null

echo "💭 Inserting reflection_saved..."
curl -s -X POST "$SUPABASE_URL/rest/v1/faith_points_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"activity_type\": \"reflection_saved\", \"points\": 1, \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}" > /dev/null

echo ""
echo "✅ All streak triggers inserted successfully!"
echo ""
echo "📱 Now tap the 'Test Streak' button in the Dashboard to navigate to StreakPlanTestDashboard"
echo "🎯 Then tap any test case to see the StreakPlanScreen with your streak data"
echo ""
echo "🔄 To reset the 'shown today' flag and test again:"
echo "   Clear app data in Settings > Apps > siFia > Clear Data"
