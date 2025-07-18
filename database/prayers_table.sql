-- Prayer Journal Database Schema
-- This table stores all prayer entries including journal prayers, people prayers, and devotional prayers

CREATE TABLE IF NOT EXISTS prayers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core prayer data
  title TEXT, -- For prayer journal entries (can be null for people prayers)
  content TEXT NOT NULL, -- Prayer text content
  prayer_type TEXT NOT NULL CHECK (prayer_type IN ('journal', 'people', 'devotional')),
  
  -- Prayer Journal specific fields (ACTS model)
  journal_category TEXT CHECK (journal_category IN ('adoration', 'confession', 'thanksgiving', 'supplication')),
  status TEXT CHECK (status IN ('pending', 'answered')),
  answered_date TIMESTAMPTZ,
  
  -- People Prayer specific fields
  person_name TEXT, -- Name of person being prayed for
  is_prayer_request BOOLEAN DEFAULT FALSE, -- True if this is a prayer request, false if personal prayer
  requested_by TEXT, -- Who requested this prayer
  prayed BOOLEAN DEFAULT FALSE, -- Whether this prayer has been prayed
  notes TEXT, -- Additional notes
  
  -- Devotional Prayer specific fields
  devotional_title TEXT, -- Title of the devotional
  day_number INTEGER, -- Day number in devotional
  day_title TEXT, -- Title of the day
  total_days INTEGER, -- Total days in devotional
  question_number INTEGER, -- Question number if applicable
  
  -- Date and metadata
  selected_date DATE NOT NULL, -- The date this prayer is associated with
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  
  -- Indexes for performance
  CONSTRAINT prayers_user_date_idx UNIQUE (user_id, id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS prayers_user_id_idx ON prayers(user_id);
CREATE INDEX IF NOT EXISTS prayers_selected_date_idx ON prayers(selected_date);
CREATE INDEX IF NOT EXISTS prayers_type_idx ON prayers(prayer_type);
CREATE INDEX IF NOT EXISTS prayers_user_date_type_idx ON prayers(user_id, selected_date, prayer_type);
CREATE INDEX IF NOT EXISTS prayers_person_name_idx ON prayers(person_name) WHERE prayer_type = 'people';
CREATE INDEX IF NOT EXISTS prayers_devotional_idx ON prayers(devotional_title, day_number) WHERE prayer_type = 'devotional';

-- Enable Row Level Security
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own prayers" ON prayers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prayers" ON prayers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prayers" ON prayers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prayers" ON prayers
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_prayers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prayers_updated_at_trigger
  BEFORE UPDATE ON prayers
  FOR EACH ROW
  EXECUTE FUNCTION update_prayers_updated_at();
