#!/bin/bash

SUPABASE_URL="https://aesmrjinczhknchlrsmt.supabase.co"
SUPABASE_ANON_KEY=$(grep '^SUPABASE_ANON_KEY=' .env | cut -d= -f2-)
SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2-)

echo "🔔 Adding faithful milestone notification to queue..."

curl -X POST "${SUPABASE_URL}/rest/v1/notification_queue" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"77cd0bb0-48ef-4f0e-8369-9d59f51a4af7",
    "type":"playbook_actions_milestone",
    "title":"Faithful actions progress 💪🏼",
    "message":"You'\''ve completed 5 of 10 faithful actions in \"Faith Foundations\". Keep taking one faithful step at a time.",
    "data":{"deep_link":"sifia://playbooks"},
    "scheduled_for":"now",
    "priority":"normal"
  }'

echo ""
echo "✅ Notification added to queue"
echo ""
echo "📤 Processing notification queue..."

curl -X POST "${SUPABASE_URL}/functions/v1/process-notification-queue" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo ""
echo "✅ Queue processed"
echo ""
echo "📊 Checking notification status..."

curl -X GET "${SUPABASE_URL}/rest/v1/notification_queue?user_id=eq.77cd0bb0-48ef-4f0e-8369-9d59f51a4af7&type=eq.playbook_actions_milestone&select=id,title,message,data,sent_at,status&order=created_at.desc&limit=2" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

echo ""
