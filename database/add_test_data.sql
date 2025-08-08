-- Add Test Data for Faith Points System
-- Run this script in Supabase SQL Editor after the schema is fixed

-- First, let's check if we have the user ID
-- Replace 'YOUR_USER_ID' with the actual user ID from auth.users table

-- Get the user ID (replace with actual user ID)
-- SELECT id FROM auth.users LIMIT 1;

-- Add test faith points activities for the last 30 days
-- Replace the user_id with your actual user ID

DO $$
DECLARE
    test_user_id uuid;
BEGIN
    -- Get the first user ID from auth.users
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Insert test faith points activities for the last 2 weeks
        
        -- Journal entries (last 7 days)
        INSERT INTO public.faith_points_log (user_id, points, activity_type, reason, created_at) VALUES
        (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '1 day'),
        (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '2 days'),
        (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '3 days'),
        (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '5 days'),
        (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '7 days');
        
        -- Daily streak activities (prayer/scripture/affirmations)
        INSERT INTO public.faith_points_log (user_id, points, activity_type, reason, created_at) VALUES
        (test_user_id, 5, 'daily_streak', 'Daily prayer session', NOW() - INTERVAL '1 day'),
        (test_user_id, 5, 'daily_streak', 'Daily scripture reading', NOW() - INTERVAL '1 day'),
        (test_user_id, 5, 'daily_streak', 'Daily affirmation', NOW() - INTERVAL '1 day'),
        (test_user_id, 5, 'daily_streak', 'Daily prayer session', NOW() - INTERVAL '2 days'),
        (test_user_id, 5, 'daily_streak', 'Daily scripture reading', NOW() - INTERVAL '2 days'),
        (test_user_id, 5, 'daily_streak', 'Daily prayer session', NOW() - INTERVAL '3 days'),
        (test_user_id, 5, 'daily_streak', 'Daily scripture reading', NOW() - INTERVAL '4 days'),
        (test_user_id, 5, 'daily_streak', 'Daily prayer session', NOW() - INTERVAL '5 days');
        
        -- Playbook activities
        INSERT INTO public.faith_points_log (user_id, points, activity_type, reason, created_at) VALUES
        (test_user_id, 10, 'playbook_generated', 'Generated new playbook', NOW() - INTERVAL '2 days'),
        (test_user_id, 3, 'action_step_completed', 'Completed playbook step', NOW() - INTERVAL '1 day'),
        (test_user_id, 3, 'action_step_completed', 'Completed playbook step', NOW() - INTERVAL '2 days'),
        (test_user_id, 3, 'action_step_completed', 'Completed playbook step', NOW() - INTERVAL '3 days');
        
        -- Devotional activities
        INSERT INTO public.faith_points_log (user_id, points, activity_type, reason, created_at) VALUES
        (test_user_id, 8, 'devotional_generated', 'Generated new devotional', NOW() - INTERVAL '1 day'),
        (test_user_id, 8, 'devotional_generated', 'Generated new devotional', NOW() - INTERVAL '4 days');
        
        -- Add some previous week data for comparison
        INSERT INTO public.faith_points_log (user_id, points, activity_type, reason, created_at) VALUES
        (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '8 days'),
        (test_user_id, 5, 'journal_entry', 'Daily journal reflection', NOW() - INTERVAL '9 days'),
        (test_user_id, 5, 'daily_streak', 'Daily prayer session', NOW() - INTERVAL '8 days'),
        (test_user_id, 5, 'daily_streak', 'Daily prayer session', NOW() - INTERVAL '10 days'),
        (test_user_id, 3, 'action_step_completed', 'Completed playbook step', NOW() - INTERVAL '9 days');
        
        RAISE NOTICE 'Test data inserted successfully for user: %', test_user_id;
    ELSE
        RAISE NOTICE 'No user found in auth.users table';
    END IF;
END $$;

-- Create or update faith points profile for the user
DO $$
DECLARE
    test_user_id uuid;
    total_points_calc integer;
BEGIN
    -- Get the first user ID from auth.users
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Calculate total points for this user
        SELECT COALESCE(SUM(points), 0) INTO total_points_calc 
        FROM public.faith_points_log 
        WHERE user_id = test_user_id;
        
        -- Insert or update faith points profile
        INSERT INTO public.faith_points_profiles (
            user_id, 
            total_points, 
            current_level, 
            current_streak, 
            longest_streak,
            weekly_goal,
            weekly_progress
        ) VALUES (
            test_user_id,
            total_points_calc,
            CASE 
                WHEN total_points_calc >= 300 THEN 3
                WHEN total_points_calc >= 100 THEN 2
                ELSE 1
            END,
            5, -- current streak
            7, -- longest streak
            50, -- weekly goal
            total_points_calc -- weekly progress
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
            total_points = total_points_calc,
            current_level = CASE 
                WHEN total_points_calc >= 300 THEN 3
                WHEN total_points_calc >= 100 THEN 2
                ELSE 1
            END,
            updated_at = NOW();
            
        RAISE NOTICE 'Faith points profile updated for user: % with % points', test_user_id, total_points_calc;
    END IF;
END $$;

-- Add some test playbooks with affirmations and verses
-- First, let's check what columns exist in the playbooks table
SELECT 'Checking playbooks table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'playbooks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

DO $$
DECLARE
    test_user_id uuid;
    playbook_id uuid;
BEGIN
    -- Get the first user ID from auth.users
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Insert test playbook with minimal required columns
        INSERT INTO public.playbooks (
            title,
            affirmations,
            content
        ) VALUES (
            'Daily Spiritual Growth',
            '[
                "I am blessed and highly favored by God",
                "God''s love surrounds me every day",
                "I trust in God''s perfect timing for my life",
                "I am fearfully and wonderfully made",
                "God''s grace is sufficient for me"
            ]'::jsonb,
            '{
                "verses": [
                    {
                        "verse": "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, to give you hope and a future.",
                        "reference": "Jeremiah 29:11"
                    },
                    {
                        "verse": "I can do all things through Christ who strengthens me.",
                        "reference": "Philippians 4:13"
                    },
                    {
                        "verse": "The Lord your God is with you, the Mighty Warrior who saves.",
                        "reference": "Zephaniah 3:17"
                    }
                ],
                "actionSteps": [
                    {
                        "title": "Morning Prayer",
                        "description": "Start your day with prayer and gratitude",
                        "scripture": {
                            "verse": "Give thanks to the Lord, for he is good; his love endures forever.",
                            "reference": "Psalm 107:1"
                        }
                    }
                ]
            }'::jsonb
        ) RETURNING id INTO playbook_id;
        
        RAISE NOTICE 'Test playbook created with ID: %', playbook_id;
    ELSE
        RAISE NOTICE 'No user found in auth.users table';
    END IF;
END $$;

SELECT 'Test data setup completed!' as status;
