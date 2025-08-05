-- =====================================================
-- DATABASE OPTIMIZATION FOR 100K+ CONCURRENT USERS
-- Partitioning, indexing, and performance optimization
-- =====================================================

-- Enable required extensions for performance
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- USER CONTEXTS TABLE (for intelligence system)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  context_data JSONB NOT NULL,
  confidence_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for user contexts
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_confidence ON user_contexts(confidence_score);
CREATE INDEX IF NOT EXISTS idx_user_contexts_updated ON user_contexts(updated_at);

-- =====================================================
-- FAITH POINTS SYSTEM TABLES
-- =====================================================

-- Faith points profiles
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

-- Faith points transactions (partitioned by month for performance)
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

-- Create monthly partitions for transactions (current + next 6 months)
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

-- User badges
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  badge_data JSONB NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- User achievements
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

-- =====================================================
-- ENHANCED GENERATION QUEUE (optimized for scale)
-- =====================================================

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

-- Create daily partitions for queue (current + next 30 days)
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

-- =====================================================
-- USER BEHAVIOR EVENTS (for intelligence)
-- =====================================================

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

-- =====================================================
-- GENERATED CONTENT (optimized storage)
-- =====================================================

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
-- PERFORMANCE INDEXES
-- =====================================================

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

-- Badge and achievement indexes
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_completed ON user_achievements(completed, completed_at);

-- =====================================================
-- SUBSCRIPTION SYSTEM INDEXES (optimize existing)
-- =====================================================

-- Optimize existing subscription tables
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id_status ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier_status ON user_subscriptions(tier, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end ON user_subscriptions(trial_end_date) WHERE status = 'trialing';

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_period ON usage_tracking(user_id, period);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_points_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

-- User contexts policies
CREATE POLICY "Users can view own context" ON user_contexts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own context" ON user_contexts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own context" ON user_contexts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Faith points policies
CREATE POLICY "Users can view own faith points" ON faith_points_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own faith points" ON faith_points_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own faith points" ON faith_points_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON faith_points_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert transactions" ON faith_points_transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own badges" ON user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can award badges" ON user_badges FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can update achievements" ON user_achievements FOR ALL WITH CHECK (true);

-- Queue policies
CREATE POLICY "Users can view own queue items" ON generation_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own queue items" ON generation_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service can update queue items" ON generation_queue FOR UPDATE USING (true);

-- Behavior events policies
CREATE POLICY "Users can view own events" ON user_behavior_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert events" ON user_behavior_events FOR INSERT WITH CHECK (true);

-- Generated content policies
CREATE POLICY "Users can view own content" ON generated_content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own content" ON generated_content FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert content" ON generated_content FOR INSERT WITH CHECK (true);

-- =====================================================
-- AUTOMATED MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions()
RETURNS void AS $$
DECLARE
  partition_name TEXT;
BEGIN
  -- Clean up transaction partitions older than 6 months
  FOR partition_name IN 
    SELECT schemaname||'.'||tablename 
    FROM pg_tables 
    WHERE tablename LIKE 'faith_points_transactions_%' 
    AND tablename < 'faith_points_transactions_' || TO_CHAR(CURRENT_DATE - INTERVAL '6 months', 'YYYY_MM')
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
  END LOOP;
  
  -- Clean up queue partitions older than 7 days
  FOR partition_name IN 
    SELECT schemaname||'.'||tablename 
    FROM pg_tables 
    WHERE tablename LIKE 'generation_queue_%' 
    AND tablename < 'generation_queue_' || TO_CHAR(CURRENT_DATE - INTERVAL '7 days', 'YYYY_MM_DD')
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
  END LOOP;
  
  -- Clean up behavior events older than 3 months
  FOR partition_name IN 
    SELECT schemaname||'.'||tablename 
    FROM pg_tables 
    WHERE tablename LIKE 'user_behavior_events_%' 
    AND tablename < 'user_behavior_events_' || TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYY_WW')
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create future partitions
CREATE OR REPLACE FUNCTION create_future_partitions()
RETURNS void AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
BEGIN
  -- Create next month's transaction partition
  start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '7 months');
  end_date := start_date + INTERVAL '1 month';
  table_name := 'faith_points_transactions_' || TO_CHAR(start_date, 'YYYY_MM');
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF faith_points_transactions 
                  FOR VALUES FROM (%L) TO (%L)', 
                 table_name, start_date, end_date);
  
  -- Create next week's queue partitions
  FOR i IN 31..37 LOOP
    start_date := CURRENT_DATE + i;
    end_date := start_date + INTERVAL '1 day';
    table_name := 'generation_queue_' || TO_CHAR(start_date, 'YYYY_MM_DD');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF generation_queue 
                    FOR VALUES FROM (%L) TO (%L)', 
                   table_name, start_date, end_date);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance (if pg_cron is available)
DO $$
BEGIN
  -- Clean up old partitions daily at 2 AM
  PERFORM cron.schedule('cleanup-partitions', '0 2 * * *', 'SELECT cleanup_old_partitions()');
  
  -- Create future partitions daily at 3 AM
  PERFORM cron.schedule('create-partitions', '0 3 * * *', 'SELECT create_future_partitions()');
EXCEPTION
  WHEN OTHERS THEN
    -- pg_cron not available, skip scheduling
    NULL;
END $$;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- View for queue performance monitoring
CREATE OR REPLACE VIEW queue_performance AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  type,
  priority,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(processing_time_ms) as avg_processing_time,
  AVG(actual_tokens) as avg_tokens
FROM generation_queue 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), type, priority
ORDER BY hour DESC;

-- View for user engagement metrics
CREATE OR REPLACE VIEW user_engagement_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE event_type = 'playbook_generated') as playbooks_generated,
  COUNT(*) FILTER (WHERE event_type = 'devotional_generated') as devotionals_generated,
  COUNT(*) FILTER (WHERE event_type = 'journal_entry') as journal_entries
FROM user_behavior_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- View for faith points leaderboard
CREATE OR REPLACE VIEW faith_points_leaderboard AS
SELECT 
  user_id,
  total_points,
  current_level,
  current_streak,
  ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
FROM faith_points_profiles
ORDER BY total_points DESC
LIMIT 100;
