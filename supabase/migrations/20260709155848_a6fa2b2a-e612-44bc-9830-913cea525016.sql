-- Mining packages
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
