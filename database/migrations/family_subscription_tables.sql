-- Family Subscription Tables Migration
-- Created: 2025-11-11
-- Purpose: Support family subscription feature with invite codes (5 members max)

-- ============================================================================
-- Table: family_subscription_groups
-- Purpose: Store family subscription groups (1 admin + 4 additional members)
-- ============================================================================

CREATE TABLE IF NOT EXISTS family_subscription_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  max_members INTEGER NOT NULL DEFAULT 5,
  current_members INTEGER NOT NULL DEFAULT 1,
  platform_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_groups_admin_user ON family_subscription_groups(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_family_groups_status ON family_subscription_groups(status);
CREATE INDEX IF NOT EXISTS idx_family_groups_platform_sub ON family_subscription_groups(platform_subscription_id);

-- ============================================================================
-- Table: family_invitations
-- Purpose: Store family invitation codes (8-character alphanumeric)
-- ============================================================================

CREATE TABLE IF NOT EXISTS family_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_group_id UUID NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  invitation_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_invitations_group ON family_invitations(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_code ON family_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_family_invitations_email ON family_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_family_invitations_status ON family_invitations(status);
CREATE INDEX IF NOT EXISTS idx_family_invitations_expires ON family_invitations(expires_at);

-- ============================================================================
-- Add family columns to user_subscriptions_new table
-- Purpose: Link users to family groups
-- ============================================================================

-- Add family_group_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions_new' 
    AND column_name = 'family_group_id'
  ) THEN
    ALTER TABLE user_subscriptions_new 
    ADD COLUMN family_group_id UUID REFERENCES family_subscription_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add family_role column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions_new' 
    AND column_name = 'family_role'
  ) THEN
    ALTER TABLE user_subscriptions_new 
    ADD COLUMN family_role TEXT CHECK (family_role IN ('admin', 'member'));
  END IF;
END $$;

-- Create index on family_group_id for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_family_group ON user_subscriptions_new(family_group_id);

-- ============================================================================
-- Trigger: Update updated_at timestamp automatically
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for family_subscription_groups
DROP TRIGGER IF EXISTS update_family_groups_updated_at ON family_subscription_groups;
CREATE TRIGGER update_family_groups_updated_at
  BEFORE UPDATE ON family_subscription_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for family_invitations
DROP TRIGGER IF EXISTS update_family_invitations_updated_at ON family_invitations;
CREATE TRIGGER update_family_invitations_updated_at
  BEFORE UPDATE ON family_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================

-- Enable RLS on family_subscription_groups
ALTER TABLE family_subscription_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own family group
CREATE POLICY family_groups_select_policy ON family_subscription_groups
  FOR SELECT
  USING (
    admin_user_id = auth.uid() 
    OR id IN (
      SELECT family_group_id 
      FROM user_subscriptions_new 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admin can insert family groups
CREATE POLICY family_groups_insert_policy ON family_subscription_groups
  FOR INSERT
  WITH CHECK (admin_user_id = auth.uid());

-- Policy: Only admin can update family groups
CREATE POLICY family_groups_update_policy ON family_subscription_groups
  FOR UPDATE
  USING (admin_user_id = auth.uid());

-- Policy: Only admin can delete family groups
CREATE POLICY family_groups_delete_policy ON family_subscription_groups
  FOR DELETE
  USING (admin_user_id = auth.uid());

-- Enable RLS on family_invitations
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations for their family group or sent to their email
CREATE POLICY family_invitations_select_policy ON family_invitations
  FOR SELECT
  USING (
    invited_by_user_id = auth.uid()
    OR invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
    OR family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );

-- Policy: Only family admin can insert invitations
CREATE POLICY family_invitations_insert_policy ON family_invitations
  FOR INSERT
  WITH CHECK (
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );

-- Policy: Only family admin can update invitations
CREATE POLICY family_invitations_update_policy ON family_invitations
  FOR UPDATE
  USING (
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );

-- Policy: Only family admin can delete invitations
CREATE POLICY family_invitations_delete_policy ON family_invitations
  FOR DELETE
  USING (
    family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );

-- ============================================================================
-- Constraints and Validation
-- ============================================================================

-- Ensure max_members is always 5
ALTER TABLE family_subscription_groups 
ADD CONSTRAINT check_max_members_is_five 
CHECK (max_members = 5);

-- Ensure current_members doesn't exceed max_members
ALTER TABLE family_subscription_groups 
ADD CONSTRAINT check_current_members_within_limit 
CHECK (current_members <= max_members);

-- Ensure current_members is at least 1 (admin)
ALTER TABLE family_subscription_groups 
ADD CONSTRAINT check_current_members_minimum 
CHECK (current_members >= 1);

-- Ensure invitation code is 8 characters
ALTER TABLE family_invitations 
ADD CONSTRAINT check_invitation_code_length 
CHECK (length(invitation_code) = 8);

-- Ensure invitation code is uppercase alphanumeric
ALTER TABLE family_invitations 
ADD CONSTRAINT check_invitation_code_format 
CHECK (invitation_code ~ '^[A-Z0-9]{8}$');

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if family group has space for new member
CREATE OR REPLACE FUNCTION family_group_has_space(group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  group_record RECORD;
BEGIN
  SELECT current_members, max_members 
  INTO group_record
  FROM family_subscription_groups
  WHERE id = group_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN group_record.current_members < group_record.max_members;
END;
$$ LANGUAGE plpgsql;

-- Function to increment family group member count
CREATE OR REPLACE FUNCTION increment_family_member_count(group_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE family_subscription_groups
  SET current_members = current_members + 1
  WHERE id = group_id
  AND current_members < max_members;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement family group member count
CREATE OR REPLACE FUNCTION decrement_family_member_count(group_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE family_subscription_groups
  SET current_members = GREATEST(1, current_members - 1)
  WHERE id = group_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE family_subscription_groups IS 'Stores family subscription groups with max 5 members (1 admin + 4 additional)';
COMMENT ON TABLE family_invitations IS 'Stores family invitation codes (8-character alphanumeric, expires in 7 days)';
COMMENT ON COLUMN family_subscription_groups.max_members IS 'Maximum members allowed (always 5)';
COMMENT ON COLUMN family_subscription_groups.current_members IS 'Current number of active members';
COMMENT ON COLUMN family_invitations.invitation_code IS '8-character uppercase alphanumeric code';
COMMENT ON COLUMN family_invitations.expires_at IS 'Invitation expires 7 days after creation';

-- ============================================================================
-- Grant permissions (adjust based on your setup)
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON family_subscription_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON family_invitations TO authenticated;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_subscription_groups') THEN
    RAISE NOTICE '✅ family_subscription_groups table created successfully';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_invitations') THEN
    RAISE NOTICE '✅ family_invitations table created successfully';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_subscriptions_new' AND column_name = 'family_group_id') THEN
    RAISE NOTICE '✅ family_group_id column added to user_subscriptions_new';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_subscriptions_new' AND column_name = 'family_role') THEN
    RAISE NOTICE '✅ family_role column added to user_subscriptions_new';
  END IF;
  
  RAISE NOTICE '✅ Family subscription migration completed successfully';
END $$;
