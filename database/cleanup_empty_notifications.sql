-- Update notifications with empty messages to have better default content
UPDATE notifications
SET 
  message = CASE 
    WHEN type = 'SYSTEM' THEN 'A system notification requires your attention.'
    WHEN type = 'REMINDER' THEN 'You have a reminder from siFia.'
    WHEN type = 'ACHIEVEMENT' THEN 'You have achieved something great!'
    WHEN type = 'ACTIVITY' THEN 'There is activity in your account.'
    WHEN type = 'PROMOTIONAL' THEN 'A special offer is available for you.'
    ELSE 'A new notification is available.'
  END
WHERE message = '' OR message IS NULL;

-- Update notification_queue with empty messages to have better default content
UPDATE notification_queue
SET 
  message = CASE 
    WHEN type LIKE '%reminder%' THEN 'You have a reminder from siFia.'
    WHEN type LIKE '%devotional%' THEN 'Your devotional is ready.'
    WHEN type LIKE '%prayer%' THEN 'Time for prayer.'
    WHEN type LIKE '%journal%' THEN 'A journal prompt awaits you.'
    ELSE 'A new notification is available.'
  END
WHERE message = '' OR message IS NULL;
