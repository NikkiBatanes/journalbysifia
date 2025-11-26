-- Test notifications with deep links to verify navigation works
-- This creates notifications that will navigate to specific screens when tapped

-- Test notification with prayer deep link
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  data,
  is_read,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'REMINDER',
  'Prayer Time',
  'Time for your daily prayer',
  '{"type": "prayer_reminder", "deep_link": "sifia://prayer/123"}',
  false,
  NOW()
);

-- Test notification with devotional deep link
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  data,
  is_read,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'REMINDER',
  'Devotional Time',
  'New devotional is ready',
  '{"type": "devotional_reminder", "deep_link": "sifia://devotional/456"}',
  false,
  NOW()
);

-- Test notification with journal deep link
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  data,
  is_read,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTIVITY',
  'Journal Prompt',
  'New journal prompt available',
  '{"type": "journal_prompt", "deep_link": "sifia://journal"}',
  false,
  NOW()
);

-- Test notification with profile deep link
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  data,
  is_read,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACHIEVEMENT',
  'Milestone Reached!',
  'You completed your first milestone!',
  '{"type": "milestone_celebration", "deep_link": "sifia://profile"}',
  false,
  NOW()
);

-- Show all notifications with deep links
SELECT type, title, data->>'deep_link' as deep_link, created_at FROM notifications 
WHERE user_id = '00000000-0000-0000-0000-000000000001'
AND data->>'deep_link' IS NOT NULL
ORDER BY created_at DESC;

-- Show total count
SELECT COUNT(*) as total_notifications FROM notifications;
