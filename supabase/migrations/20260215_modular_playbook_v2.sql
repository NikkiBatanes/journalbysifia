-- ============================================
-- MODULAR PLAYBOOK ARCHITECTURE V2
-- Corrected: Proper Postgres syntax, indexes separated
-- ============================================

-- 1. MOMENTS TABLE (User Input + Classification)
CREATE TABLE IF NOT EXISTS moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  
  -- Classification results
  domain VARCHAR(50), -- 'marriage', 'finances', 'identity', etc.
  intent VARCHAR(50), -- 'discernment', 'emotions', 'relationship_repair', etc.
  state VARCHAR(20), -- 'low', 'medium', 'high', 'crisis'
  severity VARCHAR(20), -- 'normal', 'sensitive', 'crisis'
  is_victim_experience BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for moments (separate from CREATE TABLE)
CREATE INDEX IF NOT EXISTS idx_moments_user_id ON moments(user_id);
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_domain ON moments(domain);
CREATE INDEX IF NOT EXISTS idx_moments_intent ON moments(intent);

-- 2. PLAYBOOKS_V2 TABLE (Enhanced with mode + status tracking)
CREATE TABLE IF NOT EXISTS playbooks_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_id UUID REFERENCES moments(id) ON DELETE SET NULL,
  
  -- Metadata
  title VARCHAR(255),
  subtitle TEXT,
  truth_summary TEXT,
  regulation_cue VARCHAR(100),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'queued', -- 'queued', 'generating', 'ready', 'failed'
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  schema_version INTEGER DEFAULT 1,
  
  -- Generation context
  user_input TEXT NOT NULL,
  domain VARCHAR(50),
  intent VARCHAR(50),
  mode VARCHAR(50), -- 'discernment', 'marriage', 'strategic', etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for playbooks_v2
CREATE INDEX IF NOT EXISTS idx_playbooks_v2_user_id ON playbooks_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_v2_moment_id ON playbooks_v2(moment_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_v2_status ON playbooks_v2(status);
CREATE INDEX IF NOT EXISTS idx_playbooks_v2_created_at ON playbooks_v2(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playbooks_v2_user_status ON playbooks_v2(user_id, status);

-- 3. PLAYBOOK_SCREENS TABLE (Dynamic UI)
CREATE TABLE IF NOT EXISTS playbook_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES playbooks_v2(id) ON DELETE CASCADE,
  
  -- Screen definition
  order_index INTEGER NOT NULL CHECK (order_index > 0),
  type VARCHAR(50) NOT NULL, -- 'truth_summary', 'truth_in_love', 'prayer', 'faithful_actions', etc.
  title VARCHAR(255), -- Screen header like "Pray This", "Words to Speak"
  
  -- Dynamic content (JSONB for flexibility)
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'ready', 'failed'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(playbook_id, order_index)
);

-- Indexes for playbook_screens
CREATE INDEX IF NOT EXISTS idx_playbook_screens_playbook_id ON playbook_screens(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_screens_order ON playbook_screens(playbook_id, order_index);
CREATE INDEX IF NOT EXISTS idx_playbook_screens_type ON playbook_screens(type);
CREATE INDEX IF NOT EXISTS idx_playbook_screens_status ON playbook_screens(playbook_id, status);

-- 4. ACTION_COMPLETIONS TABLE (Multi-state tracking)
CREATE TABLE IF NOT EXISTS action_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES playbooks_v2(id) ON DELETE CASCADE,
  screen_id UUID REFERENCES playbook_screens(id) ON DELETE CASCADE,
  
  -- Action tracking
  action_id VARCHAR(100) NOT NULL, -- From content_json
  status VARCHAR(20) DEFAULT 'not_started', -- 'not_started', 'in_progress', 'done', 'skipped'
  
  -- Completion tracking
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  skipped_reason TEXT,
  
  -- User input (for interactive actions like journal, budget, etc.)
  user_response JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(playbook_id, action_id)
);

-- Indexes for action_completions
CREATE INDEX IF NOT EXISTS idx_action_completions_user_id ON action_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_action_completions_playbook_id ON action_completions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_action_completions_screen_id ON action_completions(screen_id);
CREATE INDEX IF NOT EXISTS idx_action_completions_status ON action_completions(status);

-- 5. PLAYBOOK_FEEDBACK TABLE (Enhanced)
CREATE TABLE IF NOT EXISTS playbook_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES playbooks_v2(id) ON DELETE CASCADE,
  
  -- Feedback
  rating VARCHAR(20), -- 'no', 'a_little', 'yes'
  note TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(playbook_id) -- One feedback per playbook
);

