-- =============================================
-- SIFIA ONBOARDING SYSTEM DATABASE SCHEMA
-- Modern Enterprise-Grade Onboarding with Faith Journey Tracking
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUMS AND TYPES
-- =============================================

CREATE TYPE onboarding_step_status AS ENUM (
  'not_started',
  'in_progress', 
  'completed',
  'skipped',
  'abandoned'
);

CREATE TYPE spiritual_maturity_level AS ENUM (
  'new_believer',
  'growing',
  'mature',
  'leader',
  'unsure'
);

CREATE TYPE church_attendance_frequency AS ENUM (
  'never',
  'rarely',
  'monthly', 
  'weekly',
  'multiple_weekly'
);

CREATE TYPE bible_reading_frequency AS ENUM (
  'never',
  'rarely',
  'weekly',
  'daily',
  'multiple_daily'
);

CREATE TYPE prayer_frequency AS ENUM (
  'never',
  'rarely',
  'weekly',
  'daily',
  'multiple_daily'
);

CREATE TYPE acceptance_context AS ENUM (
  'childhood',
  'teenager',
  'adult',
  'recent',
  'unsure',
  'not_yet'
);

CREATE TYPE baptism_status AS ENUM (
  'yes',
  'no',
  'planning',
  'not_applicable'
);

CREATE TYPE personality_type AS ENUM (
  'contemplative',
  'active',
  'social',
  'studious'
);

CREATE TYPE learning_style AS ENUM (
  'visual',
  'auditory',
  'kinesthetic',
  'reading'
);

CREATE TYPE content_length_preference AS ENUM (
  'short',
  'medium',
  'long'
);

-- =============================================
-- ONBOARDING PROGRESS TRACKING
-- =============================================

CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Progress tracking
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 6,
  completed_steps TEXT[] DEFAULT '{}',
  skipped_steps TEXT[] DEFAULT '{}',
  
  -- Timing data
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Completion metrics
  completion_rate FLOAT DEFAULT 0.0, -- 0.0 to 1.0
  time_spent_seconds INTEGER DEFAULT 0,
  
  -- Session data
  session_id UUID DEFAULT gen_random_uuid(),
  device_info JSONB DEFAULT '{}',
  
  -- Status
  is_completed BOOLEAN DEFAULT FALSE,
  is_abandoned BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =============================================
-- FAITH JOURNEY PROFILE
-- =============================================

CREATE TABLE faith_journey_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core faith data
  has_accepted_christ BOOLEAN,
  acceptance_date DATE,
  acceptance_context acceptance_context,
  
  -- Spiritual maturity
  spiritual_maturity spiritual_maturity_level DEFAULT 'unsure',
  years_as_believer INTEGER,
  
  -- Church background
  church_attendance church_attendance_frequency DEFAULT 'never',
  current_church_name TEXT,
  church_denomination TEXT,
  baptism_status baptism_status DEFAULT 'not_applicable',
  baptism_date DATE,
  
  -- Spiritual practices
  bible_reading_frequency bible_reading_frequency DEFAULT 'never',
  prayer_frequency prayer_frequency DEFAULT 'never',
  preferred_bible_version TEXT DEFAULT 'NIV',
  
  -- Growth areas
  areas_of_growth TEXT[] DEFAULT '{}',
  life_challenges TEXT[] DEFAULT '{}',
  spiritual_gifts TEXT[] DEFAULT '{}',
  ministry_interests TEXT[] DEFAULT '{}',
  
  -- Personal context
  current_doubts TEXT[] DEFAULT '{}',
  growth_desires TEXT[] DEFAULT '{}',
  spiritual_influences TEXT[] DEFAULT '{}',
  
  -- Pastoral care
  needs_pastoral_care BOOLEAN DEFAULT FALSE,
  church_connection_requested BOOLEAN DEFAULT FALSE,
  prayer_request_text TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =============================================
-- PERSONALIZATION PROFILES
-- =============================================

