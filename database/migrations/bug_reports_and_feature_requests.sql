-- Migration: Bug Reports and Feature Requests Tables
-- Description: Creates tables for user bug reports and feature requests
-- Created: 2025-11-17

-- =====================================================
-- Bug Reports Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  platform TEXT NOT NULL,
  os_version TEXT NOT NULL,
  screen TEXT NOT NULL,
  app_version TEXT,
  extra JSONB,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'fixed', 'wont_fix', 'duplicate')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_platform ON public.bug_reports(platform);

-- Enable Row Level Security
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bug_reports
-- Users can insert their own bug reports
CREATE POLICY "Users can insert their own bug reports"
  ON public.bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own bug reports
CREATE POLICY "Users can view their own bug reports"
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for admin purposes)
CREATE POLICY "Service role has full access to bug reports"
  ON public.bug_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Feature Requests Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL,
  platform TEXT NOT NULL,
  os_version TEXT NOT NULL,
  screen TEXT NOT NULL,
  app_version TEXT,
  extra JSONB,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feature_requests_user_id ON public.feature_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON public.feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_category ON public.feature_requests(category);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON public.feature_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_votes ON public.feature_requests(votes DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_platform ON public.feature_requests(platform);

-- Enable Row Level Security
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_requests
-- Users can insert their own feature requests
CREATE POLICY "Users can insert their own feature requests"
  ON public.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own feature requests
CREATE POLICY "Users can view their own feature requests"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for admin purposes)
CREATE POLICY "Service role has full access to feature requests"
  ON public.feature_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Triggers for updated_at timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_requests_updated_at
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE public.bug_reports IS 'Stores user-submitted bug reports from the mobile app';
COMMENT ON TABLE public.feature_requests IS 'Stores user-submitted feature requests and suggestions';
COMMENT ON COLUMN public.bug_reports.status IS 'Current status of the bug report';
COMMENT ON COLUMN public.feature_requests.status IS 'Current status of the feature request';
COMMENT ON COLUMN public.feature_requests.votes IS 'Number of votes/upvotes for this feature request';
