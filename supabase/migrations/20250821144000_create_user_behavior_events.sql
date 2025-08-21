-- Migration: create_user_behavior_events
-- Purpose: Track granular user analytics for action step interactions

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  playbook_id uuid,
  step_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_behavior_events IS 'Analytics events for user interactions across the app';
COMMENT ON COLUMN public.user_behavior_events.event_type IS 'e.g., view_step, start_step, snooze_step, complete_step, abandon_step, view_example';

CREATE INDEX IF NOT EXISTS idx_ube_user_time ON public.user_behavior_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ube_event_type ON public.user_behavior_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ube_step ON public.user_behavior_events (step_id);

COMMIT;
