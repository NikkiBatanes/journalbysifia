-- Check notification_queue table structure and data
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_queue'
ORDER BY ordinal_position;

-- Check notifications table structure and data
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- Check actual notification_queue data
SELECT id, user_id, type, title, message, status, scheduled_for, created_at
FROM notification_queue
ORDER BY created_at DESC
LIMIT 10;

-- Check actual notifications data
SELECT id, user_id, type, title, message, is_read, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;