CREATE TABLE onboarding_personalization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personality assessment
  personality_type personality_type,
  learning_style learning_style,
  
  -- Content preferences
  preferred_content_length content_length_preference DEFAULT 'medium',
  preferred_topics TEXT[] DEFAULT '{}',
  avoided_topics TEXT[] DEFAULT '{}',
  
  -- Engagement preferences
  optimal_notification_times TIME[] DEFAULT '{}',
  preferred_study_days TEXT[] DEFAULT '{}', -- monday, tuesday, etc.
  daily_commitment_minutes INTEGER DEFAULT 15,
  
  -- Communication style
  prefers_gentle_encouragement BOOLEAN DEFAULT TRUE,
  prefers_direct_challenges BOOLEAN DEFAULT FALSE,
  likes_community_features BOOLEAN DEFAULT TRUE,
  
  -- Technical preferences
  prefers_audio_content BOOLEAN DEFAULT FALSE,
  prefers_video_content BOOLEAN DEFAULT FALSE,
  accessibility_needs TEXT[] DEFAULT '{}',
  
  -- Intelligence data
  engagement_patterns JSONB DEFAULT '{}',
  personalization_score FLOAT DEFAULT 0.0, -- 0.0 to 1.0
  confidence_level FLOAT DEFAULT 0.0, -- How confident we are in this profile
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =============================================
-- ONBOARDING ANALYTICS
-- =============================================

CREATE TABLE onboarding_step_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Step identification
  step_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  
  -- Interaction data
  time_spent_seconds INTEGER DEFAULT 0,
  interactions_count INTEGER DEFAULT 0,
  scroll_depth_percentage FLOAT DEFAULT 0.0,
  
  -- Completion data
  completion_method onboarding_step_status NOT NULL,
  completion_timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Input data (anonymized)
  input_field_count INTEGER DEFAULT 0,
  validation_errors_count INTEGER DEFAULT 0,
  help_requests_count INTEGER DEFAULT 0,
  
  -- Technical data
  device_info JSONB DEFAULT '{}',
  network_quality TEXT, -- 'poor', 'good', 'excellent'
  load_time_ms INTEGER,
  
  -- A/B testing
  variant_id TEXT,
  experiment_id TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CHRIST ACCEPTANCE TRACKING
-- =============================================

CREATE TABLE christ_acceptance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event details
  acceptance_declared_at TIMESTAMPTZ DEFAULT NOW(),
  acceptance_context acceptance_context NOT NULL,
  
  -- Circumstances
  influenced_by TEXT, -- 'app_content', 'friend', 'family', 'church', 'personal_study'
  specific_content_id UUID, -- Reference to playbook/devotional that influenced
  prayer_text TEXT, -- Their prayer of acceptance if provided
  
  -- Follow-up data
  baptism_interest BOOLEAN DEFAULT FALSE,
  church_connection_interest BOOLEAN DEFAULT FALSE,
  discipleship_interest BOOLEAN DEFAULT FALSE,
  
  -- Pastoral care
  needs_follow_up BOOLEAN DEFAULT TRUE,
  follow_up_completed BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMPTZ,
  
  -- Verification (for genuine vs. casual responses)
  confidence_score FLOAT DEFAULT 1.0, -- Algorithm confidence in genuine acceptance
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ONBOARDING CONTENT EFFECTIVENESS
-- =============================================

CREATE TABLE onboarding_content_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content identification
  step_name TEXT NOT NULL,
  content_variant TEXT NOT NULL,
  
  -- Effectiveness metrics
  completion_rate FLOAT DEFAULT 0.0,
  average_time_spent INTEGER DEFAULT 0,
  skip_rate FLOAT DEFAULT 0.0,
  abandonment_rate FLOAT DEFAULT 0.0,
  
  -- User satisfaction
  average_rating FLOAT DEFAULT 0.0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  
  -- Conversion metrics
  christ_acceptance_rate FLOAT DEFAULT 0.0,
  trial_conversion_rate FLOAT DEFAULT 0.0,
  retention_rate_7_day FLOAT DEFAULT 0.0,
  retention_rate_30_day FLOAT DEFAULT 0.0,
  
  -- Sample size
  total_users_exposed INTEGER DEFAULT 0,
  measurement_period_start TIMESTAMPTZ DEFAULT NOW(),
  measurement_period_end TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(step_name, content_variant)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Onboarding progress indexes
