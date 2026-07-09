
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.task_type AS ENUM ('telegram_join','telegram_group','bot_start','website','social_follow','youtube','quiz','survey','app_download');
CREATE TYPE public.task_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.withdraw_status AS ENUM ('pending','approved','rejected');

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  language_code TEXT,
  is_premium BOOLEAN DEFAULT false,
  balance BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  today_earned BIGINT NOT NULL DEFAULT 0,
  today_date DATE DEFAULT CURRENT_DATE,
  streak_day INT NOT NULL DEFAULT 0,
  last_checkin_date DATE,
  wallet_address TEXT,
  referred_by UUID REFERENCES public.profiles(id),
  banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_read_public_leaderboard" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Daily check-ins
CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_day INT NOT NULL,
  reward BIGINT NOT NULL,
  claimed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, claimed_date)
);
GRANT SELECT, INSERT ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins_self_read" ON public.daily_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Ads history
CREATE TABLE public.ads_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward BIGINT NOT NULL,
  provider TEXT DEFAULT 'adsgram',
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ads_history_user_time ON public.ads_history(user_id, watched_at DESC);
GRANT SELECT ON public.ads_history TO authenticated;
GRANT ALL ON public.ads_history TO service_role;
ALTER TABLE public.ads_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_self_read" ON public.ads_history FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type task_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward BIGINT NOT NULL,
  target_url TEXT,
  target_chat TEXT,
  verification_type TEXT DEFAULT 'manual',
  priority INT DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_read_active" ON public.tasks FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "tasks_admin_all" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Task completions
CREATE TABLE public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'pending',
  reward BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);
GRANT SELECT ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_self_read" ON public.task_completions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "tc_admin_all" ON public.task_completions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Referrals
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bonus_paid BOOLEAN NOT NULL DEFAULT false,
  bonus_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_read_mine" ON public.referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- Withdrawals
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_flames BIGINT NOT NULL,
  amount_usdt NUMERIC(18,6) NOT NULL,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'BEP20',
  status withdraw_status NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wd_self_read" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wd_self_insert" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "wd_admin_all" ON public.withdrawals FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER wd_updated BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_read_active" ON public.announcements FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "ann_admin_all" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_self_read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "notif_self_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Settings
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed default settings
INSERT INTO public.settings(key,value) VALUES
  ('economy', '{"flames_per_usdt": 100000, "min_withdraw_usdt": 1, "max_withdraw_usdt": 100}'::jsonb),
  ('ads', '{"reward_per_ad": 500, "daily_limit": 30, "cooldown_seconds": 30}'::jsonb),
  ('daily_rewards', '{"1":100,"2":150,"3":250,"4":400,"5":600,"6":800,"7":1000}'::jsonb),
  ('referral', '{"invite_bonus": 1000, "commission_pct": 10}'::jsonb),
  ('app', '{"bot_username": "CoinFlamesBot", "support_url": "https://t.me/coinflames_support"}'::jsonb);

-- Seed sample tasks
INSERT INTO public.tasks(type,title,description,reward,target_url,target_chat) VALUES
  ('telegram_join','Join CoinFlames Channel','Stay up to date with news and events',1000,'https://t.me/coinflames','@coinflames'),
  ('telegram_group','Join Community Chat','Meet other CoinFlames earners',800,'https://t.me/coinflameschat','@coinflameschat'),
  ('social_follow','Follow us on X','Follow the official CoinFlames account',500,'https://x.com/coinflames',NULL),
  ('website','Visit CoinFlames Site','Check out our latest updates',300,'https://coinflames.app',NULL);
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
UPDATE public.settings
SET value = value || '{"block_id": "", "verify_server": false}'::jsonb,
    updated_at = now()
WHERE key = 'ads';

INSERT INTO public.settings(key, value) VALUES
  ('admin_bootstrap', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- IP tracking + suspension + last open bonus timestamp
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_ip text,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspend_reason text,
  ADD COLUMN IF NOT EXISTS last_open_bonus_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip ON public.profiles(signup_ip);

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
WHERE key = 'economy';-- Mining packages
CREATE TABLE public.mining_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hourly_reward integer NOT NULL,
  ads_required integer NOT NULL DEFAULT 1,
  daily_claim_limit integer NOT NULL DEFAULT 10,
  cooldown_seconds integer NOT NULL DEFAULT 3600,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mining_packages TO authenticated;
GRANT SELECT ON public.mining_packages TO anon;
GRANT ALL ON public.mining_packages TO service_role;

ALTER TABLE public.mining_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_public_read" ON public.mining_packages
  FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "packages_admin_all" ON public.mining_packages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER mining_packages_updated
BEFORE UPDATE ON public.mining_packages
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- User mining state (one row per user per package)
CREATE TABLE public.user_mining (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.mining_packages(id) ON DELETE CASCADE,
  last_claim_at timestamptz,
  next_claim_at timestamptz,
  claims_today integer NOT NULL DEFAULT 0,
  claims_date date NOT NULL DEFAULT CURRENT_DATE,
  ads_watched integer NOT NULL DEFAULT 0,
  notified_ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, package_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mining TO authenticated;
GRANT ALL ON public.user_mining TO service_role;

ALTER TABLE public.user_mining ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_mining_own" ON public.user_mining
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_mining_admin" ON public.user_mining
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER user_mining_updated
BEFORE UPDATE ON public.user_mining
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX user_mining_next_claim_idx ON public.user_mining (next_claim_at) WHERE notified_ready = false;

-- Claim history (audit)
CREATE TABLE public.mining_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.mining_packages(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mining_claims TO authenticated;
GRANT ALL ON public.mining_claims TO service_role;

ALTER TABLE public.mining_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mining_claims_own_read" ON public.mining_claims
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mining_claims_own_write" ON public.mining_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed default packages
INSERT INTO public.mining_packages (name, hourly_reward, ads_required, daily_claim_limit, sort_order) VALUES
  ('Starter', 20, 1, 10, 1),
  ('Bronze', 30, 2, 10, 2),
  ('Silver', 50, 3, 10, 3),
  ('Gold', 100, 5, 10, 4);
