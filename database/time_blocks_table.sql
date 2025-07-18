-- Create time_blocks table for storing user time blocks/calendar events
CREATE TABLE IF NOT EXISTS public.time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  location text,
  category text NOT NULL,
  repeat jsonb,              -- For storing repeat rules (frequency, endDate, customDays, etc.)
  repeat_until date,         -- For recurring end date (optional, for SQL filtering)
  notes text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT time_blocks_user_date_start_unique UNIQUE (user_id, selected_date, start_time),
  CONSTRAINT time_blocks_start_before_end CHECK (start_time < end_time OR all_day = true),
  CONSTRAINT time_blocks_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT time_blocks_category_not_empty CHECK (length(trim(category)) > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date ON public.time_blocks(user_id, selected_date);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date_time ON public.time_blocks(user_id, selected_date, start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_category ON public.time_blocks(category);
CREATE INDEX IF NOT EXISTS idx_time_blocks_created_at ON public.time_blocks(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own time blocks" ON public.time_blocks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time blocks" ON public.time_blocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time blocks" ON public.time_blocks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time blocks" ON public.time_blocks
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_time_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_blocks_updated_at_trigger
  BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_time_blocks_updated_at();
