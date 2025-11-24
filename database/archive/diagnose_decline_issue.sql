-- COMPREHENSIVE DIAGNOSTIC FOR DECLINE ISSUE
-- Run this as the invited user to see exactly what's happening

-- ============================================================================
-- 1. Check if user_profiles table exists and has email column
-- ============================================================================
SELECT 
  'user_profiles schema check' as test,
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('id', 'email');

-- ============================================================================
-- 2. Check current user's email from user_profiles
-- ============================================================================
SELECT 
  'Current user email' as test,
  id,
  email
FROM user_profiles 
WHERE id = auth.uid();

-- ============================================================================
-- 3. Find pending invitations for current user's email
-- ============================================================================
SELECT 
  'Pending invitations for my email' as test,
  fi.id,
  fi.invitation_code,
  fi.invited_email,
  fi.family_group_id,
  fi.status,
  fi.invited_by_user_id
FROM family_invitations fi
WHERE fi.invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  AND fi.status = 'pending';

-- ============================================================================
-- 4. Check if the RLS policy condition would pass
-- ============================================================================
-- This checks if the subquery in the RLS policy returns any rows
SELECT 
  'RLS policy check - pending invitation exists' as test,
  COUNT(*) as matching_invitations,
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - User has pending invitation'
    ELSE 'FAIL - No pending invitation found'
  END as result
FROM family_invitations 
WHERE invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  AND status = 'pending';

-- ============================================================================
-- 5. Check family_activity_log table schema
-- ============================================================================
SELECT 
  'family_activity_log schema' as test,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'family_activity_log'
ORDER BY ordinal_position;

-- ============================================================================
-- 6. Check current RLS policies on family_activity_log
-- ============================================================================
SELECT 
  'Current RLS policies on family_activity_log' as test,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'family_activity_log';

-- ============================================================================
-- 7. Check if trigger exists on family_invitations
-- ============================================================================
SELECT 
  'Triggers on family_invitations' as test,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'family_invitations';

-- ============================================================================
-- 8. Test what the trigger would insert (simulation)
-- ============================================================================
-- Get a sample invitation to see what values the trigger would use
SELECT 
  'Simulated trigger insert values' as test,
  family_group_id,
  invited_by_user_id as user_id_that_would_be_inserted,
  'invitation_status_changed' as activity_type,
  'Invitation status changed from pending to declined' as activity_description
FROM family_invitations
WHERE invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  AND status = 'pending'
LIMIT 1;

-- ============================================================================
-- 9. Check if current user can SELECT from family_activity_log
-- ============================================================================
SELECT 
  'Can I read family_activity_log?' as test,
  COUNT(*) as readable_rows
FROM family_activity_log;

-- ============================================================================
-- 10. Final diagnosis summary
-- ============================================================================
SELECT 
  'DIAGNOSIS SUMMARY' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND email IS NOT NULL)
      THEN '✅ User has email in user_profiles'
    ELSE '❌ User email not found in user_profiles'
  END as user_email_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM family_invitations 
      WHERE invited_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
        AND status = 'pending'
    )
      THEN '✅ User has pending invitation'
    ELSE '❌ No pending invitation found'
  END as invitation_check,
  auth.uid() as current_user_id,
  (SELECT email FROM user_profiles WHERE id = auth.uid()) as current_user_email;
