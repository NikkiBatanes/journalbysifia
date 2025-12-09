-- Delete user and all related data for user ID: 1c01975a-6fb1-4d01-96c1-a8025ad78ec3

-- Start transaction to ensure data consistency
BEGIN;

-- Delete from dependent tables first (foreign key constraints)
-- Only include tables that are confirmed to exist in the codebase

-- Delete from user subscriptions (confirmed exists)
DELETE FROM user_subscriptions_new WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from user profiles (confirmed exists)
DELETE FROM user_profiles WHERE id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from playbooks and related data (all confirmed exist)
DELETE FROM playbook_affirmations WHERE playbook_id IN (SELECT id FROM playbooks WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3');
DELETE FROM playbook_sub_tasks WHERE action_step_id IN (SELECT id FROM playbook_action_steps WHERE playbook_id IN (SELECT id FROM playbooks WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3'));
DELETE FROM playbook_action_steps WHERE playbook_id IN (SELECT id FROM playbooks WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3');
DELETE FROM playbooks WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from devotionals (confirmed exists)
DELETE FROM devotionals WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from journal entries (confirmed exists)
DELETE FROM journal_entries WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from prayers (confirmed exists)
DELETE FROM prayers WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from reflection entries (confirmed exists)
DELETE FROM reflection_entries WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from time blocks (confirmed exists)
DELETE FROM time_blocks WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from discount codes (confirmed exists)
-- Note: This table might not have user_id field, uncomment if it does
-- DELETE FROM discount_codes WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from notification analytics (confirmed exists)
DELETE FROM notification_analytics WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Delete from onboarding step analytics (confirmed exists)
DELETE FROM onboarding_step_analytics WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- The following tables are referenced in code but may not exist or have different names:
-- Uncomment these only if you confirm they exist in your database

-- DELETE FROM user_behavior_events WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM faith_points_transactions WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM user_streaks WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM user_milestones WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM user_intelligence_profiles WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM notifications WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM device_tokens WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM notification_queue WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM generation_queue WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM generated_content WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM account_deletion_requests WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM devotional_progress WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
-- DELETE FROM application_logs WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Commit the transaction
COMMIT;

-- Verify deletion
SELECT COUNT(*) as remaining_profiles FROM user_profiles WHERE id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';
SELECT COUNT(*) as remaining_subscriptions FROM user_subscriptions_new WHERE user_id = '1c01975a-6fb1-4d01-96c1-a8025ad78ec3';

-- Note: For Supabase, you may also need to:
-- 1. Delete the user from auth.users via Supabase Admin Dashboard or auth.admin.deleteUser()
-- 2. Handle any storage files associated with the user
-- 3. Uncomment additional tables above if they exist in your database
