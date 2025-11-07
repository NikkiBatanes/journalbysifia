-- Notification System Database Tables
-- Run this migration in Supabase SQL Editor

-- =====================================================
-- 1. notification_analytics table
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID,
  type TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  tapped_at TIMESTAMP WITH TIME ZONE,
  deep_link TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user_id ON notification_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_notification_id ON notification_analytics(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_type ON notification_analytics(type);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_created_at ON notification_analytics(created_at);

-- RLS Policies
ALTER TABLE notification_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification analytics"
  ON notification_analytics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notification analytics"
  ON notification_analytics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update notification analytics"
  ON notification_analytics
  FOR UPDATE
  USING (true);

-- =====================================================
-- 2. user_streaks table
-- =====================================================
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  prayer_streak INT DEFAULT 0,
  prayer_last_date DATE,
  prayer_best_streak INT DEFAULT 0,
  devotional_streak INT DEFAULT 0,
  devotional_last_date DATE,
  devotional_best_streak INT DEFAULT 0,
  journal_streak INT DEFAULT 0,
  journal_last_date DATE,
  journal_best_streak INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);

-- RLS Policies
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks"
  ON user_streaks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks"
  ON user_streaks
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streaks"
  ON user_streaks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. Update notification_preferences table (if needed)
-- =====================================================
-- Add new notification type columns if they don't exist
DO $$
BEGIN
  -- Check and add columns one by one
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_preferences' 
                 AND column_name = 'prayer_request_reminders') THEN
    ALTER TABLE notification_preferences 
    ADD COLUMN prayer_request_reminders BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_preferences' 
                 AND column_name = 'gratitude_reminders') THEN
    ALTER TABLE notification_preferences 
    ADD COLUMN gratitude_reminders BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_preferences' 
                 AND column_name = 'wins_reminders') THEN
    ALTER TABLE notification_preferences 
    ADD COLUMN wins_reminders BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_preferences' 
                 AND column_name = 'affirmation_reminders') THEN
    ALTER TABLE notification_preferences 
    ADD COLUMN affirmation_reminders BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_preferences' 
                 AND column_name = 'daily_scripture') THEN
    ALTER TABLE notification_preferences 
    ADD COLUMN daily_scripture BOOLEAN DEFAULT true;
  END IF;
END $$;

-- =====================================================
-- 4. Helper Functions
-- =====================================================

-- Function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(
  p_user_id UUID,
  p_streak_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INT;
  v_last_date DATE;
  v_best_streak INT;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  -- Get current streak data
  IF p_streak_type = 'prayer' THEN
    SELECT prayer_streak, prayer_last_date, prayer_best_streak
    INTO v_current_streak, v_last_date, v_best_streak
    FROM user_streaks
    WHERE user_id = p_user_id;
  ELSIF p_streak_type = 'devotional' THEN
    SELECT devotional_streak, devotional_last_date, devotional_best_streak
    INTO v_current_streak, v_last_date, v_best_streak
    FROM user_streaks
    WHERE user_id = p_user_id;
  ELSIF p_streak_type = 'journal' THEN
    SELECT journal_streak, journal_last_date, journal_best_streak
    INTO v_current_streak, v_last_date, v_best_streak
    FROM user_streaks
    WHERE user_id = p_user_id;
  END IF;

  -- Initialize if no record exists
  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
    v_best_streak := 0;
  END IF;

  -- Calculate new streak
  IF v_last_date = v_today THEN
    -- Already logged today, no change
    RETURN;
  ELSIF v_last_date = v_yesterday THEN
    -- Continuing streak
    v_current_streak := v_current_streak + 1;
  ELSE
    -- Streak broken, start new
    v_current_streak := 1;
  END IF;

  -- Update best streak if needed
  IF v_current_streak > v_best_streak THEN
    v_best_streak := v_current_streak;
  END IF;

  -- Update or insert streak record
  IF p_streak_type = 'prayer' THEN
    INSERT INTO user_streaks (user_id, prayer_streak, prayer_last_date, prayer_best_streak, updated_at)
    VALUES (p_user_id, v_current_streak, v_today, v_best_streak, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      prayer_streak = v_current_streak,
      prayer_last_date = v_today,
      prayer_best_streak = v_best_streak,
      updated_at = NOW();
  ELSIF p_streak_type = 'devotional' THEN
    INSERT INTO user_streaks (user_id, devotional_streak, devotional_last_date, devotional_best_streak, updated_at)
    VALUES (p_user_id, v_current_streak, v_today, v_best_streak, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      devotional_streak = v_current_streak,
      devotional_last_date = v_today,
      devotional_best_streak = v_best_streak,
      updated_at = NOW();
  ELSIF p_streak_type = 'journal' THEN
    INSERT INTO user_streaks (user_id, journal_streak, journal_last_date, journal_best_streak, updated_at)
    VALUES (p_user_id, v_current_streak, v_today, v_best_streak, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      journal_streak = v_current_streak,
      journal_last_date = v_today,
      journal_best_streak = v_best_streak,
      updated_at = NOW();
  END IF;
END;
$$;

-- =====================================================
-- 5. Grant Permissions
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON notification_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_streaks TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