CREATE INDEX idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX idx_onboarding_progress_status ON onboarding_progress(is_completed, is_abandoned);
CREATE INDEX idx_onboarding_progress_session ON onboarding_progress(session_id);
CREATE INDEX idx_onboarding_progress_activity ON onboarding_progress(last_activity_at DESC);

-- Faith journey indexes
CREATE INDEX idx_faith_journey_user_id ON faith_journey_profiles(user_id);
CREATE INDEX idx_faith_journey_acceptance ON faith_journey_profiles(has_accepted_christ);
CREATE INDEX idx_faith_journey_maturity ON faith_journey_profiles(spiritual_maturity);
CREATE INDEX idx_faith_journey_care ON faith_journey_profiles(needs_pastoral_care);

-- Personalization indexes
CREATE INDEX idx_personalization_user_id ON onboarding_personalization_profiles(user_id);
CREATE INDEX idx_personalization_type ON onboarding_personalization_profiles(personality_type);
CREATE INDEX idx_personalization_style ON onboarding_personalization_profiles(learning_style);

-- Analytics indexes
CREATE INDEX idx_step_analytics_user_id ON onboarding_step_analytics(user_id);
CREATE INDEX idx_step_analytics_session ON onboarding_step_analytics(session_id);
CREATE INDEX idx_step_analytics_step ON onboarding_step_analytics(step_name, step_number);
CREATE INDEX idx_step_analytics_completion ON onboarding_step_analytics(completion_method);
CREATE INDEX idx_step_analytics_created ON onboarding_step_analytics(created_at DESC);

-- Christ acceptance indexes
CREATE INDEX idx_christ_acceptance_user_id ON christ_acceptance_events(user_id);
CREATE INDEX idx_christ_acceptance_context ON christ_acceptance_events(acceptance_context);
CREATE INDEX idx_christ_acceptance_follow_up ON christ_acceptance_events(needs_follow_up, follow_up_completed);
CREATE INDEX idx_christ_acceptance_created ON christ_acceptance_events(created_at DESC);

