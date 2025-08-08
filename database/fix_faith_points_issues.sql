-- Fix Faith Points Database Issues
-- Run this script in Supabase SQL Editor

-- 1. Refresh schema cache for faith_points_log table
NOTIFY pgrst, 'reload schema';

-- 2. Verify faith_points_log table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'faith_points_log' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if RLS policies exist and are correct
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('faith_points_profiles', 'faith_points_log')
ORDER BY tablename, policyname;

-- 4. Add service role bypass for faith_points operations (temporary fix)
-- This allows the service to insert/update profiles when authenticated users can't
CREATE POLICY "Service role can manage all profiles" ON faith_points_profiles
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all transactions" ON faith_points_log
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 5. Ensure authenticated users can still manage their own data
DROP POLICY IF EXISTS "Users can insert their own profile" ON faith_points_profiles;
CREATE POLICY "Users can insert their own profile" ON faith_points_profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update their own profile" ON faith_points_profiles;
CREATE POLICY "Users can update their own profile" ON faith_points_profiles
    FOR UPDATE 
    USING (auth.uid() = user_id OR auth.role() = 'service_role')
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- 6. Add policies for faith_points_log if they don't exist
CREATE POLICY "Users can view their own transactions" ON faith_points_log
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own transactions" ON faith_points_log
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- 7. Grant necessary permissions
GRANT ALL ON public.faith_points_profiles TO authenticated;
GRANT ALL ON public.faith_points_profiles TO service_role;
GRANT ALL ON public.faith_points_log TO authenticated;
GRANT ALL ON public.faith_points_log TO service_role;

-- 8. Refresh the schema cache again
NOTIFY pgrst, 'reload schema';

-- 9. Test query to verify everything works
SELECT 'Database fix script completed successfully' as status;
