-- Rollback Migration: Bug Reports and Feature Requests Tables
-- Description: Removes bug_reports and feature_requests tables
-- Created: 2025-11-17

-- Drop triggers
DROP TRIGGER IF EXISTS update_bug_reports_updated_at ON public.bug_reports;
DROP TRIGGER IF EXISTS update_feature_requests_updated_at ON public.feature_requests;

-- Drop tables (CASCADE will remove all dependent objects like indexes and policies)
DROP TABLE IF EXISTS public.feature_requests CASCADE;
DROP TABLE IF EXISTS public.bug_reports CASCADE;

-- Note: The update_updated_at_column() function is kept as it may be used by other tables
-- If you want to remove it completely, uncomment the following line:
-- DROP FUNCTION IF EXISTS update_updated_at_column();
