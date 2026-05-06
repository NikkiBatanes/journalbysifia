#!/bin/bash

SUPABASE_URL="https://aesmrjinczhknchlrsmt.supabase.co"
SUPABASE_ANON_KEY=$(grep '^SUPABASE_ANON_KEY=' .env | cut -d= -f2-)
SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2-)

echo "🔔 Adding devotional day notification to queue..."

curl -X POST "${SUPABASE_URL}/rest/v1/notification_queue" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"77cd0bb0-48ef-4f0e-8369-9d59f51a4af7",
    "type":"devotional_day_ready",
    "title":"Your devotional is ready",
    "message":"Day 1: Faith Foundations is ready when you are.",
    "data":{"deep_link":"sifia://devotionals/today"},
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

curl -X GET "${SUPABASE_URL}/rest/v1/notification_queue?user_id=eq.77cd0bb0-48ef-4f0e-8369-9d59f51a4af7&type=eq.devotional_day_ready&select=id,title,message,data,sent_at,status&order=created_at.desc&limit=2" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

echo ""
