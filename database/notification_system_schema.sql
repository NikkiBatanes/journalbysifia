-- =====================================================
-- siFia Notification System Database Schema
-- =====================================================

-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, device_id)
);

-- Notification queue for scheduled notifications
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences (enhanced from existing)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Push notification settings
  push_enabled BOOLEAN DEFAULT true,
  
  -- Category preferences
  prayer_reminders BOOLEAN DEFAULT true,
  prayer_requests BOOLEAN DEFAULT true,
  playbook_actions BOOLEAN DEFAULT true,
  playbook_verses BOOLEAN DEFAULT true,
  playbook_challenges BOOLEAN DEFAULT true,
  playbook_affirmations BOOLEAN DEFAULT true,
  devotional_reminders BOOLEAN DEFAULT true,
  journal_prompts BOOLEAN DEFAULT true,
  reflection_questions BOOLEAN DEFAULT true,
  streak_alerts BOOLEAN DEFAULT true,
  milestone_celebrations BOOLEAN DEFAULT true,
  trial_notifications BOOLEAN DEFAULT true,
  
  -- Timing preferences
  quiet_hours_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  preferred_morning_time TIME DEFAULT '08:00',
  preferred_afternoon_time TIME DEFAULT '12:00',
  preferred_evening_time TIME DEFAULT '18:00',
  
  -- Frequency settings
  max_daily_notifications INTEGER DEFAULT 5,
  batch_notifications BOOLEAN DEFAULT false,
  
  -- Timezone
  timezone TEXT DEFAULT 'UTC',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Notification delivery log for analytics
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID REFERENCES notification_queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_id UUID REFERENCES device_tokens(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'opened', 'dismissed')),
  error_code TEXT,
  error_message TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prayer requests table for community prayer features
CREATE TABLE IF NOT EXISTS prayer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name TEXT,
  prayer_text TEXT NOT NULL,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'urgent')),
  is_anonymous BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'answered', 'archived')),
  prayer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity tracking for smart notifications
CREATE TABLE IF NOT EXISTS user_activity_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FUNCTIONS FOR NOTIFICATION TRIGGERS
-- =====================================================

