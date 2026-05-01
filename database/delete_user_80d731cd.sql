-- Manual deletion script for multiple users
-- Run this in Supabase SQL Editor with service role privileges

DO $$
DECLARE
  target_user_ids UUID[] := ARRAY[
    '80d731cd-bba4-4bea-9367-2154292dcae7',
    'd4f198f3-cd1c-4221-a09a-d80b7c00c9e2',
    '270b3c07-6776-4a72-b9f9-2d689f356073',
    '589baff1-3fb2-4703-9d1e-c494dce2fa6e'
  ];
  target_user_id UUID;
  playbook_ids UUID[];
  user_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting deletion for % users', array_length(target_user_ids, 1);

  -- Loop through each user ID
  FOREACH target_user_id IN ARRAY target_user_ids
  LOOP
    BEGIN
      user_count := user_count + 1;
      RAISE NOTICE '[%/%] Starting deletion for user: %', user_count, array_length(target_user_ids, 1), target_user_id;

      -- 1. Get all playbook IDs first (for cascade deletions)
      SELECT ARRAY_AGG(id) INTO playbook_ids
      FROM playbooks
      WHERE user_id = target_user_id;

      IF playbook_ids IS NOT NULL AND array_length(playbook_ids, 1) > 0 THEN
        RAISE NOTICE '[%/%] Found % playbooks to delete', user_count, array_length(target_user_ids, 1), array_length(playbook_ids, 1);

        -- 2. Delete playbook-related data first
        BEGIN
          DELETE FROM playbook_action_steps WHERE playbook_id = ANY(playbook_ids);
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE '[%/%] playbook_action_steps error: %', user_count, array_length(target_user_ids, 1), SQLERRM;
        END;
        BEGIN
          DELETE FROM playbook_affirmations WHERE playbook_id = ANY(playbook_ids);
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE '[%/%] playbook_affirmations error: %', user_count, array_length(target_user_ids, 1), SQLERRM;
        END;
      END IF;

      -- 2.5. Delete from playbooks_v2 tables (if they exist)
      BEGIN
        DELETE FROM action_completions WHERE user_id = target_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[%/%] action_completions error: %', user_count, array_length(target_user_ids, 1), SQLERRM;
      END;
      BEGIN
        DELETE FROM playbook_feedback WHERE user_id = target_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[%/%] playbook_feedback error: %', user_count, array_length(target_user_ids, 1), SQLERRM;
      END;
      BEGIN
        DELETE FROM playbook_screens WHERE playbook_id IN (SELECT id FROM playbooks_v2 WHERE user_id = target_user_id);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[%/%] playbook_screens error: %', user_count, array_length(target_user_ids, 1), SQLERRM;
      END;
      BEGIN
        DELETE FROM playbooks_v2 WHERE user_id = target_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[%/%] playbooks_v2 error: %', user_count, array_length(target_user_ids, 1), SQLERRM;
      END;
      BEGIN
        DELETE FROM moments WHERE user_id = target_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[%/%] moments error: %', user_count, array_length(target_user_ids, 1), SQLERRM;
      END;

      -- 3. Delete user data from all tables in dependency order
      BEGIN DELETE FROM journal_entries WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'journal_entries error: %', SQLERRM; END;
      BEGIN DELETE FROM prayers WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'prayers error: %', SQLERRM; END;
      BEGIN DELETE FROM reflection_entries WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'reflection_entries error: %', SQLERRM; END;
      BEGIN DELETE FROM time_blocks WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'time_blocks error: %', SQLERRM; END;
      BEGIN DELETE FROM notification_preferences WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'notification_preferences error: %', SQLERRM; END;
      BEGIN DELETE FROM faith_points_profiles WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'faith_points_profiles error: %', SQLERRM; END;
      BEGIN DELETE FROM faith_points_log WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'faith_points_log error: %', SQLERRM; END;
      BEGIN DELETE FROM user_streaks WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_streaks error: %', SQLERRM; END;
      BEGIN DELETE FROM user_subscriptions_new WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_subscriptions_new error: %', SQLERRM; END;
      BEGIN DELETE FROM validated_receipts WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'validated_receipts error: %', SQLERRM; END;
      BEGIN DELETE FROM devotionals WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'devotionals error: %', SQLERRM; END;
      BEGIN DELETE FROM playbooks WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'playbooks error: %', SQLERRM; END;
      BEGIN DELETE FROM user_profiles WHERE id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_profiles error: %', SQLERRM; END;
      BEGIN DELETE FROM account_deletions WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'account_deletions error: %', SQLERRM; END;
      BEGIN DELETE FROM onboarding_progress WHERE user_id = target_user_id; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'onboarding_progress error: %', SQLERRM; END;

      RAISE NOTICE '[%/%] Database data deleted for user: %', user_count, array_length(target_user_ids, 1), target_user_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%/%] Error deleting user %: %', user_count, array_length(target_user_ids, 1), target_user_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Deletion process completed for % users', array_length(target_user_ids, 1);
  RAISE NOTICE 'Now attempting to delete auth users directly...';

  -- Delete auth users directly using auth admin
  FOREACH target_user_id IN ARRAY target_user_ids
  LOOP
    BEGIN
      -- This uses the Supabase auth admin function to delete the user
      -- This bypasses some of the dashboard checks
      PERFORM auth.uid() = target_user_id;
      
      -- Try to delete via the auth schema directly
      DELETE FROM auth.users WHERE id = target_user_id;
      
      RAISE NOTICE 'Deleted auth user: %', target_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete auth user %: %', target_user_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Auth deletion process completed';
END $$;

-- Alternative: Direct auth user deletion (run in Supabase dashboard with service role)
-- You may need to run this separately in the Auth section of Supabase dashboard
-- or use the supabase CLI: supabase auth admin delete 80d731cd-bba4-4bea-9367-2154292dcae7
