-- Fix RLS permissions for family tables
-- Run this in Supabase SQL Editor

-- Add missing trigger for family_members updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to family_members if it has updated_at column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'family_members' 
        AND column_name = 'updated_at'
    ) THEN
        DROP TRIGGER IF EXISTS update_family_members_updated_at ON family_members;
        CREATE TRIGGER update_family_members_updated_at 
            BEFORE UPDATE ON family_members 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Add trigger to family_subscription_groups
DROP TRIGGER IF EXISTS update_family_subscription_groups_updated_at ON family_subscription_groups;
CREATE TRIGGER update_family_subscription_groups_updated_at 
    BEFORE UPDATE ON family_subscription_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Family admin can manage group" ON family_subscription_groups;
DROP POLICY IF EXISTS "Family members can view group" ON family_subscription_groups;
DROP POLICY IF EXISTS "Family admin can manage members" ON family_members;
DROP POLICY IF EXISTS "Users can view own family membership" ON family_members;

-- Create more permissive policies for testing
CREATE POLICY "Allow authenticated users to read family groups" ON family_subscription_groups
    FOR SELECT USING (true);

CREATE POLICY "Family admin can manage group" ON family_subscription_groups
    FOR ALL USING (auth.uid() = admin_user_id);

CREATE POLICY "Allow authenticated users to read family members" ON family_members
    FOR SELECT USING (true);

CREATE POLICY "Family admin can manage members" ON family_members
    FOR ALL USING (
        family_group_id IN (
            SELECT id FROM family_subscription_groups 
            WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own family membership" ON family_members
    FOR SELECT USING (auth.uid() = user_id);

-- Ensure proper grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON family_subscription_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_members TO authenticated;

-- Test query to verify tables exist
SELECT 
    'family_subscription_groups' as table_name,
    COUNT(*) as row_count
FROM family_subscription_groups
UNION ALL
SELECT 
    'family_members' as table_name,
    COUNT(*) as row_count
FROM family_members;
