-- Check all notifications for your user
SELECT 
  id,
  type,
  title,
  message,
  status,
  sent_at,
  scheduled_for,
  created_at,
  data
FROM notification_queue
WHERE user_id = '77cd0bb0-48ef-4f0e-8369-9d59f51a4af7'
ORDER BY created_at DESC
LIMIT 10;

-- Check only daily_review notifications
SELECT 
  id,
  type,
  title,
  message,
  status,
  sent_at,
  scheduled_for,
  created_at,
  data
FROM notification_queue
WHERE user_id = '77cd0bb0-48ef-4f0e-8369-9d59f51a4af7'
  AND type = 'daily_review'
ORDER BY created_at DESC
LIMIT 5;

-- Check pending notifications
SELECT 
  id,
  type,
  title,
  status,
  sent_at,
  scheduled_for,
  created_at
FROM notification_queue
WHERE user_id = '77cd0bb0-48ef-4f0e-8369-9d59f51a4af7'
  AND status = 'pending'
ORDER BY created_at DESC;

-- Check recently sent notifications
SELECT 
  id,
  type,
  title,
  status,
  sent_at,
  created_at
FROM notification_queue
WHERE user_id = '77cd0bb0-48ef-4f0e-8369-9d59f51a4af7'
  AND status = 'sent'
  AND sent_at IS NOT NULL
ORDER BY sent_at DESC
LIMIT 5;
