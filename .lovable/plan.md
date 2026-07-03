# CoinFlames — Telegram Mini App Build Plan

මේක ලොකු scope එකක් නිසා එක turn එකකින් සම්පූර්ණයෙන් හදන්න බෑ. Phased approach එකකින් යමු. මුලින්ම **Phase 1 (MVP UI + Auth + DB)** හදනවා, ඊට පස්සේ ඔබේ feedback එකට අනුව අනිත් phases build කරනවා.

---

## Phase 1 — Foundation (මේ turn එකේ)

**Goal:** Telegram Mini App එක load වෙනවා, user auto-login වෙනවා, core screens navigate කරන්න පුළුවන්, database schema එක ready.

### Frontend (TanStack Start + Tailwind)
- Design system: dark theme, fire/gold gradient (orange → red → gold) matching CoinFlames logo
- Telegram WebApp SDK integrate (`window.Telegram.WebApp`)
- Bottom tab navigation: Home / Tasks / Earn / Referral / Profile
- Screens (UI + wiring, real data from DB):
  - Home (profile card, balance, today's earnings, withdraw button, announcements)
  - Daily Check-in (7-day streak grid)
  - Watch Ads (AdsGram placeholder, reward flow)
  - Tasks (list + verify button)
  - Referral (link + stats)
  - Withdraw (USDT BEP20 form + history)
  - Profile (info + settings)
  - History (tabs: ads/tasks/daily/withdraw/referral)
  - Leaderboard (top earners/referrers)

### Backend (Lovable Cloud = Supabase)
- Enable Lovable Cloud
- Auth: Telegram `initData` HMAC verification via server function
- Tables (with RLS + GRANTs):
  - `users` (telegram_id, username, first_name, photo_url, balance, total_earned, today_earned, referred_by, created_at)
  - `daily_checkins` (user_id, streak_day, claimed_at)
  - `ads_history` (user_id, reward, watched_at)
  - `tasks` (id, type, title, reward, target_url, verification_type, active, expires_at)
  - `task_completions` (user_id, task_id, status, completed_at)
  - `referrals` (referrer_id, referred_id, bonus_paid, created_at)
  - `withdrawals` (user_id, amount, wallet_address, status, tx_hash, created_at)
  - `announcements` (id, title, body, pinned, created_at)
  - `notifications` (user_id, title, body, read, created_at)
  - `settings` (key, value) — admin-editable economy config
  - `user_roles` (user_id, role) — admin role via separate table + `has_role()` security-definer

### Server functions
- `verifyTelegramAuth` — validates initData signature, upserts user, returns session
- `claimDailyCheckin`
- `claimAdReward` (with cooldown + daily limit)
- `completeTask` (with verification stub)
- `requestWithdrawal`
- `getLeaderboard`

---

## Phase 2 — Verification & Admin
- Telegram Bot API integration (channel join / bot start verification) via connector
- AdsGram SDK real integration + reward callback verification
- Admin panel at `/admin` (role-gated): users, tasks CRUD, withdrawals approve/reject, settings, announcements
- Notifications system

## Phase 3 — Anti-abuse & Withdrawals
- Rate limiting, multi-account detection (device + IP fingerprint)
- Withdraw approval workflow + CSV export
- Missions & weekly/monthly challenges
- Manual USDT payment tracking (auto-payment marked as Future)

## Phase 4 — Polish
- Multi-language (SI/EN)
- Push notifications via Telegram bot
- Analytics dashboard with charts

---

## Tech decisions (already made — no need to ask)
- **Frontend:** TanStack Start + React + TypeScript + Tailwind v4 (project template)
- **Backend:** Lovable Cloud (Supabase Postgres + Auth + Storage + Edge functions) — replaces Node/Express + PostgreSQL + separate hosting
- **Bot API:** Telegram connector via Lovable connector gateway
- **AdsGram:** Client-side SDK + server-side reward verification

---

## Questions before I start Phase 1

1. **Bot token & AdsGram Block ID** — do you have these ready, or should I build with placeholders and you plug them in later?
2. **First admin Telegram ID** — give me your Telegram numeric ID so I can seed you as admin.
3. **Logo** — should I use the uploaded CoinFlames logo as the app logo? (I'll create an asset pointer.)

Reply "go" එකක් දැම්මොත් default assumptions (placeholders + logo yes + admin later) එක්ක Phase 1 පටන් ගන්නම්.
