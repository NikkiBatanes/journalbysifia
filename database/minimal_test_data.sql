-- Minimal Test Data Script
-- This script adds basic faith points data to test the components

-- Check current table structures first
SELECT 'faith_points_log table:' as info;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'faith_points_log' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'faith_points_profiles table:' as info;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'faith_points_profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add basic faith points data
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    -- Get the first user ID from auth.users
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Adding test data for user: %', test_user_id;
        
        -- Try to insert faith points activities
        BEGIN
            INSERT INTO public.faith_points_log (user_id, points, activity_type, reason, created_at) VALUES
            (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '1 day'),
            (test_user_id, 5, 'daily_streak', 'Daily prayer session', NOW() - INTERVAL '1 day'),
            (test_user_id, 8, 'devotional_generated', 'Generated new devotional', NOW() - INTERVAL '2 days'),
            (test_user_id, 10, 'playbook_generated', 'Generated new playbook', NOW() - INTERVAL '3 days'),
            (test_user_id, 3, 'action_step_completed', 'Completed playbook step', NOW() - INTERVAL '1 day');
            
            RAISE NOTICE 'Faith points activities inserted successfully';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error inserting faith points activities: %', SQLERRM;
        END;
        
        -- Try to create/update faith points profile
        BEGIN
            INSERT INTO public.faith_points_profiles (
                user_id, 
                total_points, 
                current_level, 
                current_streak, 
                longest_streak
            ) VALUES (
                test_user_id,
                31, -- 5+5+8+10+3
                1,
                3,
                5
            )
            ON CONFLICT (user_id) 
            DO UPDATE SET
                total_points = 31,
                current_level = 1,
                current_streak = 3,
                longest_streak = 5,
                updated_at = NOW();
                
            RAISE NOTICE 'Faith points profile updated successfully';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error updating faith points profile: %', SQLERRM;
        END;
        
    ELSE
        RAISE NOTICE 'No user found in auth.users table';
    END IF;
END $$;

SELECT 'Minimal test data script completed!' as status;
