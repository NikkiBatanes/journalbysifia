-- Playbook refinements and lightweight memory support.
-- Run this manually in Supabase when you are ready.

ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS refinement_count INTEGER NOT NULL DEFAULT 0 CHECK (refinement_count >= 0),
  ADD COLUMN IF NOT EXISTS last_refined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_version INTEGER NOT NULL DEFAULT 1 CHECK (active_version >= 1),
  ADD COLUMN IF NOT EXISTS latest_refinement_note TEXT;

CREATE TABLE IF NOT EXISTS public.playbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  refinement_type TEXT,
  refinement_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(playbook_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_playbook_versions_playbook_id
  ON public.playbook_versions(playbook_id);

CREATE INDEX IF NOT EXISTS idx_playbook_versions_user_id
  ON public.playbook_versions(user_id);

CREATE TABLE IF NOT EXISTS public.playbook_refinement_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_version INTEGER NOT NULL CHECK (from_version >= 1),
  to_version INTEGER NOT NULL CHECK (to_version >= 1),
  correction_type TEXT NOT NULL,
  clarification TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_refinement_feedback_playbook_id
  ON public.playbook_refinement_feedback(playbook_id);

CREATE INDEX IF NOT EXISTS idx_playbook_refinement_feedback_user_id
  ON public.playbook_refinement_feedback(user_id);

CREATE TABLE IF NOT EXISTS public.user_memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL DEFAULT 'recurring_theme',
  topic TEXT NOT NULL,
  memory_text TEXT NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source_count INTEGER NOT NULL DEFAULT 1 CHECK (source_count >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, memory_type, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_memory_items_user_id_status
  ON public.user_memory_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_memory_items_topic
  ON public.user_memory_items(topic);

ALTER TABLE public.playbook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_refinement_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own playbook versions"
  ON public.playbook_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playbook versions"
  ON public.playbook_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own refinement feedback"
  ON public.playbook_refinement_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own refinement feedback"
  ON public.playbook_refinement_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own memory items"
  ON public.user_memory_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory items"
  ON public.user_memory_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory items"
  ON public.user_memory_items FOR UPDATE
  USING (auth.uid() = user_id);