-- Indexes for playbook_feedback
CREATE INDEX IF NOT EXISTS idx_playbook_feedback_user_id ON playbook_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_playbook_feedback_playbook_id ON playbook_feedback(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_feedback_rating ON playbook_feedback(rating);

-- 6. PLAYBOOK_JOBS TABLE (Queue for async generation - replaces fire-and-forget)
CREATE TABLE IF NOT EXISTS playbook_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES playbooks_v2(id) ON DELETE CASCADE,
  
  -- Job metadata
  job_type VARCHAR(50) DEFAULT 'generate', -- 'generate', 'regenerate_screen'
  priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Error tracking
  error_message TEXT,
  last_error_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for playbook_jobs
CREATE INDEX IF NOT EXISTS idx_playbook_jobs_status ON playbook_jobs(status);
CREATE INDEX IF NOT EXISTS idx_playbook_jobs_priority ON playbook_jobs(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_playbook_jobs_playbook_id ON playbook_jobs(playbook_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for moments
CREATE POLICY "Users can view own moments" 
  ON moments FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own moments" 
  ON moments FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for playbooks_v2
CREATE POLICY "Users can view own playbooks" 
  ON playbooks_v2 FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playbooks" 
  ON playbooks_v2 FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playbooks" 
  ON playbooks_v2 FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policies for playbook_screens
CREATE POLICY "Users can view own screens" 
  ON playbook_screens FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM playbooks_v2 
      WHERE playbooks_v2.id = playbook_screens.playbook_id 
      AND playbooks_v2.user_id = auth.uid()
    )
  );

-- RLS Policies for action_completions
CREATE POLICY "Users can view own completions" 
  ON action_completions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completions" 
  ON action_completions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completions" 
  ON action_completions FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policies for playbook_feedback
CREATE POLICY "Users can view own feedback" 
  ON playbook_feedback FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" 
  ON playbook_feedback FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for playbook_jobs (service role only)
CREATE POLICY "Service role can manage jobs" 
  ON playbook_jobs FOR ALL 
  USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_playbooks_v2_updated_at 
  BEFORE UPDATE ON playbooks_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbook_screens_updated_at 
  BEFORE UPDATE ON playbook_screens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_completions_updated_at 
  BEFORE UPDATE ON action_completions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get next pending job
CREATE OR REPLACE FUNCTION get_next_playbook_job()
RETURNS TABLE (
  job_id UUID,
  playbook_id UUID,
  job_type VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  UPDATE playbook_jobs
  SET status = 'processing', started_at = NOW(), attempts = attempts + 1
  WHERE id = (
    SELECT id FROM playbook_jobs
    WHERE status = 'pending' AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id, playbook_jobs.playbook_id, playbook_jobs.job_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE moments IS 'Stores user input and classification results';
COMMENT ON TABLE playbooks_v2 IS 'Enhanced playbooks with mode-based generation and status tracking';
COMMENT ON TABLE playbook_screens IS 'Dynamic screens with JSONB content for flexible UI rendering';
COMMENT ON TABLE action_completions IS 'Multi-state action tracking (not_started, in_progress, done, skipped)';
COMMENT ON TABLE playbook_jobs IS 'Queue for async playbook generation (replaces fire-and-forget fetch)';

COMMENT ON COLUMN playbooks_v2.mode IS 'Generation mode: discernment, marriage, strategic, emotional_regulation, parenting, financial_stewardship';
COMMENT ON COLUMN playbook_screens.content_json IS 'Dynamic screen content following type-specific schema';
COMMENT ON COLUMN action_completions.status IS 'Multi-state: not_started, in_progress, done, skipped';
