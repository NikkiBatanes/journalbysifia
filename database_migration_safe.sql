-- SAFE DATABASE MIGRATION FOR EXISTING siFia SCHEMA
-- Only adds new tables and optimizations without conflicts
-- =====================================================

-- Enable required extensions for performance
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- NEW TABLES ONLY (avoid conflicts with existing)
-- =====================================================

-- User contexts table (NEW - for intelligence system)
CREATE TABLE IF NOT EXISTS user_contexts (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  context_data JSONB NOT NULL,
  confidence_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- (Partitioning removed for user_contexts, only one context per user is stored)


-- Faith points profiles (NEW - enhanced version)
CREATE TABLE IF NOT EXISTS faith_points_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  points_to_next_level INTEGER DEFAULT 100,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  weekly_goal INTEGER DEFAULT 50,
  weekly_progress INTEGER DEFAULT 0,
  last_activity_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Faith points transactions (NEW - partitioned for performance)
CREATE TABLE IF NOT EXISTS faith_points_transactions (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  category TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for transactions
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
BEGIN
  FOR i IN 0..6 LOOP
    start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
    end_date := start_date + INTERVAL '1 month';
    table_name := 'faith_points_transactions_' || TO_CHAR(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF faith_points_transactions 
                    FOR VALUES FROM (%L) TO (%L)', 
                   table_name, start_date, end_date);
  END LOOP;
END $$;

-- User achievements (NEW - enhanced gamification)
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  points_reward INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Enhanced generation queue (NEW - for 100K+ users)
CREATE TABLE IF NOT EXISTS generation_queue (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('playbook', 'devotional', 'journal_expansion')),
  priority INTEGER NOT NULL DEFAULT 5, -- 1=highest, 5=lowest
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Request data
  user_input TEXT NOT NULL,
  user_name TEXT NOT NULL,
  context_data JSONB DEFAULT '{}',
  
  -- Processing data
  worker_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_data JSONB,
  error_message TEXT,
  
  -- Metadata
  estimated_tokens INTEGER,
  actual_tokens INTEGER,
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, created_at)
) PARTITION BY RANGE (created_at);

-- Create daily partitions for queue
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
BEGIN
  FOR i IN 0..30 LOOP
    start_date := CURRENT_DATE + i;
    end_date := start_date + INTERVAL '1 day';
    table_name := 'generation_queue_' || TO_CHAR(start_date, 'YYYY_MM_DD');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF generation_queue 
                    FOR VALUES FROM (%L) TO (%L)', 
                   table_name, start_date, end_date);
  END LOOP;
END $$;

-- User behavior events (NEW - for intelligence)
CREATE TABLE IF NOT EXISTS user_behavior_events (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, created_at)
) PARTITION BY RANGE (created_at);

-- Create weekly partitions for behavior events
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
BEGIN
  FOR i IN 0..12 LOOP -- 12 weeks
    start_date := DATE_TRUNC('week', CURRENT_DATE + (i || ' weeks')::INTERVAL);
    end_date := start_date + INTERVAL '1 week';
    table_name := 'user_behavior_events_' || TO_CHAR(start_date, 'YYYY_WW');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF user_behavior_events 
                    FOR VALUES FROM (%L) TO (%L)', 
                    table_name, start_date, end_date);
  END LOOP;
END $$;

-- Enhanced generated content (NEW - optimized storage)
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('playbook', 'devotional')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_input TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Performance metrics
  generation_time_ms INTEGER,
  tokens_used INTEGER,
  cost_cents INTEGER,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for generated content
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
BEGIN
  FOR i IN 0..12 LOOP -- 12 months
    start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
    end_date := start_date + INTERVAL '1 month';
    table_name := 'generated_content_' || TO_CHAR(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF generated_content 
                    FOR VALUES FROM (%L) TO (%L)', 
                   table_name, start_date, end_date);
  END LOOP;
END $$;

-- =====================================================
-- PERFORMANCE INDEXES (NEW TABLES ONLY)
-- =====================================================

-- User contexts indexes
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_contexts_confidence ON user_contexts(confidence_score);

-- Faith points indexes
CREATE INDEX IF NOT EXISTS idx_faith_points_profiles_user_id ON faith_points_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_faith_points_profiles_level ON faith_points_profiles(current_level);
CREATE INDEX IF NOT EXISTS idx_faith_points_profiles_points ON faith_points_profiles(total_points);

-- Transaction indexes (on partition template)
CREATE INDEX IF NOT EXISTS idx_faith_points_transactions_user_id ON faith_points_transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_faith_points_transactions_category ON faith_points_transactions(category, created_at);

