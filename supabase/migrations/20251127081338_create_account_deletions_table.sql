-- Create table for tracking account deletions with grace period
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_year integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  grace_period_ends timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  confirmation_token text,
  user_email text,
  user_metadata jsonb,
  deletion_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_deletions_user_id ON public.account_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletions_status ON public.account_deletions(status);
CREATE INDEX IF NOT EXISTS idx_account_deletions_grace_period_ends ON public.account_deletions(grace_period_ends);
CREATE INDEX IF NOT EXISTS idx_account_deletions_requested_at ON public.account_deletions(requested_at);

-- Create RLS policies
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own deletion requests
CREATE POLICY "Users can view own account deletions" ON public.account_deletions
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own deletion requests
CREATE POLICY "Users can insert own account deletions" ON public.account_deletions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access for automated processing
CREATE POLICY "Service role full access" ON public.account_deletions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_account_deletions_updated_at
  BEFORE UPDATE ON public.account_deletions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.account_deletions IS 'Tracks account deletion requests with grace period and audit trail';
COMMENT ON COLUMN public.account_deletions.id IS 'Unique identifier for the deletion request';
COMMENT ON COLUMN public.account_deletions.user_id IS 'Reference to the user being deleted';
COMMENT ON COLUMN public.account_deletions.birth_year IS 'Birth year for verification (age verification)';
COMMENT ON COLUMN public.account_deletions.status IS 'Current status: pending, completed, failed, cancelled';
COMMENT ON COLUMN public.account_deletions.grace_period_ends IS 'When the grace period ends and deletion becomes final';
COMMENT ON COLUMN public.account_deletions.requested_at IS 'When the deletion was initially requested';
COMMENT ON COLUMN public.account_deletions.completed_at IS 'When the deletion was completed/failed/cancelled';
COMMENT ON COLUMN public.account_deletions.confirmation_token IS 'Optional token for additional verification';
COMMENT ON COLUMN public.account_deletions.user_email IS 'Email of user for audit purposes';
COMMENT ON COLUMN public.account_deletions.user_metadata IS 'Metadata snapshot for audit purposes';
COMMENT ON COLUMN public.account_deletions.deletion_notes IS 'Notes about the deletion process or failure reasons';
