-- Add missing columns to time_blocks table
-- Safe to run multiple times
ALTER TABLE public.time_blocks
ADD COLUMN IF NOT EXISTS calendar_event_id text,
ADD COLUMN IF NOT EXISTS repeat_frequency text,
ADD COLUMN IF NOT EXISTS repeat_custom_frequency integer,
ADD COLUMN IF NOT EXISTS repeat_end_date text,
ADD COLUMN IF NOT EXISTS repeat_until text,
ADD COLUMN IF NOT EXISTS timezone text,
ADD COLUMN IF NOT EXISTS is_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Optional: simple index to speed up lookups/updates by event id
CREATE INDEX IF NOT EXISTS idx_time_blocks_calendar_event_id
ON public.time_blocks (calendar_event_id);
