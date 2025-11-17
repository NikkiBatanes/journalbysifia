-- Fix Family Subscription Foreign Keys
-- Change all auth.users references to user_profiles to avoid RLS permission issues

-- Drop existing tables if they exist (only run if you haven't populated data yet)
-- If you have data, you'll need to migrate it first
DROP TABLE IF EXISTS family_usage_analytics CASCADE;
DROP TABLE IF EXISTS family_activity_log CASCADE;
DROP TABLE IF EXISTS family_invitations CASCADE;
DROP TABLE IF EXISTS family_subscription_groups CASCADE;

-- Now run the main migration file: 20250118_family_subscription_schema.sql
-- It will create all tables with correct foreign keys to user_profiles instead of auth.users
