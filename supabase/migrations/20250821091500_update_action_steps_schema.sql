-- Migration: update_action_steps_schema
-- Adds fields to support enhanced UI/UX for unfinished steps and intelligent ranking
-- Tables affected: public.playbook_action_steps

BEGIN;

-- Priority: high | medium | low (default medium)
ALTER TABLE public.playbook_action_steps
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium'::text;

-- Constrain allowed values for priority
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'playbook_action_steps_priority_check'
  ) THEN
    ALTER TABLE public.playbook_action_steps
      ADD CONSTRAINT playbook_action_steps_priority_check
      CHECK (priority IN ('high','medium','low'));
  END IF;
END $$;

COMMENT ON COLUMN public.playbook_action_steps.priority IS 'Relative urgency: high | medium | low';

-- Due date for scheduling nudges
ALTER TABLE public.playbook_action_steps
  ADD COLUMN IF NOT EXISTS due_date date;

COMMENT ON COLUMN public.playbook_action_steps.due_date IS 'Optional due date for the action step';

-- Estimated minutes to complete
ALTER TABLE public.playbook_action_steps
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'playbook_action_steps_estimated_minutes_check'
  ) THEN
    ALTER TABLE public.playbook_action_steps
      ADD CONSTRAINT playbook_action_steps_estimated_minutes_check
      CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.playbook_action_steps.estimated_minutes IS 'Rough duration estimate for completion';

-- Difficulty (1-5)
ALTER TABLE public.playbook_action_steps
  ADD COLUMN IF NOT EXISTS difficulty integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'playbook_action_steps_difficulty_check'
  ) THEN
    ALTER TABLE public.playbook_action_steps
      ADD CONSTRAINT playbook_action_steps_difficulty_check
      CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 5));
  END IF;
END $$;

COMMENT ON COLUMN public.playbook_action_steps.difficulty IS 'Relative difficulty from 1 (easy) to 5 (hard)';

-- Optional dependency on another step
ALTER TABLE public.playbook_action_steps
  ADD COLUMN IF NOT EXISTS depends_on_step_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'playbook_action_steps_depends_on_fk'
  ) THEN
    ALTER TABLE public.playbook_action_steps
      ADD CONSTRAINT playbook_action_steps_depends_on_fk
      FOREIGN KEY (depends_on_step_id)
      REFERENCES public.playbook_action_steps(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.playbook_action_steps.depends_on_step_id IS 'If set, this step is blocked until the referenced step is completed';

-- Freeform blockers text
ALTER TABLE public.playbook_action_steps
  ADD COLUMN IF NOT EXISTS blockers text;

COMMENT ON COLUMN public.playbook_action_steps.blockers IS 'User-noted blockers preventing completion';

-- Impact score (1-10) for ranking
ALTER TABLE public.playbook_action_steps
  ADD COLUMN IF NOT EXISTS impact_score integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'playbook_action_steps_impact_score_check'
  ) THEN
    ALTER TABLE public.playbook_action_steps
      ADD CONSTRAINT playbook_action_steps_impact_score_check
      CHECK (impact_score IS NULL OR (impact_score >= 1 AND impact_score <= 10));
  END IF;
END $$;

COMMENT ON COLUMN public.playbook_action_steps.impact_score IS 'Relative impact (1-10) used for next-best-step ranking';

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_action_steps_playbook_completed
  ON public.playbook_action_steps (playbook_id, completed);

CREATE INDEX IF NOT EXISTS idx_action_steps_due_date
  ON public.playbook_action_steps (due_date)
  WHERE completed = false;

CREATE INDEX IF NOT EXISTS idx_action_steps_priority
  ON public.playbook_action_steps (priority)
  WHERE completed = false;

COMMIT;
