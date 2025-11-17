-- Family Subscription System Schema
-- Created: 2025-01-18
-- Enterprise-grade family subscription management

-- =====================================================
-- FAMILY SUBSCRIPTION GROUPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS family_subscription_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_name VARCHAR(255) NOT NULL,
  
  -- Capacity management
  max_members INTEGER NOT NULL DEFAULT 5,
  current_members INTEGER NOT NULL DEFAULT 1,
  
  -- Payment integration
  platform VARCHAR(50), -- 'apple', 'google', 'local_test'
  platform_subscription_id VARCHAR(255),
  platform_transaction_id VARCHAR(255),
  platform_receipt_data JSONB,
  
  -- Billing
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'annual'
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'suspended'
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_member_count CHECK (current_members >= 1 AND current_members <= max_members)
);

-- Indexes for family groups
CREATE INDEX IF NOT EXISTS idx_family_groups_admin ON family_subscription_groups(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_family_groups_status ON family_subscription_groups(status);
CREATE INDEX IF NOT EXISTS idx_family_groups_platform_sub ON family_subscription_groups(platform_subscription_id);

-- =====================================================
-- FAMILY INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS family_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_group_id UUID NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
  
  -- Invitation details
  invited_email VARCHAR(255) NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  invitation_code VARCHAR(8) NOT NULL UNIQUE,
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  accepted_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  
  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for invitations
CREATE INDEX IF NOT EXISTS idx_family_invitations_group ON family_invitations(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_email ON family_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_family_invitations_code ON family_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_family_invitations_status ON family_invitations(status);

-- =====================================================
-- FAMILY ACTIVITY LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS family_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_group_id UUID NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
  
  -- Activity details
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  activity_type VARCHAR(100) NOT NULL, -- 'member_added', 'member_removed', 'invitation_sent', 'subscription_upgraded', etc.
  activity_description TEXT,
  
  -- Context
  affected_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for activity log
CREATE INDEX IF NOT EXISTS idx_family_activity_group ON family_activity_log(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_activity_type ON family_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_family_activity_created ON family_activity_log(created_at DESC);

-- =====================================================
-- FAMILY USAGE ANALYTICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS family_usage_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_group_id UUID NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Usage metrics (monthly aggregation)
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  playbooks_generated INTEGER DEFAULT 0,
  devotionals_generated INTEGER DEFAULT 0,
  smart_journal_entries INTEGER DEFAULT 0,
  active_days INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for period tracking
  UNIQUE(family_group_id, user_id, period_start)
);

-- Indexes for usage analytics
CREATE INDEX IF NOT EXISTS idx_family_usage_group ON family_usage_analytics(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_usage_user ON family_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_family_usage_period ON family_usage_analytics(period_start, period_end);

-- =====================================================
-- ALTER USER SUBSCRIPTIONS TABLE
-- =====================================================
-- Add family-related columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_subscriptions_new' 
                 AND column_name = 'family_group_id') THEN
    ALTER TABLE user_subscriptions_new 
    ADD COLUMN family_group_id UUID REFERENCES family_subscription_groups(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_subscriptions_new' 
                 AND column_name = 'family_role') THEN
    ALTER TABLE user_subscriptions_new 
    ADD COLUMN family_role VARCHAR(20) CHECK (family_role IN ('admin', 'member'));
  END IF;
END $$;

-- Index for family group lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_family_group ON user_subscriptions_new(family_group_id);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to family groups
DROP TRIGGER IF EXISTS update_family_groups_updated_at ON family_subscription_groups;
CREATE TRIGGER update_family_groups_updated_at
  BEFORE UPDATE ON family_subscription_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to family invitations
DROP TRIGGER IF EXISTS update_family_invitations_updated_at ON family_invitations;
CREATE TRIGGER update_family_invitations_updated_at
  BEFORE UPDATE ON family_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to family usage analytics
DROP TRIGGER IF EXISTS update_family_usage_analytics_updated_at ON family_usage_analytics;
CREATE TRIGGER update_family_usage_analytics_updated_at
  BEFORE UPDATE ON family_usage_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all family tables
ALTER TABLE family_subscription_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_usage_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS family_groups_admin_full_access ON family_subscription_groups;
DROP POLICY IF EXISTS family_groups_member_read_access ON family_subscription_groups;
DROP POLICY IF EXISTS family_invitations_admin_access ON family_invitations;
DROP POLICY IF EXISTS family_invitations_invitee_read ON family_invitations;
DROP POLICY IF EXISTS family_activity_read_access ON family_activity_log;
DROP POLICY IF EXISTS family_usage_admin_access ON family_usage_analytics;
DROP POLICY IF EXISTS family_usage_member_own_access ON family_usage_analytics;

-- Family Groups: Admin can view/edit their group, members can view
CREATE POLICY family_groups_admin_full_access ON family_subscription_groups
  FOR ALL
  USING (admin_user_id = auth.uid());

CREATE POLICY family_groups_member_read_access ON family_subscription_groups
  FOR SELECT
  USING (
    id IN (
      SELECT family_group_id 
      FROM user_subscriptions_new 
      WHERE user_id = auth.uid() AND family_group_id IS NOT NULL
    )
  );

-- Family Invitations: Admin can manage, invited user can view their invitation
CREATE POLICY family_invitations_admin_access ON family_invitations
  FOR ALL
  USING (
    invited_by_user_id = auth.uid() OR
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );

CREATE POLICY family_invitations_invitee_read ON family_invitations
  FOR SELECT
  USING (
    invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  );

-- Family Activity Log: All family members can read
CREATE POLICY family_activity_read_access ON family_activity_log
  FOR SELECT
  USING (
    family_group_id IN (
      SELECT family_group_id 
      FROM user_subscriptions_new 
      WHERE user_id = auth.uid() AND family_group_id IS NOT NULL
    )
  );

-- Family Usage Analytics: Admin can view all, members can view their own
CREATE POLICY family_usage_admin_access ON family_usage_analytics
  FOR SELECT
  USING (
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );

CREATE POLICY family_usage_member_own_access ON family_usage_analytics
  FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to log family activity
CREATE OR REPLACE FUNCTION log_family_activity(
  p_family_group_id UUID,
  p_user_id UUID,
  p_activity_type VARCHAR,
  p_activity_description TEXT DEFAULT NULL,
  p_affected_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO family_activity_log (
    family_group_id,
    user_id,
    activity_type,
    activity_description,
    affected_user_id,
    metadata
  ) VALUES (
    p_family_group_id,
    p_user_id,
    p_activity_type,
    p_activity_description,
    p_affected_user_id,
    p_metadata
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get family usage summary
CREATE OR REPLACE FUNCTION get_family_usage_summary(p_family_group_id UUID)
RETURNS TABLE (
  total_playbooks BIGINT,
  total_devotionals BIGINT,
  total_journal_entries BIGINT,
  active_members BIGINT,
  avg_playbooks_per_member NUMERIC,
  avg_devotionals_per_member NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(playbooks_generated), 0)::BIGINT as total_playbooks,
    COALESCE(SUM(devotionals_generated), 0)::BIGINT as total_devotionals,
    COALESCE(SUM(smart_journal_entries), 0)::BIGINT as total_journal_entries,
    COUNT(DISTINCT user_id)::BIGINT as active_members,
    COALESCE(AVG(playbooks_generated), 0) as avg_playbooks_per_member,
    COALESCE(AVG(devotionals_generated), 0) as avg_devotionals_per_member
  FROM family_usage_analytics
  WHERE family_group_id = p_family_group_id
    AND period_start >= DATE_TRUNC('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ADDITIONAL RLS POLICIES FOR USER_PROFILES ACCESS
-- =====================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS family_members_read_profiles ON user_profiles;

-- Allow family members to read each other's profiles
CREATE POLICY family_members_read_profiles ON user_profiles
  FOR SELECT
  USING (
    -- User can read their own profile
    id = auth.uid()
    OR
    -- User can read profiles of family members in their group
    id IN (
      SELECT user_id 
      FROM user_subscriptions_new 
      WHERE family_group_id IN (
        SELECT family_group_id 
        FROM user_subscriptions_new 
        WHERE user_id = auth.uid() 
        AND family_group_id IS NOT NULL
      )
    )
  );

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON family_subscription_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_invitations TO authenticated;
GRANT SELECT, INSERT ON family_activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON family_usage_analytics TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE family_subscription_groups IS 'Stores family subscription group information with admin and member management';
COMMENT ON TABLE family_invitations IS 'Manages family subscription invitations with expiration and status tracking';
COMMENT ON TABLE family_activity_log IS 'Audit log for all family subscription activities';
COMMENT ON TABLE family_usage_analytics IS 'Tracks usage metrics for family members for analytics and reporting';
COMMENT ON FUNCTION log_family_activity IS 'Helper function to log family activities with proper context';
COMMENT ON FUNCTION get_family_usage_summary IS 'Returns aggregated usage summary for a family group';
