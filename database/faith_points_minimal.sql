-- Minimal Faith Points Tables
-- Run this in your Supabase SQL Editor

-- Faith Points Log Table
CREATE TABLE IF NOT EXISTS public.faith_points_log (
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

-- Faith Points Profiles Table
CREATE TABLE IF NOT EXISTS public.faith_points_profiles (
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_faith_points_log_user_id ON public.faith_points_log(user_id);
CREATE INDEX IF NOT EXISTS idx_faith_points_log_created_at ON public.faith_points_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faith_points_profiles_user_id ON public.faith_points_profiles(user_id);

-- Row Level Security (RLS)
ALTER TABLE faith_points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE faith_points_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own faith points log" ON faith_points_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own faith points log" ON faith_points_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile" ON faith_points_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON faith_points_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON faith_points_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.faith_points_log TO authenticated;
GRANT ALL ON public.faith_points_profiles TO authenticated;

-- Comments
COMMENT ON TABLE public.faith_points_log IS 'Log of all faith points transactions';
COMMENT ON TABLE public.faith_points_profiles IS 'User faith points profiles with levels and streaks';
