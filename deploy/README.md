# 🚀 Vercel + GitHub Deployment Guide

මේ mini app එක Vercel එකට deploy කරන්න step-by-step guide එක.

---

## 📋 Step 1: අලුත් Supabase Project එකක් හදන්න

1. https://supabase.com → **New Project**
2. Name: `flame-farm-hub` (හෝ ඔයා කැමති නමක්)
3. Database password එකක් set කරන්න (safe තැනක save කරන්න)
4. Region: `Southeast Asia (Singapore)` (Sri Lanka එකට කිට්ටුම)
5. **Create new project** click කරලා ~2 minutes wait කරන්න

---

## 📋 Step 2: Database Schema Import කරන්න

1. Supabase Dashboard → **SQL Editor** → **New query**
2. `deploy/supabase-schema.sql` file එකේ **complete content එක copy** කරන්න
3. SQL Editor එකට paste කරලා **Run** ↵

මේකෙන් හැම tables, RLS policies, functions, seed data එකම create වෙනවා.

---

## 📋 Step 3: Supabase Keys ගන්න

Supabase Dashboard → **Settings** → **API** →

| Key | කොහෙන් copy කරන්නද | Env variable |
|-----|-------------------|--------------|
| Project URL | `https://xxx.supabase.co` | `SUPABASE_URL` + `VITE_SUPABASE_URL` |
| `anon` `public` | `eyJhbGci...` | `SUPABASE_PUBLISHABLE_KEY` + `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `service_role` `secret` | `eyJhbGci...` (⚠️ secret!) | `SUPABASE_SERVICE_ROLE_KEY` |
| Reference ID | `xxx` (URL එකේ මුල් කොටස) | `SUPABASE_PROJECT_ID` + `VITE_SUPABASE_PROJECT_ID` |

---

## 📋 Step 4: Enable Google OAuth (optional)

Supabase Dashboard → **Authentication** → **Providers** → **Google** → Enable
(Client ID + Secret Google Cloud Console එකෙන් ගන්න)

Redirect URL එකට add කරන්න:
```
https://YOUR-VERCEL-APP.vercel.app/auth/callback
```

---

## 📋 Step 5: GitHub එකට Push කරන්න

Lovable එකේ ➕ menu → **GitHub** → **Connect project** → **Create Repository**

---

## 📋 Step 6: Vercel එකට Deploy කරන්න

1. https://vercel.com → **Add New Project**
2. GitHub repo එක import කරන්න
3. **Framework Preset**: `Other` තියන්න (vercel.json handle කරනවා)
4. **Environment Variables** section එකට Step 3 එකේ ලබා ගත්තු **හැම key එකම** add කරන්න:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_PROJECT_ID
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
```

5. **Deploy** ↵

---

## 📋 Step 7: Telegram Webhook Set කරන්න

Deploy වුනාට පස්සේ Vercel URL එක ලැබෙනවා (e.g. `https://flame-farm-hub.vercel.app`).

Browser එකේ මේ URL එක open කරන්න (values replace කරන්න):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://YOUR-VERCEL-APP.vercel.app/api/public/telegram/webhook
```

`{"ok":true}` දාපුවම done ✅

---

## 📋 Step 8: Admin User හදන්න

Bot එකට `/start` යවලා register වුනාට පස්සේ, Supabase **SQL Editor** එකේ:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'YOUR-EMAIL@example.com';
```

හෝ telegram_id එකෙන්:
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.profiles WHERE telegram_id = YOUR_TG_ID;
```

---

## 🔧 Local Development

```bash
cp .env.example .env
# .env එකේ real values දාන්න
bun install
bun run dev
```

---

## ✅ Verification Checklist

- [ ] Supabase project එක create වෙලා
- [ ] Schema import වෙලා (15+ tables)
- [ ] Vercel deploy successful
- [ ] All env variables Vercel එකේ set
- [ ] Telegram webhook `{"ok":true}` return කරනවා
- [ ] `/start` command bot එකෙන් welcome message එක එනවා
- [ ] Mini app URL එක Telegram BotFather → `/setmenubutton` එකට add කරලා
- [ ] Admin user assigned

---

## 🆘 Troubleshooting

**"Failed to fetch" errors** → env vars Vercel එකේ set නෑ, redeploy කරන්න
**Telegram bot response නෑ** → webhook URL check කරන්න: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
**Auth redirect fails** → Supabase Auth → URL Configuration → Site URL එකට Vercel URL add කරන්න
**Admin panel පෙන්නන්නේ නෑ** → `user_roles` table එකේ ඔයාගේ user_id එකට `admin` role එකක් add කරන්න
