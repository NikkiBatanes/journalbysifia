-- Fix Database Schema Issues
-- Run this script in Supabase SQL Editor

-- 1. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 2. Check current table structures
SELECT 'faith_points_log columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'faith_points_log' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'playbooks columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'playbooks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Ensure faith_points_log has correct structure
DO $$
BEGIN
    -- Check if points column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'faith_points_log' 
        AND column_name = 'points' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.faith_points_log ADD COLUMN points integer NOT NULL DEFAULT 0;
    END IF;
    
    -- Check if activity_type column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'faith_points_log' 
        AND column_name = 'activity_type' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.faith_points_log ADD COLUMN activity_type text NOT NULL DEFAULT '';
    END IF;
    
    -- Check if reason column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'faith_points_log' 
        AND column_name = 'reason' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.faith_points_log ADD COLUMN reason text;
    END IF;
END $$;

-- 4. Ensure playbooks table has affirmations column
DO $$
BEGIN
    -- Check if affirmations column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' 
        AND column_name = 'affirmations' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.playbooks ADD COLUMN affirmations jsonb;
    END IF;
END $$;

-- 5. Update RLS policies to allow service operations
DROP POLICY IF EXISTS "Service role can manage profiles" ON faith_points_profiles;
CREATE POLICY "Service role can manage profiles" ON faith_points_profiles
    FOR ALL 
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage transactions" ON faith_points_log;
CREATE POLICY "Service role can manage transactions" ON faith_points_log
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- 6. Grant permissions
GRANT ALL ON public.faith_points_profiles TO authenticated, anon, service_role;
GRANT ALL ON public.faith_points_log TO authenticated, anon, service_role;
GRANT ALL ON public.playbooks TO authenticated, anon, service_role;

-- 7. Refresh schema cache again
NOTIFY pgrst, 'reload schema';

-- 8. Test queries to verify everything works
SELECT 'Testing faith_points_log insert...' as test;
INSERT INTO public.faith_points_log (user_id, points, activity_type, reason) 
VALUES ('00000000-0000-0000-0000-000000000000', 10, 'test', 'schema_test')
ON CONFLICT DO NOTHING;

SELECT 'Testing playbooks affirmations...' as test;
SELECT id, title, affirmations FROM public.playbooks LIMIT 1;

SELECT 'Schema fix completed successfully!' as status;
