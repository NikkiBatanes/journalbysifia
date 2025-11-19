-- Test script to manually insert a family invitation notification
-- This will help us verify if the queue processing is working

-- 1. Insert a test family invitation notification into the queue
INSERT INTO notification_queue (
  user_id,
  type,
  title,
  message,
  data,
  scheduled_for,
  priority,
  status,
  attempts,
  created_at
) VALUES (
  '3ddd0e8f-c209-47df-bd97-520a6aaec277',
  'family_invitation',
  '🎉 Family Invitation Test',
  'This is a test family invitation push notification',
  '{"test": true, "invitation_code": "TEST1234"}'::jsonb,
  NOW(),
  'high',
  'pending',
  0,
  NOW()
);

-- 2. Check if it was inserted
SELECT 
  id,
  type,
  title,
  status,
  scheduled_for,
  created_at
FROM notification_queue
WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
  AND type = 'family_invitation'
ORDER BY created_at DESC
LIMIT 1;

-- 3. Wait 1-2 minutes for the cron to process it, then check the status again
-- Run this query after waiting:
-- SELECT id, type, title, status, attempts, sent_at, error_message
-- FROM notification_queue
-- WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
--   AND type = 'family_invitation'
-- ORDER BY created_at DESC
-- LIMIT 1;

-- 4. Check delivery log for any errors
-- SELECT *
-- FROM notification_delivery_log
-- WHERE user_id = '3ddd0e8f-c209-47df-bd97-520a6aaec277'
-- ORDER BY delivered_at DESC
-- LIMIT 5;
