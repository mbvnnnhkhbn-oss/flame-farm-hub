
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS join_bonus integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS day1_bonus integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS day2_bonus integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS join_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS day1_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS day2_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lifetime_commission bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pending bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referred_joined_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date;

UPDATE public.settings
SET value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
  'invite_bonus', 25,
  'join_bonus', 25,
  'day1_bonus', 50,
  'day2_bonus', 75,
  'day1_ads_required', 10,
  'day2_ads_required', 10,
  'commission_pct', 5
)
WHERE key = 'referral';

INSERT INTO public.settings(key, value)
SELECT 'referral', jsonb_build_object(
  'invite_bonus', 25,
  'join_bonus', 25,
  'day1_bonus', 50,
  'day2_bonus', 75,
  'day1_ads_required', 10,
  'day2_ads_required', 10,
  'commission_pct', 5
)
WHERE NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'referral');
