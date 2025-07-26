-- SQL script to recreate the devotionals table with correct schema
-- Run this in your Supabase SQL editor

-- Drop the existing devotionals table (this will delete all existing data)
DROP TABLE IF EXISTS devotionals CASCADE;

-- Create the new devotionals table with correct schema
CREATE TABLE devotionals (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User relationship
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic information
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    
    -- Category and classification with check constraint for valid values
    category TEXT NOT NULL CHECK (category IN (
        'Prayer', 'Growth', 'Healing', 'Wisdom', 'Relationships', 
        'Purpose', 'Career', 'Finances', 'Mental Health', 'Parenting', 'Health'
    )) DEFAULT 'Growth',
    categories TEXT[] DEFAULT ARRAY['Growth'],
    
    -- Playbook relationship
    playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    playbook_title TEXT,
    user_input TEXT, -- Store the user input from the playbook
    
    -- Progress tracking
    total_days INTEGER NOT NULL DEFAULT 1,
    current_day INTEGER NOT NULL DEFAULT 1,
    progress DECIMAL(5,2) NOT NULL DEFAULT 0.0 CHECK (progress >= 0 AND progress <= 100),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    
    -- Content (JSON array of devotional days)
    days JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- User feedback
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    rated_at TIMESTAMPTZ,
    feedback TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_devotionals_user_id ON devotionals(user_id);
CREATE INDEX idx_devotionals_playbook_id ON devotionals(playbook_id);
CREATE INDEX idx_devotionals_category ON devotionals(category);
CREATE INDEX idx_devotionals_completed ON devotionals(completed);
CREATE INDEX idx_devotionals_created_at ON devotionals(created_at DESC);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_devotionals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at on row updates
CREATE TRIGGER trigger_devotionals_updated_at
    BEFORE UPDATE ON devotionals
    FOR EACH ROW
    EXECUTE FUNCTION update_devotionals_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE devotionals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own devotionals
CREATE POLICY "Users can view their own devotionals" ON devotionals
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own devotionals
CREATE POLICY "Users can insert their own devotionals" ON devotionals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own devotionals
CREATE POLICY "Users can update their own devotionals" ON devotionals
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own devotionals
CREATE POLICY "Users can delete their own devotionals" ON devotionals
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON devotionals TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE devotionals IS 'Stores user devotionals with progress tracking and content';
COMMENT ON COLUMN devotionals.category IS 'Primary category from predefined list';
COMMENT ON COLUMN devotionals.categories IS 'Array of categories for multi-classification';
COMMENT ON COLUMN devotionals.user_input IS 'Original user input from playbook that generated this devotional';
COMMENT ON COLUMN devotionals.days IS 'JSON array containing the devotional content for each day';
COMMENT ON COLUMN devotionals.progress IS 'Completion percentage (0-100)';
COMMENT ON COLUMN devotionals.total_days IS 'Total number of days in the devotional';
COMMENT ON COLUMN devotionals.current_day IS 'Current day the user is on (1-based)';