-- Content effectiveness indexes
CREATE INDEX idx_content_effectiveness_step ON onboarding_content_effectiveness(step_name);
CREATE INDEX idx_content_effectiveness_variant ON onboarding_content_effectiveness(content_variant);
CREATE INDEX idx_content_effectiveness_completion ON onboarding_content_effectiveness(completion_rate DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_journey_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_personalization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_step_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE christ_acceptance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_content_effectiveness ENABLE ROW LEVEL SECURITY;

-- Onboarding progress policies
CREATE POLICY "Users can view own onboarding progress" ON onboarding_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding progress" ON onboarding_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding progress" ON onboarding_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Faith journey policies
CREATE POLICY "Users can view own faith journey" ON faith_journey_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own faith journey" ON faith_journey_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own faith journey" ON faith_journey_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Personalization policies
CREATE POLICY "Users can view own personalization profile" ON onboarding_personalization_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own personalization profile" ON onboarding_personalization_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personalization profile" ON onboarding_personalization_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Analytics policies (users can insert their own analytics)
CREATE POLICY "Users can insert own analytics" ON onboarding_step_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Christ acceptance policies
CREATE POLICY "Users can view own acceptance events" ON christ_acceptance_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own acceptance events" ON christ_acceptance_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Content effectiveness is admin-only (no user policies needed)

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to initialize onboarding for new user
CREATE OR REPLACE FUNCTION initialize_onboarding(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_progress_id UUID;
BEGIN
  -- Create onboarding progress record
  INSERT INTO onboarding_progress (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_progress_id;
  
  -- Create empty faith journey profile
  INSERT INTO faith_journey_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create empty personalization profile
  INSERT INTO onboarding_personalization_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_progress_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update onboarding progress
CREATE OR REPLACE FUNCTION update_onboarding_progress(
  p_user_id UUID,
  p_step_name TEXT,
  p_step_number INTEGER,
  p_completion_method onboarding_step_status,
  p_time_spent INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  -- Update progress record
  UPDATE onboarding_progress 
  SET 
    current_step = GREATEST(current_step, p_step_number + 1),
    completed_steps = CASE 
      WHEN p_completion_method = 'completed' THEN 
        array_append(completed_steps, p_step_name)
      ELSE completed_steps 
    END,
    skipped_steps = CASE 
      WHEN p_completion_method = 'skipped' THEN 
        array_append(skipped_steps, p_step_name)
      ELSE skipped_steps 
    END,
    completion_rate = (array_length(completed_steps, 1) + 
      CASE WHEN p_completion_method = 'completed' THEN 1 ELSE 0 END
    )::FLOAT / total_steps,
    time_spent_seconds = time_spent_seconds + p_time_spent,
    last_activity_at = NOW(),
    is_completed = CASE 
      WHEN (array_length(completed_steps, 1) + 
        CASE WHEN p_completion_method = 'completed' THEN 1 ELSE 0 END
      ) >= total_steps THEN TRUE 
      ELSE FALSE 
    END,
    completed_at = CASE 
      WHEN (array_length(completed_steps, 1) + 
        CASE WHEN p_completion_method = 'completed' THEN 1 ELSE 0 END
      ) >= total_steps THEN NOW() 
      ELSE completed_at 
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record Christ acceptance
CREATE OR REPLACE FUNCTION record_christ_acceptance(
  p_user_id UUID,
  p_acceptance_context acceptance_context,
  p_influenced_by TEXT DEFAULT NULL,
  p_content_id UUID DEFAULT NULL,
  p_prayer_text TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Record the acceptance event
  INSERT INTO christ_acceptance_events (
    user_id,
    acceptance_context,
    influenced_by,
    specific_content_id,
    prayer_text
  ) VALUES (
    p_user_id,
    p_acceptance_context,
    p_influenced_by,
    p_content_id,
    p_prayer_text
  ) RETURNING id INTO v_event_id;
  
  -- Update faith journey profile
  UPDATE faith_journey_profiles 
  SET 
    has_accepted_christ = TRUE,
    acceptance_date = CURRENT_DATE,
    acceptance_context = p_acceptance_context,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate onboarding completion rates
CREATE OR REPLACE FUNCTION calculate_onboarding_metrics()
RETURNS TABLE(
  step_name TEXT,
  completion_rate NUMERIC,
  average_time_spent INTEGER,
  skip_rate NUMERIC,
  total_users INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.step_name,
    AVG(CASE WHEN sa.completion_method = 'completed' THEN 1.0 ELSE 0.0 END) as completion_rate,
    AVG(sa.time_spent_seconds)::INTEGER as average_time_spent,
    AVG(CASE WHEN sa.completion_method = 'skipped' THEN 1.0 ELSE 0.0 END) as skip_rate,
    COUNT(DISTINCT sa.user_id)::INTEGER as total_users
  FROM onboarding_step_analytics sa
  WHERE sa.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY sa.step_name
  ORDER BY sa.step_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION initialize_onboarding(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_onboarding_progress(UUID, TEXT, INTEGER, onboarding_step_status, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_christ_acceptance(UUID, acceptance_context, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_onboarding_metrics() TO authenticated;

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE onboarding_progress IS 'Tracks user progress through the onboarding flow';
COMMENT ON TABLE faith_journey_profiles IS 'Stores detailed faith journey and spiritual maturity data';
COMMENT ON TABLE onboarding_personalization_profiles IS 'User preferences and personality data for personalization';
COMMENT ON TABLE onboarding_step_analytics IS 'Detailed analytics for each onboarding step interaction';
COMMENT ON TABLE christ_acceptance_events IS 'Records when users accept Christ through the app';
COMMENT ON TABLE onboarding_content_effectiveness IS 'A/B testing and content performance metrics';

-- Schema version for migrations
-- INSERT INTO schema_version (version, description) VALUES 
-- (2, 'Onboarding system with faith journey tracking and personalization');
-- NOTE: The schema_version table does not exist. If you want to track migrations, create this table first or use a migration tool like Supabase Migrations.

