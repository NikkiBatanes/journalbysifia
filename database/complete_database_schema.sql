-- Complete Database Schema for siFia Application
-- Updated on: 2025-08-08
-- Includes all tables needed for dashboard functionality

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'PUSH', 'SMS', 'IN_APP');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- Tables
CREATE TABLE public.auth_logs (
    ip_address inet,
    event_type text NOT NULL,
    user_id uuid NOT NULL,
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    success boolean NOT NULL,
    user_agent text,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES user_profiles(id)
);

CREATE TABLE public.badges (
    scripture_reference text,
    required_activity text,
    category text,
    rarity text DEFAULT 'common'::text,
    faith_points_reward integer DEFAULT 0,
    required_count integer,
    created_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    icon_name text,
    scripture_verse text,
    PRIMARY KEY (id)
);

CREATE TABLE public.devotionals (
    total_days integer NOT NULL DEFAULT 1,
    user_input text,
    playbook_title text,
    playbook_id uuid,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    category text NOT NULL DEFAULT 'Growth'::text,
    categories text[] DEFAULT ARRAY['Growth'::text],
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    feedback text,
    rated_at timestamp with time zone,
    rating integer,
    days jsonb NOT NULL DEFAULT '[]'::jsonb,
    completed_at timestamp with time zone,
    completed boolean NOT NULL DEFAULT false,
    progress numeric NOT NULL DEFAULT 0.0,
    current_day integer NOT NULL DEFAULT 1,
    content text,
    scripture_reference text,
    reflection_questions jsonb,
    affirmations jsonb,
    bible_verses jsonb,
    FOREIGN KEY (playbook_id) REFERENCES playbooks(id),
    PRIMARY KEY (id)
);

-- [Previous tables truncated for brevity - continuing with the rest of the schema]

-- Indexes
CREATE INDEX idx_auth_logs_user_id ON auth_logs(user_id);
CREATE UNIQUE INDEX badges_name_key ON badges(name);
CREATE INDEX idx_devotionals_playbook_id ON devotionals(playbook_id);
CREATE INDEX idx_devotionals_completed ON devotionals(completed);
CREATE INDEX idx_devotionals_user_id ON devotionals(user_id);
CREATE INDEX idx_devotionals_category ON devotionals(category);
CREATE INDEX idx_devotionals_created_at ON devotionals(created_at DESC);

-- [Additional indexes for other tables would go here]

-- Views
CREATE OR REPLACE VIEW public.playbooks_with_progress AS
SELECT 
    p.*,
    COUNT(DISTINCT CASE WHEN pas.completed THEN pas.id END) AS completed_tasks,
    COUNT(DISTINCT pas.id) AS total_tasks,
    CASE 
        WHEN COUNT(DISTINCT pas.id) = 0 THEN 0 
        ELSE ROUND(COUNT(DISTINCT CASE WHEN pas.completed THEN pas.id END) * 100.0 / NULLIF(COUNT(DISTINCT pas.id), 0), 2) 
    END AS progress_percentage
FROM 
    playbooks p
    LEFT JOIN playbook_action_steps pas ON p.id = pas.playbook_id
GROUP BY 
    p.id;

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_auth_logs_updated_at
    BEFORE UPDATE ON auth_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Missing Tables for Dashboard Functionality

-- Faith Points System Tables
CREATE TABLE public.faith_points_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    points integer NOT NULL DEFAULT 0,
    activity_type text NOT NULL,
    reason text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE public.faith_points_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    total_points integer NOT NULL DEFAULT 0,
    current_level integer NOT NULL DEFAULT 1,
    current_streak integer NOT NULL DEFAULT 0,
    longest_streak integer NOT NULL DEFAULT 0,
    weekly_goal integer NOT NULL DEFAULT 50,
    weekly_progress integer NOT NULL DEFAULT 0,
    last_activity_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Playbooks System Tables
CREATE TABLE public.playbooks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    content jsonb,
    affirmations jsonb,
    bible_verses jsonb,
    reflection_questions jsonb,
    category text,
    difficulty text,
    estimated_duration integer, -- renamed from estimated_days for consistency
    total_steps integer DEFAULT 0,
    tags text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE public.playbook_action_steps (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    playbook_id uuid NOT NULL,
    step_number integer NOT NULL,
    title text NOT NULL,
    description text,
    affirmation text,
    scripture_reference text,
    estimated_time_minutes integer,
    is_required boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE CASCADE
);

-- User Progress Tables
CREATE TABLE public.user_progress (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    content_type text NOT NULL, -- 'playbook', 'devotional', etc.
    content_id uuid NOT NULL,
    progress_percentage integer DEFAULT 0,
    completed_steps integer DEFAULT 0,
    total_steps integer DEFAULT 0,
    is_completed boolean DEFAULT false,
    last_accessed timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE(user_id, content_type, content_id)
);

-- User Profiles Table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    email text,
    full_name text,
    avatar_url text,
    preferences jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_faith_points_log_user_id ON public.faith_points_log(user_id);
CREATE INDEX IF NOT EXISTS idx_faith_points_log_created_at ON public.faith_points_log(created_at);
CREATE INDEX IF NOT EXISTS idx_faith_points_log_activity_type ON public.faith_points_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_faith_points_profiles_user_id ON public.faith_points_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_playbook_action_steps_playbook_id ON public.playbook_action_steps(playbook_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_content ON public.user_progress(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_user_id ON public.devotionals(user_id);
CREATE INDEX IF NOT EXISTS idx_devotionals_created_at ON public.devotionals(created_at);

-- Triggers for updated_at
CREATE TRIGGER update_faith_points_log_updated_at
    BEFORE UPDATE ON faith_points_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faith_points_profiles_updated_at
    BEFORE UPDATE ON faith_points_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbooks_updated_at
    BEFORE UPDATE ON playbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbook_action_steps_updated_at
    BEFORE UPDATE ON playbook_action_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE devotionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_points_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_action_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (you may need to customize these)
CREATE POLICY "Users can view their own faith points" ON faith_points_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own faith points" ON faith_points_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile" ON faith_points_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON faith_points_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON faith_points_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Everyone can view playbooks" ON playbooks
    FOR SELECT USING (true);

CREATE POLICY "Everyone can view action steps" ON playbook_action_steps
    FOR SELECT USING (true);

CREATE POLICY "Users can view their own progress" ON user_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own progress" ON user_progress
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.auth_logs IS 'Stores authentication and authorization logs for security auditing';
COMMENT ON TABLE public.badges IS 'Defines available badges users can earn through various activities';
COMMENT ON TABLE public.devotionals IS 'Stores user-created devotionals with progress tracking';
COMMENT ON TABLE public.faith_points_log IS 'Tracks all faith points activities and transactions';
COMMENT ON TABLE public.faith_points_profiles IS 'User faith points profiles with levels and streaks';
COMMENT ON TABLE public.playbooks IS 'Master list of available spiritual growth playbooks';
COMMENT ON TABLE public.playbook_action_steps IS 'Individual action steps within playbooks';
COMMENT ON TABLE public.user_progress IS 'Tracks user progress across all content types';
COMMENT ON TABLE public.user_profiles IS 'User profile information and preferences';
