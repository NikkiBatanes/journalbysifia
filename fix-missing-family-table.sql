-- Fix for missing family_subscription_groups table
-- Run this in Supabase SQL Editor if the table is missing

-- Create family_subscription_groups table
CREATE TABLE IF NOT EXISTS family_subscription_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_name text NOT NULL,
    max_members integer NOT NULL DEFAULT 6,
    current_members integer NOT NULL DEFAULT 1,
    
    -- Payment info
    platform payment_platform DEFAULT 'local_test',
    platform_subscription_id text,
    
    status subscription_status NOT NULL DEFAULT 'active',
    metadata jsonb DEFAULT '{}',
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CHECK (current_members <= max_members),
    CHECK (current_members >= 0),
    CHECK (max_members > 0)
);

-- Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id uuid NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role family_role NOT NULL DEFAULT 'child',
    joined_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(family_group_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_family_subscription_groups_admin ON family_subscription_groups(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_group_id ON family_members(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);

-- Enable RLS
ALTER TABLE family_subscription_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for family_subscription_groups
DROP POLICY IF EXISTS "Family admin can manage group" ON family_subscription_groups;
CREATE POLICY "Family admin can manage group" ON family_subscription_groups
    FOR ALL USING (auth.uid() = admin_user_id);

DROP POLICY IF EXISTS "Family members can view group" ON family_subscription_groups;
CREATE POLICY "Family members can view group" ON family_subscription_groups
    FOR SELECT USING (
        id IN (
            SELECT family_group_id FROM family_members 
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for family_members
DROP POLICY IF EXISTS "Family admin can manage members" ON family_members;
CREATE POLICY "Family admin can manage members" ON family_members
    FOR ALL USING (
        family_group_id IN (
            SELECT id FROM family_subscription_groups 
            WHERE admin_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view own family membership" ON family_members;
CREATE POLICY "Users can view own family membership" ON family_members
    FOR SELECT USING (auth.uid() = user_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_family_subscription_groups_updated_at ON family_subscription_groups;
CREATE TRIGGER update_family_subscription_groups_updated_at 
    BEFORE UPDATE ON family_subscription_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON family_subscription_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_members TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Family subscription tables created successfully!';
END
$$;
