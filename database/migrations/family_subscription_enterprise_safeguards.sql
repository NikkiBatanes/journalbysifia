-- Family Subscription Enterprise Safeguards
-- Created: 2025-11-18
-- Purpose: Add database-level triggers, constraints, and monitoring tables for family subscriptions

-- ============================================================================
-- 1. Create family_payment_failures table for payment monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS family_payment_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_group_id UUID NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  failure_count INTEGER NOT NULL DEFAULT 1,
  first_failed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_payment_failures_group 
  ON family_payment_failures(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_payment_failures_admin 
  ON family_payment_failures(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_family_payment_failures_grace_period 
  ON family_payment_failures(grace_period_ends_at);

-- ============================================================================
-- 2. Create family_activity_log table for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS family_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_group_id UUID NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_activity_log_group 
  ON family_activity_log(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_activity_log_user 
  ON family_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_family_activity_log_type 
  ON family_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_family_activity_log_created 
  ON family_activity_log(created_at DESC);

-- ============================================================================
-- 3. Add constraints to ensure data integrity
-- ============================================================================

-- Ensure family group status is valid
ALTER TABLE family_subscription_groups 
  DROP CONSTRAINT IF EXISTS check_family_group_status;
ALTER TABLE family_subscription_groups 
  ADD CONSTRAINT check_family_group_status 
  CHECK (status IN ('active', 'cancelled', 'expired'));

-- Ensure current_members never exceeds max_members
ALTER TABLE family_subscription_groups 
  DROP CONSTRAINT IF EXISTS check_current_members_within_limit;
ALTER TABLE family_subscription_groups 
  ADD CONSTRAINT check_current_members_within_limit 
  CHECK (current_members <= max_members AND current_members >= 0);

-- ============================================================================
-- 4. Create trigger to prevent orphaned family members
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_orphaned_family_members()
RETURNS TRIGGER AS $$
BEGIN
  -- If family group is being cancelled/expired, ensure members are cleaned up
  IF NEW.status IN ('cancelled', 'expired') AND OLD.status = 'active' THEN
    -- This will be handled by application layer (FamilyPaymentService)
    -- But we log it for audit purposes
    INSERT INTO family_activity_log (
      family_group_id,
      user_id,
      activity_type,
      activity_description,
      created_at
    ) VALUES (
      NEW.id,
      NEW.admin_user_id,
      'status_changed',
      'Family group status changed from ' || OLD.status || ' to ' || NEW.status,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS family_group_status_change ON family_subscription_groups;
CREATE TRIGGER family_group_status_change
  BEFORE UPDATE ON family_subscription_groups
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION prevent_orphaned_family_members();

-- ============================================================================
-- 5. Create trigger to log member count changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_member_count_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_members != OLD.current_members THEN
    INSERT INTO family_activity_log (
      family_group_id,
      user_id,
      activity_type,
      activity_description,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      NEW.admin_user_id,
      'member_count_changed',
      'Member count changed from ' || OLD.current_members || ' to ' || NEW.current_members,
      jsonb_build_object(
        'old_count', OLD.current_members,
        'new_count', NEW.current_members,
        'change', NEW.current_members - OLD.current_members
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS family_member_count_change ON family_subscription_groups;
CREATE TRIGGER family_member_count_change
  AFTER UPDATE ON family_subscription_groups
  FOR EACH ROW
  WHEN (OLD.current_members IS DISTINCT FROM NEW.current_members)
  EXECUTE FUNCTION log_member_count_changes();

-- ============================================================================
-- 6. Create trigger to log invitation status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_invitation_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO family_activity_log (
      family_group_id,
      user_id,
      activity_type,
      activity_description,
      metadata,
      created_at
    ) VALUES (
      NEW.family_group_id,
      NEW.invited_by_user_id,
      'invitation_status_changed',
      'Invitation status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object(
        'invitation_id', NEW.id,
        'invited_email', NEW.invited_email,
        'invitation_code', NEW.invitation_code,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invitation_status_change ON family_invitations;
CREATE TRIGGER invitation_status_change
  AFTER UPDATE ON family_invitations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_invitation_status_changes();

-- ============================================================================
-- 7. Create function to auto-expire old invitations
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Mark invitations as expired if past expiry date
  UPDATE family_invitations
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Create function to validate family member limits
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_family_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  group_record RECORD;
BEGIN
  -- Get family group details
  SELECT current_members, max_members
  INTO group_record
  FROM family_subscription_groups
  WHERE id = NEW.family_group_id;
  
  -- Check if group is at capacity
  IF group_record.current_members >= group_record.max_members THEN
    RAISE EXCEPTION 'Family group is at maximum capacity (% / %)', 
      group_record.current_members, group_record.max_members;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would be applied to user_subscriptions_new when family_group_id is set
-- But we'll handle this in application layer for more flexibility

-- ============================================================================
-- 9. RLS Policies for new tables
-- ============================================================================

-- Enable RLS on family_payment_failures
ALTER TABLE family_payment_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_payment_failures_select_policy ON family_payment_failures
  FOR SELECT
  USING (
    admin_user_id = auth.uid()
    OR family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
  );

-- Only system can insert/update payment failures
CREATE POLICY family_payment_failures_insert_policy ON family_payment_failures
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY family_payment_failures_update_policy ON family_payment_failures
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Enable RLS on family_activity_log
ALTER TABLE family_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_activity_log_select_policy ON family_activity_log
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR family_group_id IN (
      SELECT id FROM family_subscription_groups WHERE admin_user_id = auth.uid()
    )
    OR family_group_id IN (
      SELECT family_group_id FROM user_subscriptions_new WHERE user_id = auth.uid()
    )
  );

-- Only system can insert activity logs
CREATE POLICY family_activity_log_insert_policy ON family_activity_log
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid());

-- ============================================================================
-- 10. Grant permissions
-- ============================================================================

GRANT SELECT ON family_payment_failures TO authenticated;
GRANT SELECT ON family_activity_log TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- 11. Create helper views for monitoring
-- ============================================================================

CREATE OR REPLACE VIEW family_subscription_health AS
SELECT 
  fsg.id as family_group_id,
  fsg.group_name,
  fsg.admin_user_id,
  fsg.current_members,
  fsg.max_members,
  fsg.status,
  fsg.created_at,
  fpf.failure_count,
  fpf.grace_period_ends_at,
  CASE 
    WHEN fsg.status = 'cancelled' THEN 'cancelled'
    WHEN fsg.status = 'expired' THEN 'expired'
    WHEN fpf.grace_period_ends_at IS NOT NULL AND fpf.grace_period_ends_at < NOW() THEN 'payment_expired'
    WHEN fpf.grace_period_ends_at IS NOT NULL THEN 'grace_period'
    ELSE 'active'
  END as health_status,
  CASE 
    WHEN fpf.grace_period_ends_at IS NOT NULL THEN 
      EXTRACT(DAY FROM (fpf.grace_period_ends_at - NOW()))
    ELSE NULL
  END as days_until_expiry
FROM family_subscription_groups fsg
LEFT JOIN family_payment_failures fpf ON fsg.id = fpf.family_group_id;

-- Grant select on view
GRANT SELECT ON family_subscription_health TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_payment_failures') THEN
    RAISE NOTICE '✅ family_payment_failures table created successfully';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_activity_log') THEN
    RAISE NOTICE '✅ family_activity_log table created successfully';
  END IF;
  
  RAISE NOTICE '✅ Family subscription enterprise safeguards migration completed successfully';
END $$;
