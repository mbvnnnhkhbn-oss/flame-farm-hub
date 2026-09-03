# 🚀 Vercel + GitHub Deployment Guide — CoinFlames

මේ mini app එක Vercel එකට deploy කරන්න step-by-step guide එක.

> **මතක තබාගන්න:** දැන් තියෙන **Lovable Cloud database එකම** use කරනවා. Data migration එකක් අවශ්‍ය නැ.

---

## ⚠️ වැදගත්: Service Role Key Limitation

App එකේ server functions (auth, mining, admin panel, withdrawals, Telegram bot) බොහොමයක් `SUPABASE_SERVICE_ROLE_KEY` use කරනවා (RLS bypass කරලා privileged operations කරන්න).

- **Lovable Cloud** එකේ `SUPABASE_SERVICE_ROLE_KEY` user ලට expose වෙන්නේ **නැ**.
- ඒ නිසා Vercel එකේ **full self-host** කරනවා නම්, ඔයාටම අලුත් Supabase project එකක් හදලා ඒකේ `service_role` key එක configure කරන්න වෙනවා (Option 2).
- Option 1 (දැන් තියෙන DB එකම use කරනවා) වලින් **frontend පමණක්** Vercel එකේ දාන්න පුළුවන්, නමුත් server functions වල admin/privileged parts වැඩ කරන්නේ නැ.

---

## 📋 Option 1: දැන් තියෙන Lovable Cloud DB එකම තබාගෙන Vercel deploy කිරීම

### Step 1: GitHub Repo එකක් හදන්න

Lovable එකේ ➕ menu → **GitHub** → **Connect project** → **Create Repository**

හෝ terminal එකෙන්:

```bash
git init
git add .
git commit -m "CoinFlames ready for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/coinflames.git
git push -u origin main
```

### Step 2: Vercel Project එක Create කරන්න

1. https://vercel.com → **Add New Project**
2. GitHub repo එක import කරන්න (`coinflames`)
3. **Framework Preset**: `Other` තියන්න (`vercel.json` already handle කරනවා)
4. **Build Command** / **Output Directory** override නොකරන්න
5. **Environment Variables** section එකට පහත values add කරන්න:

```
VITE_SUPABASE_URL=https://rabldjzghoxfmfkzplhi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhYmxkanpnaG94Zm1ma3pwbGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTUyNzksImV4cCI6MjA5ODY3MTI3OX0.U2_3vbFJXOsDHW2DzPR2E3RdZcehwnmDletrHmGLNBA
VITE_SUPABASE_PROJECT_ID=rabldjzghoxfmfkzplhi
SUPABASE_URL=https://rabldjzghoxfmfkzplhi.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhYmxkanpnaG94Zm1ma3pwbGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTUyNzksImV4cCI6MjA5ODY3MTI3OX0.U2_3vbFJXOsDHW2DzPR2E3RdZcehwnmDletrHmGLNBA
SUPABASE_PROJECT_ID=rabldjzghoxfmfkzplhi
SUPABASE_SERVICE_ROLE_KEY=          # ලබා ගත නොහැක (උඩින් බලන්න)
TELEGRAM_BOT_TOKEN=                 # BotFather ලා ලැබෙන token එක
LOVABLE_API_KEY=                    # optional
```

6. **Deploy** ↵

### Step 3: Telegram Webhook Set කරන්න

Deploy වුනාට පස්සේ Vercel URL එක ලැබෙනවා (e.g. `https://flame-farm-hub.vercel.app`).

Browser එකේ මේ URL එක open කරන්න (values replace කරන්න):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://flame-farm-hub.vercel.app/api/public/telegram/webhook
```

`{"ok":true}` දාපුවම done ✅

---

## 📋 Option 2: Full Vercel Self-Host සඳහා අලුත් Supabase Project එකක් (Recommended)

Service role key එක අවශ්‍ය නිසා, production-grade Vercel hosting එකට මෙය recommend කරනවා.

1. https://supabase.com → **New Project**
2. Name: `coinflames-prod`
3. Region: `Southeast Asia (Singapore)`
4. Database password එකක් save කරන්න
5. Supabase Dashboard → **SQL Editor** → `deploy/supabase-schema.sql` run කරන්න
6. Supabase Dashboard → **Settings** → **API** → `URL`, `anon key`, `service_role key`, `Reference ID` copy කරන්න
7. Vercel env variables වලට දාන්න
8. Telegram webhook set කරන්න

---

## 🔧 Local Development

```bash
cp .env.example .env
# .env එකේ real values දාන්න (අවශ්‍ය secret values)
bun install
bun run dev
```

---

## ✅ Verification Checklist

- [ ] GitHub repo එක push වෙලා
- [ ] Vercel deploy successful
- [ ] Env variables set වෙලා
- [ ] Telegram webhook `{"ok":true}` return කරනවා
- [ ] `/start` command bot එකෙන් welcome message එක එනවා
- [ ] Mini app URL එක Telegram BotFather → `/setmenubutton` එකට add කරලා
- [ ] Admin user `user_roles` table එකේ set කරලා

---

## 🆘 Troubleshooting

| Issue | Reason | Fix |
|-------|--------|-----|
| "Failed to fetch" / 500 | Env vars missing / service role key නැ | Vercel env variables check කරන්න, redeploy කරන්න |
| Telegram bot response නෑ | Webhook URL වැරදියි | `getWebhookInfo` එකෙන් URL එක verify කරන්න |
| Auth redirect fails | Supabase Auth URL config | Supabase Auth → URL Configuration → Vercel URL add කරන්න |
| Admin panel පෙන්නන්නේ නෑ | Admin role නැ | `user_roles` table එකේ `admin` role එක add කරන්න |
| Server functions fail | Service role key නැ | Option 2 (අලුත් Supabase project) consider කරන්න |
