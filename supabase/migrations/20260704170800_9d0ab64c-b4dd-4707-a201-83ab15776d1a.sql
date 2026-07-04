
-- IP tracking + suspension + last open bonus timestamp
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_ip text,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspend_reason text,
  ADD COLUMN IF NOT EXISTS last_open_bonus_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip ON public.profiles(signup_ip);
