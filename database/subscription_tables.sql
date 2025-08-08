-- Subscription System Tables
-- Run this in your Supabase SQL Editor to fix the 0/0 subscription display

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'trialing',
    tier text NOT NULL DEFAULT 'free_trial',
    price_id text,
    start_date timestamp with time zone DEFAULT now(),
    end_date timestamp with time zone,
    trial_end_date timestamp with time zone DEFAULT (now() + interval '7 days'),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Usage Tracking Table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    subscription_id uuid,
    playbooks_generated integer NOT NULL DEFAULT 0,
    devotionals_generated integer NOT NULL DEFAULT 0,
    journal_entries integer NOT NULL DEFAULT 0,
    smart_journal_entries integer NOT NULL DEFAULT 0,
    openai_tokens_used integer NOT NULL DEFAULT 0,
    api_calls_made integer NOT NULL DEFAULT 0,
    intelligence_queries integer NOT NULL DEFAULT 0,
    template_uses jsonb DEFAULT '{}',
    export_count integer NOT NULL DEFAULT 0,
    last_reset_date date DEFAULT CURRENT_DATE,
    reset_period text DEFAULT 'monthly',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON public.usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_reset_date ON public.usage_tracking(last_reset_date);

-- Row Level Security (RLS)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for usage_tracking
CREATE POLICY "Users can view their own usage" ON usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" ON usage_tracking
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" ON usage_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.usage_tracking TO authenticated;

-- Comments
COMMENT ON TABLE public.user_subscriptions IS 'User subscription plans and status';
COMMENT ON TABLE public.usage_tracking IS 'Monthly usage tracking for subscription limits';
