# 🚀 Vercel Deployment Guide — CoinFlames

**Frontend = Vercel · Backend = Lovable · Database = Lovable Cloud**

මේ setup එකෙන් `SUPABASE_SERVICE_ROLE_KEY` එකක් **අවශ්‍ය නෑ**. හේතුව: Vercel එකේ එන සියලුම backend requests (`/_serverFn/*` සහ `/api/*`) automatically Lovable backend එකට proxy වෙනවා — key එක දැනටමත් එහි inject වෙලා තියෙනවා. `BACKEND_ORIGIN` නොදැම්මත් stable Lovable backend URL එක fallback එක ලෙස භාවිත වෙනවා.

```
Telegram Mini App
      │
      ▼
Vercel (UI + SSR)  ──proxy──►  Lovable backend (server functions, admin, bot)
                                        │
                                        ▼
                                 Lovable Cloud DB
```

---

## Step 1: Lovable එකේ Publish කරන්න

මුලින්ම **Publish** button එකෙන් app එක publish කරන්න. ඒකෙන් backend එක live වෙනවා:

```
https://flame-farm-hub.lovable.app
```

(මේක rename වුනත් වෙනස් වෙන්නේ නෑ — stable URL එකක්.)

## Step 2: GitHub repo එකක් හදන්න

Lovable එකේ ➕ menu → **GitHub** → **Connect project** → **Create Repository**

## Step 3: Vercel Project එක

1. https://vercel.com → **Add New Project** → repo එක import කරන්න
2. **Framework Preset**: `Other` (`vercel.json` handle කරනවා)
3. Build / Output override නොකරන්න
4. **Environment Variables**:

```
# Optional override (normally not required)
BACKEND_ORIGIN=https://flame-farm-hub.lovable.app

VITE_SUPABASE_URL=https://c--2291c52f-fef9-4847-9d1e-2ade542b1d1d-prod.lovable.cloud
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhYmxkanpnaG94Zm1ma3pwbGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTUyNzksImV4cCI6MjA5ODY3MTI3OX0.U2_3vbFJXOsDHW2DzPR2E3RdZcehwnmDletrHmGLNBA
VITE_SUPABASE_PROJECT_ID=rabldjzghoxfmfkzplhi

SUPABASE_URL=https://c--2291c52f-fef9-4847-9d1e-2ade542b1d1d-prod.lovable.cloud
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhYmxkanpnaG94Zm1ma3pwbGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTUyNzksImV4cCI6MjA5ODY3MTI3OX0.U2_3vbFJXOsDHW2DzPR2E3RdZcehwnmDletrHmGLNBA
SUPABASE_PROJECT_ID=rabldjzghoxfmfkzplhi
```

> `SUPABASE_SERVICE_ROLE_KEY` සහ `TELEGRAM_BOT_TOKEN` **Vercel එකට දාන්න අවශ්‍ය නෑ** — ඒවා Lovable backend එකේ තියෙනවා. `BACKEND_ORIGIN` එකත් optional.

5. **Deploy** ↵

## Step 4: Telegram

- **Webhook** එක Lovable backend එකට තියෙන්න ඕනේ (Vercel එකට නෙවෙයි):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://flame-farm-hub.lovable.app/api/public/telegram/webhook
```

- **Mini App URL** එක BotFather → `/setmenubutton` එකට ඔයාගේ Vercel URL එක දාන්න (හෝ custom domain එක).

---

## ✅ Verification Checklist

- [ ] Lovable එකේ publish වෙලා (backend live)
- [ ] Vercel deploy successful
- [ ] Optional `BACKEND_ORIGIN` override එක අවශ්‍ය නම් පමණක් set වෙලා
- [ ] Mini app open කරාම "Sign-in failed" එන්නේ නෑ
- [ ] Telegram `/start` welcome message එනවා
- [ ] Admin panel (`/admin`) admin user ට පෙන්නනවා

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| `Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY` | අලුත්ම code එක GitHub/Vercel වෙත deploy වී ඇතිද බලලා redeploy කරන්න; `BACKEND_ORIGIN` optional override එකත් දාන්න පුළුවන් |
| `Backend unreachable` (502) | Lovable app එක publish වෙලාද, `BACKEND_ORIGIN` URL එක හරිද බලන්න |
| Bot response නෑ | Webhook URL එක Lovable backend එකට point වෙනවාද `getWebhookInfo` එකෙන් බලන්න |
| Admin panel නෑ | `user_roles` table එකේ `admin` role එක add කරන්න |

---

## 🔧 Local Development

```bash
cp .env.example .env
bun install
bun run dev
```

`BACKEND_ORIGIN` local `.env` එකේ නොදැම්මොත් backend එක locally run වෙනවා (service role key එකක් ඕනේ).

---

## Full self-host (optional)

Database එකත් ඔයාගේ control එකට ගන්න ඕනේ නම්: අලුත් Supabase project එකක් හදලා `deploy/supabase-schema.sql` run කරලා, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` Vercel එකට දාලා `BACKEND_ORIGIN` එක අයින් කරන්න.
