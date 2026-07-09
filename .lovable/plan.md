# Remaining Work Plan

Lovable Cloud එකේ `SUPABASE_SERVICE_ROLE_KEY` access කරන්න බැරි නිසා external Vercel deploy වෙනුවට **Lovable එකේම publish** කරමු (දැනටමත් `flame-farm-hub.lovable.app` live). ඉතුරු features ඔක්කොම මේ project එකේම implement කරනවා.

## Phase 2 — Mining System

**Database:**
- `mining_packages` table: name, hourly_reward, ads_required, daily_claim_limit, price (free/paid), active
- `user_mining` table: user_id, package_id, started_at, last_claim_at, claims_today, expires_at
- 4 default packages seeded:
  1. Starter — 20 coins/hr, 1 ad, free
  2. Bronze — 30 coins/hr, 2 ads, free
  3. Silver — 50 coins/hr, 3 ads, free
  4. Gold — 100 coins/hr, 5 ads (bonus tier)

**Logic:**
- Claim once per hour, max 10/day per machine
- Watching required ads unlocks the claim button
- 1 hour countdown after claim → next claim
- Mining auto-stops after 1 hour if not claimed
- Bot notification on claim-ready via `sendUserBotMessage`

**UI:**
- New `/app/mining` route + bottom nav tab
- Animated countdown (CSS + `setInterval`)
- Package cards with lock/unlock states

## Phase 3 — Welcome / Start Message

- Use photo: `https://i.ibb.co/mVcB66gf` (need direct image URL — will use `sendPhoto` with caption)
- Rich HTML message: features list, earn methods, community + payment channel buttons, mini-app button
- Applied to both `/start` handler and new-user welcome DM

## Phase 4 — Admin Panel additions

- Mining packages CRUD in admin
- All existing admin tabs already work

## Phase 5 — Deploy readiness

Stay on Lovable Cloud (recommended). If Vercel needed later, user must create own Supabase project — documented in README.

## Technical details

- Migration: `mining_packages`, `user_mining`, `mining_claims` tables + RLS + GRANTs + seed
- Server fns: `startMining`, `claimMining`, `getMiningState` in `src/lib/mining.functions.ts`
- Queries: `miningPackagesQuery`, `userMiningQuery` in `src/lib/queries.ts`
- Route: `src/routes/app.mining.tsx` + admin `src/routes/admin.mining.tsx`
- Bot: extend `telegram-bot.server.ts` with `sendWelcomePhoto()` helper
- Webhook `/start` handler updated in `src/routes/api/public/telegram/webhook.ts`

Approve කරොත් Phase 2 එකේ migration එකෙන් පටන් ගන්නවා.