-- Queue indexes (on partition template)
CREATE INDEX IF NOT EXISTS idx_generation_queue_priority ON generation_queue(priority, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_generation_queue_worker ON generation_queue(worker_id) WHERE status = 'processing';

-- Behavior events indexes (on partition template)
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_user_id ON user_behavior_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_type ON user_behavior_events(event_type, created_at);

-- Generated content indexes (on partition template)
CREATE INDEX IF NOT EXISTS idx_generated_content_user_id ON generated_content(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_content_type ON generated_content(content_type, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_content_status ON generated_content(status, created_at);

-- Achievement indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_completed ON user_achievements(completed, completed_at);

-- =====================================================
-- OPTIMIZE EXISTING TABLES (SAFE ADDITIONS)
-- =====================================================

-- Add indexes to existing tables (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier_status ON subscriptions(tier, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_ends_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_period ON usage_tracking(user_id, last_reset_date);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(last_reset_date);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id_earned ON user_badges(user_id, earned_at);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

CREATE INDEX IF NOT EXISTS idx_content_library_user_type ON content_library(user_id, content_type, created_at);
CREATE INDEX IF NOT EXISTS idx_content_library_shared ON content_library(is_shared) WHERE is_shared = true;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_points_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

-- User contexts policies
CREATE POLICY "Users can view own context" ON user_contexts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own context" ON user_contexts
  FOR ALL USING (auth.uid() = user_id);

-- Faith points policies
CREATE POLICY "Users can view own faith points" ON faith_points_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own transactions" ON faith_points_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Achievements policies
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Queue policies
CREATE POLICY "Users can view own queue items" ON generation_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Behavior events policies
CREATE POLICY "Users can view own events" ON user_behavior_events
  FOR SELECT USING (auth.uid() = user_id);

-- Generated content policies
CREATE POLICY "Users can view own content" ON generated_content
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- AUTOMATED MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to create future partitions automatically
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
  tables TEXT[] := ARRAY['faith_points_transactions', 'user_contexts', 'generated_content'];
  table_name_base TEXT;
BEGIN
  FOREACH table_name_base IN ARRAY tables
  LOOP
    FOR i IN 1..3 LOOP -- Create 3 months ahead
      start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
      end_date := start_date + INTERVAL '1 month';
      table_name := table_name_base || '_' || TO_CHAR(start_date, 'YYYY_MM');
      
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
                      FOR VALUES FROM (%L) TO (%L)', 
                     table_name, table_name_base, start_date, end_date);
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions()
RETURNS void AS $$
DECLARE
  table_name TEXT;
  cutoff_date DATE := CURRENT_DATE - INTERVAL '6 months';
BEGIN
  -- Clean up old monthly partitions
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE tablename ~ '^(faith_points_transactions|user_contexts|generated_content)_[0-9]{4}_[0-9]{2}$'
    AND tablename < 'faith_points_transactions_' || TO_CHAR(cutoff_date, 'YYYY_MM')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', table_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MONITORING VIEWS
-- =====================================================

-- Queue performance monitoring
CREATE OR REPLACE VIEW queue_performance AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  status,
  COUNT(*) as item_count,
  AVG(processing_time_ms) as avg_processing_time,
  MAX(processing_time_ms) as max_processing_time,
  AVG(actual_tokens) as avg_tokens
FROM generation_queue 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), status
ORDER BY hour DESC;

-- User engagement monitoring
CREATE OR REPLACE VIEW user_engagement_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE event_type = 'playbook_generated') as playbooks_generated,
  COUNT(*) FILTER (WHERE event_type = 'devotional_generated') as devotionals_generated
FROM user_behavior_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- Faith points leaderboard
CREATE OR REPLACE VIEW faith_points_leaderboard AS
SELECT 
  fp.user_id,
  up.first_name,
  up.last_name,
  fp.total_points,
  fp.current_level,
  fp.current_streak,
  fp.longest_streak,
  RANK() OVER (ORDER BY fp.total_points DESC) as rank
FROM faith_points_profiles fp
JOIN user_profiles up ON fp.user_id = up.id
ORDER BY fp.total_points DESC
LIMIT 100;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 database migration completed successfully!';
  RAISE NOTICE 'New tables created: user_contexts, faith_points_profiles, faith_points_transactions, user_achievements, generation_queue, user_behavior_events, generated_content';
  RAISE NOTICE 'Partitions created for performance optimization';
  RAISE NOTICE 'Indexes added for 100K+ user scalability';
  RAISE NOTICE 'Row Level Security enabled for data protection';
END $$;
