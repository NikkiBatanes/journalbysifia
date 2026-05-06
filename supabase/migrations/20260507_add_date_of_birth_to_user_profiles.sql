-- Store the user's birthday once, then calculate exact age at generation time.
-- Do not store age; it changes over time and should be derived from date_of_birth.

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN public.user_profiles.date_of_birth IS
  'User birthday used to calculate exact age for context-aware generation.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_date_of_birth
ON public.user_profiles(date_of_birth)
WHERE date_of_birth IS NOT NULL;
