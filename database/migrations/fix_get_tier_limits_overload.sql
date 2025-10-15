-- Fix: Add text overload for get_tier_limits to handle string literals
-- This resolves the "function get_tier_limits(unknown) does not exist" error
-- when calling the function with untyped string literals like 'seeker'

-- First, ensure the enum-based function exists (in case it wasn't created yet)
CREATE OR REPLACE FUNCTION get_tier_limits(tier_name subscription_tier_new)
RETURNS TABLE (
    playbooks_limit INTEGER,
    devotionals_limit INTEGER,
    smart_journaling_enabled BOOLEAN,
    show_dashboard_counts BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE tier_name
            WHEN 'seeker' THEN 0
            WHEN 'free_trial' THEN 2
            WHEN 'spark' THEN 8
            WHEN 'growth' THEN 20
            WHEN 'transformation' THEN -1  -- Unlimited
            WHEN 'family' THEN -1          -- Unlimited
        END as playbooks_limit,
        CASE tier_name
            WHEN 'seeker' THEN 0
            WHEN 'free_trial' THEN 2
            WHEN 'spark' THEN 8
            WHEN 'growth' THEN 20
            WHEN 'transformation' THEN -1  -- Unlimited
            WHEN 'family' THEN -1          -- Unlimited
        END as devotionals_limit,
        CASE tier_name
            WHEN 'spark' THEN true
            WHEN 'growth' THEN true
            WHEN 'transformation' THEN true
            WHEN 'family' THEN true
            ELSE false
        END as smart_journaling_enabled,
        CASE tier_name
            WHEN 'spark' THEN true
            WHEN 'growth' THEN true
            ELSE false  -- No counts/badges for transformation and family
        END as show_dashboard_counts;
END;
$$ LANGUAGE plpgsql;

-- Now create a text overload that casts to the enum type
CREATE OR REPLACE FUNCTION get_tier_limits(tier_name TEXT)
RETURNS TABLE (
    playbooks_limit INTEGER,
    devotionals_limit INTEGER,
    smart_journaling_enabled BOOLEAN,
    show_dashboard_counts BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Cast the text parameter to the enum type and call the original function
    RETURN QUERY
    SELECT * FROM get_tier_limits(tier_name::subscription_tier_new);
END;
$$;

-- Verify the function works with both text and enum types
-- Test with text literal
DO $$
DECLARE
    test_result RECORD;
BEGIN
    SELECT * INTO test_result FROM get_tier_limits('seeker');
    RAISE NOTICE 'Text overload test passed: playbooks_limit=%', test_result.playbooks_limit;
END;
$$;

-- Test with enum type
DO $$
DECLARE
    test_result RECORD;
BEGIN
    SELECT * INTO test_result FROM get_tier_limits('seeker'::subscription_tier_new);
    RAISE NOTICE 'Enum overload test passed: playbooks_limit=%', test_result.playbooks_limit;
END;
$$;