-- Function to check for incomplete prayers
CREATE OR REPLACE FUNCTION check_prayer_reminders()
RETURNS void AS $$
BEGIN
  INSERT INTO notification_queue (user_id, type, title, message, data, scheduled_for, priority)
  SELECT 
    u.id,
    'prayer_reminder',
    'Time for Prayer 💙',
    CASE 
      WHEN u.first_name IS NOT NULL 
      THEN u.first_name || ', your heart is ready for prayer. Take a moment with God today.'
      ELSE 'Your heart is ready for prayer. Take a moment with God today.'
    END,
    json_build_object(
      'last_prayer_date', COALESCE(uat.last_prayer, CURRENT_DATE - INTERVAL '1 day'),
      'streak_days', COALESCE(up.current_streak, 0)
    ),
    CASE 
      WHEN np.preferred_morning_time IS NOT NULL 
      THEN CURRENT_DATE + np.preferred_morning_time
      ELSE CURRENT_DATE + TIME '08:00'
    END,
    'normal'
  FROM auth.users u
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  LEFT JOIN user_profiles up ON u.id = up.user_id
  LEFT JOIN (
    SELECT 
      user_id, 
      MAX(completed_at::date) as last_prayer
    FROM user_activity_tracking 
    WHERE activity_type = 'prayer_logged'
    GROUP BY user_id
  ) uat ON u.id = uat.user_id
  WHERE 
    (np.prayer_reminders IS NULL OR np.prayer_reminders = true)
    AND (uat.last_prayer IS NULL OR uat.last_prayer < CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq 
      WHERE nq.user_id = u.id 
      AND nq.type = 'prayer_reminder' 
      AND nq.scheduled_for::date = CURRENT_DATE
      AND nq.status = 'pending'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check for incomplete playbook action steps
CREATE OR REPLACE FUNCTION check_playbook_step_reminders()
RETURNS void AS $$
BEGIN
  INSERT INTO notification_queue (user_id, type, title, message, data, scheduled_for, priority)
  SELECT 
    ps.user_id,
    'playbook_step',
    'Ready for Your Next Step? 🎯',
    CASE 
      WHEN u.first_name IS NOT NULL 
      THEN 'Ready for ''' || p.title || '''? Your next step: ' || ast.title
      ELSE 'Time to continue ''' || p.title || '''. Next: ' || ast.title
    END,
    json_build_object(
      'playbook_id', ps.playbook_id,
      'action_step_id', ps.current_step_id,
      'playbook_title', p.title,
      'step_title', ast.title,
      'step_number', ast.step_number
    ),
    CASE 
      WHEN np.preferred_evening_time IS NOT NULL 
      THEN CURRENT_DATE + np.preferred_evening_time
      ELSE CURRENT_DATE + TIME '18:00'
    END,
    'high'
  FROM playbook_sessions ps
  JOIN playbooks p ON ps.playbook_id = p.id
  JOIN action_steps ast ON ps.current_step_id = ast.id
  JOIN auth.users u ON ps.user_id = u.id
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  WHERE 
    ps.status = 'active'
    AND ps.last_activity < NOW() - INTERVAL '24 hours'
    AND (np.playbook_actions IS NULL OR np.playbook_actions = true)
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq 
      WHERE nq.user_id = ps.user_id 
      AND nq.type = 'playbook_step' 
      AND nq.data->>'playbook_id' = ps.playbook_id::text
      AND nq.scheduled_for::date = CURRENT_DATE
      AND nq.status = 'pending'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check for unread devotionals
CREATE OR REPLACE FUNCTION check_devotional_reminders()
RETURNS void AS $$
BEGIN
  INSERT INTO notification_queue (user_id, type, title, message, data, scheduled_for, priority)
  SELECT 
    u.id,
    'devotional_reminder',
    'Your Daily Devotional Awaits 🌅',
    CASE 
      WHEN u.first_name IS NOT NULL 
      THEN 'Good morning ' || u.first_name || '! Today''s devotional is ready for you.'
      ELSE 'Good morning! Your personalized devotional is ready.'
    END,
    json_build_object(
      'devotional_date', CURRENT_DATE,
      'last_read_date', COALESCE(uat.last_devotional, CURRENT_DATE - INTERVAL '1 day')
    ),
    CASE 
      WHEN np.preferred_morning_time IS NOT NULL 
      THEN CURRENT_DATE + np.preferred_morning_time
      ELSE CURRENT_DATE + TIME '07:30'
    END,
    'high'
  FROM auth.users u
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  LEFT JOIN (
    SELECT 
      user_id, 
      MAX(completed_at::date) as last_devotional
    FROM user_activity_tracking 
    WHERE activity_type = 'devotional_read'
    GROUP BY user_id
  ) uat ON u.id = uat.user_id
  WHERE 
    (np.devotional_reminders IS NULL OR np.devotional_reminders = true)
    AND (uat.last_devotional IS NULL OR uat.last_devotional < CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq 
      WHERE nq.user_id = u.id 
      AND nq.type = 'devotional_reminder' 
      AND nq.scheduled_for::date = CURRENT_DATE
      AND nq.status = 'pending'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR REAL-TIME NOTIFICATIONS
-- =====================================================

-- Trigger for new prayer requests
CREATE OR REPLACE FUNCTION notify_prayer_request()
RETURNS trigger AS $$
BEGIN
  -- Notify community members about new prayer request
  INSERT INTO notification_queue (user_id, type, title, message, data, scheduled_for, priority)
  SELECT 
    u.id,
    'prayer_request',
    'Prayer Request from ' || COALESCE(NEW.requester_name, 'Community'),
    LEFT(NEW.prayer_text, 100) || CASE WHEN LENGTH(NEW.prayer_text) > 100 THEN '...' ELSE '' END,
    json_build_object(
      'prayer_request_id', NEW.id,
      'requester_name', NEW.requester_name,
      'urgency', NEW.urgency
    ),
    NOW(),
    CASE WHEN NEW.urgency = 'urgent' THEN 'high' ELSE 'normal' END
  FROM auth.users u
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  WHERE 
    u.id != NEW.user_id -- Don't notify the requester
    AND (np.prayer_requests IS NULL OR np.prayer_requests = true);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prayer_request_notification
  AFTER INSERT ON prayer_requests
  FOR EACH ROW EXECUTE FUNCTION notify_prayer_request();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_status ON notification_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON notification_queue(user_id, type);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_user ON notification_delivery_log(user_id, delivered_at);

-- Indexes for user_activity_tracking (moved from table definition)
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity_tracking(user_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity_tracking(user_id, completed_at);

-- Indexes for prayer_requests
CREATE INDEX IF NOT EXISTS idx_prayer_requests_user ON prayer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_status ON prayer_requests(status, is_public);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_created ON prayer_requests(created_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;

-- Policies for device_tokens
DROP POLICY IF EXISTS "Users can manage their own device tokens" ON device_tokens;
CREATE POLICY "Users can manage their own device tokens" ON device_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Policies for notification_queue
DROP POLICY IF EXISTS "Users can view their own notifications" ON notification_queue;
CREATE POLICY "Users can view their own notifications" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for notification_preferences
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Policies for notification_delivery_log
DROP POLICY IF EXISTS "Users can view their own delivery logs" ON notification_delivery_log;
CREATE POLICY "Users can view their own delivery logs" ON notification_delivery_log
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for user_activity_tracking
DROP POLICY IF EXISTS "Users can manage their own activity tracking" ON user_activity_tracking;
CREATE POLICY "Users can manage their own activity tracking" ON user_activity_tracking
  FOR ALL USING (auth.uid() = user_id);

-- Policies for prayer_requests
DROP POLICY IF EXISTS "Users can manage their own prayer requests" ON prayer_requests;
CREATE POLICY "Users can manage their own prayer requests" ON prayer_requests
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view public prayer requests" ON prayer_requests;
CREATE POLICY "Users can view public prayer requests" ON prayer_requests
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
