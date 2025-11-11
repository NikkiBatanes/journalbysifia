-- Family Subscription Tables Rollback Migration
-- Created: 2025-11-11
-- Purpose: Rollback family subscription feature tables if needed

-- ============================================================================
-- WARNING: This will delete all family subscription data!
-- ============================================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS family_groups_select_policy ON family_subscription_groups;
DROP POLICY IF EXISTS family_groups_insert_policy ON family_subscription_groups;
DROP POLICY IF EXISTS family_groups_update_policy ON family_subscription_groups;
DROP POLICY IF EXISTS family_groups_delete_policy ON family_subscription_groups;

DROP POLICY IF EXISTS family_invitations_select_policy ON family_invitations;
DROP POLICY IF EXISTS family_invitations_insert_policy ON family_invitations;
DROP POLICY IF EXISTS family_invitations_update_policy ON family_invitations;
DROP POLICY IF EXISTS family_invitations_delete_policy ON family_invitations;

-- Drop triggers
DROP TRIGGER IF EXISTS update_family_groups_updated_at ON family_subscription_groups;
DROP TRIGGER IF EXISTS update_family_invitations_updated_at ON family_invitations;

-- Drop helper functions
DROP FUNCTION IF EXISTS family_group_has_space(UUID);
DROP FUNCTION IF EXISTS increment_family_member_count(UUID);
DROP FUNCTION IF EXISTS decrement_family_member_count(UUID);

-- Drop tables (CASCADE will drop foreign key constraints)
DROP TABLE IF EXISTS family_invitations CASCADE;
DROP TABLE IF EXISTS family_subscription_groups CASCADE;

-- Remove columns from user_subscriptions_new
ALTER TABLE user_subscriptions_new DROP COLUMN IF EXISTS family_group_id;
ALTER TABLE user_subscriptions_new DROP COLUMN IF EXISTS family_role;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Family subscription tables and columns removed';
END $$;
