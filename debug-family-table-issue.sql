-- Debug script to check what's preventing family table creation
-- Run this in Supabase SQL Editor to diagnose the issue

-- Check if required enums exist
SELECT 
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('payment_platform', 'subscription_status', 'family_role', 'subscription_tier_new')
GROUP BY t.typname
ORDER BY t.typname;

-- Check if family tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('family_subscription_groups', 'family_members');

-- Try to create the enums first if they don't exist
DO $$ BEGIN
    CREATE TYPE payment_platform AS ENUM (
        'apple',
        'google',
        'local_test'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM (
        'active',
        'cancelled', 
        'expired',
        'pending_payment',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE family_role AS ENUM (
        'admin',
        'parent',
        'teen',
        'child'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Now try to create the family tables with explicit error handling
DO $$
BEGIN
    -- Try to create family_subscription_groups table
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
    
    RAISE NOTICE 'Successfully created family_subscription_groups table';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating family_subscription_groups: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Try to create family_members table
    CREATE TABLE IF NOT EXISTS family_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        family_group_id uuid NOT NULL REFERENCES family_subscription_groups(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        role family_role NOT NULL DEFAULT 'child',
        joined_at timestamptz NOT NULL DEFAULT now(),
        
        UNIQUE(family_group_id, user_id)
    );
    
    RAISE NOTICE 'Successfully created family_members table';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating family_members: %', SQLERRM;
END $$;
