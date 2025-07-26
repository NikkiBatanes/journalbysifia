-- Enhanced Devotionals Database Schema
-- Includes category support and playbook relationship tracking

-- Drop existing table if exists (for schema updates)
-- DROP TABLE IF EXISTS devotionals CASCADE;

-- Create enhanced devotionals table
CREATE TABLE IF NOT EXISTS devotionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic devotional information
  title TEXT NOT NULL,
  description TEXT,
  
  -- Category and classification
  category TEXT NOT NULL DEFAULT 'Growth' CHECK (category IN (
    'Prayer', 'Growth', 'Healing', 'Wisdom', 'Relationships', 
    'Purpose', 'Career', 'Finances', 'Mental Health', 'Parenting', 'Health'
  )),
  categories TEXT[] DEFAULT ARRAY['Growth'], -- For multiple categories support
  
  -- Playbook relationship (NEW)
  playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
  playbook_title TEXT, -- Cache playbook title for quick access
  
  -- Progress tracking
  total_days INTEGER NOT NULL DEFAULT 7 CHECK (total_days > 0),
  current_day INTEGER NOT NULL DEFAULT 1 CHECK (current_day >= 1),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Content structure (JSON for flexibility)
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- User feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rated_at TIMESTAMPTZ,
  feedback TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Search and indexing
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      COALESCE(title, '') || ' ' || 
      COALESCE(description, '') || ' ' || 
      COALESCE(category, '') || ' ' ||
      COALESCE(playbook_title, '')
    )
  ) STORED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_devotionals_user_id ON devotionals(user_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_category ON devotionals(category);
CREATE INDEX IF NOT EXISTS idx_devotionals_playbook_id ON devotionals(playbook_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_completed ON devotionals(completed);
CREATE INDEX IF NOT EXISTS idx_devotionals_progress ON devotionals(progress);
CREATE INDEX IF NOT EXISTS idx_devotionals_created_at ON devotionals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devotionals_search ON devotionals USING GIN(search_vector);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_devotionals_user_category ON devotionals(user_id, category);
CREATE INDEX IF NOT EXISTS idx_devotionals_user_completed ON devotionals(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_devotionals_user_playbook ON devotionals(user_id, playbook_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_devotionals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Auto-update completion status based on progress
  IF NEW.progress >= 100 AND NEW.completed = FALSE THEN
    NEW.completed = TRUE;
    NEW.completed_at = NOW();
  ELSIF NEW.progress < 100 AND NEW.completed = TRUE THEN
    NEW.completed = FALSE;
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_devotionals_updated_at ON devotionals;
CREATE TRIGGER trigger_devotionals_updated_at
  BEFORE UPDATE ON devotionals
  FOR EACH ROW
  EXECUTE FUNCTION update_devotionals_updated_at();

-- Function to calculate progress based on completed days
CREATE OR REPLACE FUNCTION calculate_devotional_progress(devotional_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_days_count INTEGER;
  completed_days_count INTEGER;
  calculated_progress INTEGER;
BEGIN
  -- Get total days
  SELECT total_days INTO total_days_count
  FROM devotionals 
  WHERE id = devotional_id;
  
  -- Count completed days from JSON
  SELECT COUNT(*)::INTEGER INTO completed_days_count
  FROM devotionals,
       jsonb_array_elements(days) AS day_elem
  WHERE id = devotional_id
    AND (day_elem->>'completed')::boolean = true;
  
  -- Calculate progress percentage
  IF total_days_count > 0 THEN
    calculated_progress := ROUND((completed_days_count::DECIMAL / total_days_count::DECIMAL) * 100);
  ELSE
    calculated_progress := 0;
  END IF;
  
  -- Update the devotional record
  UPDATE devotionals 
  SET progress = calculated_progress,
      current_day = LEAST(completed_days_count + 1, total_days_count)
  WHERE id = devotional_id;
  
  RETURN calculated_progress;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS)
ALTER TABLE devotionals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own devotionals
CREATE POLICY "Users can view own devotionals" ON devotionals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devotionals" ON devotionals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devotionals" ON devotionals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devotionals" ON devotionals
  FOR DELETE USING (auth.uid() = user_id);

-- Sample data structure for days JSONB field:
/*
[
  {
    "dayNumber": 1,
    "title": "Day 1: Foundation of Faith",
    "content": "Today we explore the foundation...",
    "reflection": "Reflect on your spiritual foundation...",
    "reflectionQuestions": [
      {
        "id": "q1",
        "text": "What does faith mean to you?",
        "userResponse": ""
      }
    ],
    "prayer": "Dear God, help me build a strong foundation...",
    "scripture": {
      "text": "For no one can lay any foundation other than the one already laid, which is Jesus Christ.",
      "reference": "1 Corinthians 3:11"
    },
    "completed": false,
    "completedAt": null
  }
]
*/

-- Function to create devotional from playbook
CREATE OR REPLACE FUNCTION create_devotional_from_playbook(
  p_user_id UUID,
  p_playbook_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT '',
  p_category TEXT DEFAULT 'Growth',
  p_duration INTEGER DEFAULT 7
)
RETURNS UUID AS $$
DECLARE
  new_devotional_id UUID;
  playbook_title_cache TEXT;
BEGIN
  -- Get playbook title for caching
  SELECT title INTO playbook_title_cache
  FROM playbooks 
  WHERE id = p_playbook_id;
  
  -- Create the devotional
  INSERT INTO devotionals (
    user_id,
    title,
    description,
    category,
    categories,
    playbook_id,
    playbook_title,
    total_days,
    days
  ) VALUES (
    p_user_id,
    p_title,
    p_description,
    p_category,
    ARRAY[p_category],
    p_playbook_id,
    playbook_title_cache,
    p_duration,
    -- Generate empty days structure
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'dayNumber', day_num,
          'title', 'Day ' || day_num,
          'content', '',
          'reflection', '',
          'reflectionQuestions', '[]'::jsonb,
          'prayer', '',
          'scripture', jsonb_build_object('text', '', 'reference', ''),
          'completed', false,
          'completedAt', null
        )
      )
      FROM generate_series(1, p_duration) AS day_num
    )
  )
  RETURNING id INTO new_devotional_id;
  
  RETURN new_devotional_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark devotional day as complete
CREATE OR REPLACE FUNCTION mark_devotional_day_complete(
  p_devotional_id UUID,
  p_day_number INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_days JSONB;
BEGIN
  -- Update the specific day in the days array
  UPDATE devotionals
  SET days = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'dayNumber')::INTEGER = p_day_number 
        THEN elem || jsonb_build_object('completed', true, 'completedAt', NOW())
        ELSE elem
      END
    )
    FROM jsonb_array_elements(days) AS elem
  )
  WHERE id = p_devotional_id
    AND auth.uid() = user_id;
  
  -- Recalculate progress
  PERFORM calculate_devotional_progress(p_devotional_id);
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View for devotional analytics
CREATE OR REPLACE VIEW devotional_analytics AS
SELECT 
  user_id,
  category,
  COUNT(*) as total_devotionals,
  COUNT(*) FILTER (WHERE completed = true) as completed_devotionals,
  AVG(progress) as avg_progress,
  AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
  COUNT(*) FILTER (WHERE playbook_id IS NOT NULL) as from_playbooks,
  MIN(created_at) as first_devotional,
  MAX(updated_at) as last_activity
FROM devotionals
GROUP BY user_id, category;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON devotionals TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_devotional_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_devotional_from_playbook(UUID, UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_devotional_day_complete(UUID, INTEGER) TO authenticated;
GRANT SELECT ON devotional_analytics TO authenticated;
