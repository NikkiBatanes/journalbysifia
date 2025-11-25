-- ============================================================================
-- Migration: Add Achievement Badges to badges table
-- Purpose: Populate badges table with all achievement badges for the app
-- Date: 2025-11-26
-- ============================================================================

-- Ensure badges table exists with proper structure
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  faith_points_reward INTEGER DEFAULT 0,
  rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure user_badges table exists with proper foreign keys
CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON user_badges(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_badges_name ON badges(name);
CREATE INDEX IF NOT EXISTS idx_badges_rarity ON badges(rarity);

-- ============================================================================
-- Insert Achievement Badges
-- ============================================================================

-- Playbook Generation Badges
INSERT INTO badges (name, description, icon, faith_points_reward, rarity)
VALUES 
  ('First Steps', 'Generated your first playbook', '👶', 10, 'common'),
  ('Growth Seeker', 'Generated 25 playbooks', '🌱', 250, 'rare'),
  ('Playbook Master', 'Generated 50 playbooks', '🌿', 500, 'epic'),
  ('Playbook Legend', 'Generated 100 playbooks', '🌳', 1000, 'legendary')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  faith_points_reward = EXCLUDED.faith_points_reward,
  rarity = EXCLUDED.rarity,
  updated_at = NOW();

-- Devotional Badges
INSERT INTO badges (name, description, icon, faith_points_reward, rarity)
VALUES 
  ('Prayer Warrior', 'Generated 10 devotionals', '🙏', 80, 'rare'),
  ('Devotional Dedicated', 'Generated 25 devotionals', '📿', 200, 'epic'),
  ('Devotional Master', 'Generated 50 devotionals', '⛪', 400, 'legendary')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  faith_points_reward = EXCLUDED.faith_points_reward,
  rarity = EXCLUDED.rarity,
  updated_at = NOW();

-- Journal Badges
INSERT INTO badges (name, description, icon, faith_points_reward, rarity)
VALUES 
  ('Journal Keeper', 'Made 50 journal entries', '📖', 250, 'epic'),
  ('Journal Scribe', 'Made 100 journal entries', '📝', 500, 'legendary')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  faith_points_reward = EXCLUDED.faith_points_reward,
  rarity = EXCLUDED.rarity,
  updated_at = NOW();

-- Streak Badges
INSERT INTO badges (name, description, icon, faith_points_reward, rarity)
VALUES 
  ('Faithful Week', 'Used the app 7 days in a row', '🔥', 35, 'common'),
  ('Streak Warrior', '14-day streak', '💪', 70, 'rare'),
  ('Streak Master', '30-day streak', '⚡', 150, 'epic'),
  ('Streak Legend', '60-day streak', '🏆', 300, 'legendary')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  faith_points_reward = EXCLUDED.faith_points_reward,
  rarity = EXCLUDED.rarity,
  updated_at = NOW();

-- Level Achievement Badges
INSERT INTO badges (name, description, icon, faith_points_reward, rarity)
VALUES 
  ('Faith Champion', 'Reached level 5', '👑', 1000, 'legendary')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  faith_points_reward = EXCLUDED.faith_points_reward,
  rarity = EXCLUDED.rarity,
  updated_at = NOW();

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify all badges were inserted correctly:
-- SELECT name, rarity, faith_points_reward, icon FROM badges ORDER BY rarity, faith_points_reward;

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
-- To remove these badges:
-- DELETE FROM badges WHERE name IN (
--   'First Steps', 'Growth Seeker', 'Playbook Master', 'Playbook Legend',
--   'Prayer Warrior', 'Devotional Dedicated', 'Devotional Master',
--   'Journal Keeper', 'Journal Scribe',
--   'Faithful Week', 'Streak Warrior', 'Streak Master', 'Streak Legend',
--   'Faith Champion'
-- );
