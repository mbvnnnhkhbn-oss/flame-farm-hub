-- Reward code system
CREATE TABLE IF NOT EXISTS public.reward_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  reward bigint NOT NULL DEFAULT 0,
  max_claims integer,
  per_user_limit integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_codes TO authenticated;
GRANT ALL ON public.reward_codes TO service_role;
ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "reward_codes_read_active_or_admin" ON public.reward_codes
    FOR SELECT TO authenticated
    USING (active = true OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "reward_codes_admin_all" ON public.reward_codes
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS reward_codes_updated ON public.reward_codes;
CREATE TRIGGER reward_codes_updated BEFORE UPDATE ON public.reward_codes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.reward_code_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.reward_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward bigint NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)
);
GRANT SELECT ON public.reward_code_claims TO authenticated;
GRANT ALL ON public.reward_code_claims TO service_role;
ALTER TABLE public.reward_code_claims ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "reward_code_claims_self_read" ON public.reward_code_claims
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "reward_code_claims_admin_all" ON public.reward_code_claims
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_reward_code_claims_user ON public.reward_code_claims(user_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_code_claims_code ON public.reward_code_claims(code_id);

-- Withdrawal fee/net fields for payment proof and channel posting
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fee_usdt numeric(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_usdt numeric(18,6);

UPDATE public.withdrawals
SET net_usdt = amount_usdt - fee_usdt
WHERE net_usdt IS NULL;

-- Default operational settings for requested channels, AdsGram blocks, economy and daily rewards
INSERT INTO public.settings(key, value) VALUES
  ('reward_codes', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE public.settings
SET value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
  'bot_username', 'Coinflamesbot',
  'start_app_name', 'coinflames',
  'admin_chat_id', '5419054691',
  'community_url', 'https://t.me/CoinFlames',
  'community_chat_id', '@CoinFlames',
  'payment_channel_url', 'https://t.me/coinflamespayment',
  'payment_channel_chat_id', '@coinflamespayment'
),
updated_at = now()
WHERE key = 'app';

UPDATE public.settings
SET value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
  'reward_per_ad', 10,
  'daily_limit', 10,
  'cooldown_seconds', 30,
  'block_id_reward', '37178',
  'block_id_interstitial', 'int-37179',
  'watch_seconds_reward', 30,
  'watch_seconds_interstitial', 15
),
updated_at = now()
WHERE key = 'ads';

UPDATE public.settings
SET value = jsonb_build_object('1', 10, '2', 10, '3', 10, '4', 10, '5', 10, '6', 10, '7', 10),
updated_at = now()
WHERE key = 'daily_rewards';

UPDATE public.settings
SET value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
  'flames_per_usdt', 10000,
  'min_withdraw_usdt', 1,
  'max_withdraw_usdt', 100,
  'withdraw_fee_flat_usdt', 0.01,
  'withdraw_fee_pct', 5
),
updated_at = now()
WHERE key = 'economy';