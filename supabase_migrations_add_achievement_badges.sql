-- ============================================================================
-- Migration: Add Achievement Badges to badges table
-- Purpose: Populate badges table with all achievement badges for the app
-- Date: 2025-11-26
-- ============================================================================

-- DIAGNOSTIC: Check current badge table schema
-- Run this first to see what columns exist:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'badges' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- First, check existing badges table structure and add missing columns
-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Check if badges table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'badges' AND table_schema = 'public') THEN
        -- Add missing columns one by one
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'icon' AND table_schema = 'public') THEN
            ALTER TABLE badges ADD COLUMN icon TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'faith_points_reward' AND table_schema = 'public') THEN
            ALTER TABLE badges ADD COLUMN faith_points_reward INTEGER DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'rarity' AND table_schema = 'public') THEN
            ALTER TABLE badges ADD COLUMN rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'created_at' AND table_schema = 'public') THEN
            ALTER TABLE badges ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'updated_at' AND table_schema = 'public') THEN
            ALTER TABLE badges ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
    ELSE
        -- Create badges table if it doesn't exist
        CREATE TABLE badges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            icon TEXT,
            faith_points_reward INTEGER DEFAULT 0,
            rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Ensure user_badges table exists with proper foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_badges' AND table_schema = 'public') THEN
        CREATE TABLE user_badges (
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
            earned_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (user_id, badge_id)
        );
    END IF;
END $$;

-- Enable Row Level Security (RLS) on user_badges table
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_badges table (idempotent)
-- Users can only insert/view their own badges
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_badges' 
        AND policyname = 'Users can insert their own badges'
    ) THEN
        CREATE POLICY "Users can insert their own badges" ON user_badges
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_badges' 
        AND policyname = 'Users can view their own badges'
    ) THEN
        CREATE POLICY "Users can view their own badges" ON user_badges
          FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Enable RLS on badges table (read-only for authenticated users)
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for badges table (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'badges' 
        AND policyname = 'Authenticated users can view badges'
    ) THEN
        CREATE POLICY "Authenticated users can view badges" ON badges
          FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END $$;

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

-- Level Achievement Badges
INSERT INTO badges (name, description, icon, faith_points_reward, rarity)
VALUES 
  ('Level 1: Newborn', 'Reached level 1', '🌟', 50, 'common'),
  ('Level 2: Growing', 'Reached level 2', '🌱', 100, 'common'),
  ('Level 3: Flourishing', 'Reached level 3', '🌿', 200, 'rare'),
  ('Level 4: Thriving', 'Reached level 4', '🌳', 400, 'rare'),
  ('Level 5: Faith Champion', 'Reached level 5', '👑', 1000, 'legendary'),
  ('Level 6: Faith Master', 'Reached level 6', '🏆', 2000, 'legendary'),
  ('Level 7: Faith Legend', 'Reached level 7', '💫', 3500, 'legendary'),
  ('Level 8: Faith Saint', 'Reached level 8', '🌟', 5000, 'legendary'),
  ('Level 9: Faith Prophet', 'Reached level 9', '✨', 7500, 'legendary'),
  ('Level 10: Faith Apostle', 'Reached level 10', '🌈', 10000, 'legendary')
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
--   'Faith Champion',
--   'Level 1: Newborn', 'Level 2: Growing', 'Level 3: Flourishing', 'Level 4: Thriving',
--   'Level 5: Faith Champion', 'Level 6: Faith Master', 'Level 7: Faith Legend',
--   'Level 8: Faith Saint', 'Level 9: Faith Prophet', 'Level 10: Faith Apostle'
-- );
