# Deploying Amari Banking

This deploys to **Railway** — Next.js + persistent SQLite volume on a hobby plan (~$5/month). Total setup time: ~15 minutes.

> **Why Railway and not Vercel?** Vercel's serverless platform doesn't have a persistent filesystem, so SQLite can't survive between deploys. Railway gives us a real disk we can mount and the SQLite database keeps working without rewriting every query for Postgres.

## What you need

- The GitHub repo for this project (already exists at `muhararmmoe5/amari-banking`)
- A Railway account
- (Optional) An Anthropic API key for the AI assistant

## Steps

### 1. Sign up at Railway

Go to <https://railway.app> → **Login with GitHub** → grant access to your account.

You get a $5 free trial. After that the hobby plan is $5/month + small usage.

### 2. Create the project from the repo

Railway dashboard → **+ New Project** → **Deploy from GitHub repo** → pick **`amari-banking`** → **Deploy Now**.

Railway will auto-detect Next.js and start a build. The first build takes ~3 minutes.

### 3. Add a persistent volume

The build will deploy, but SQLite will write to a temp directory that gets wiped on every redeploy. Fix this before opening the app for the first time.

Inside the project → click on the **service tile** → **Settings** tab → scroll to **Volumes** → **+ Add Volume**.

- **Mount path:** `/data`
- **Size:** 1 GB (plenty for the foreseeable future)

Save. Railway will redeploy automatically.

### 4. Set environment variables

Project → service tile → **Variables** tab → add these one at a time:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DB_PATH` | `/data/amari.db` |
| `ANTHROPIC_API_KEY` | (optional — paste your `sk-ant-...` key if you want the AI chat) |

Railway will redeploy after each variable is added. Wait for the green "deployed" indicator.

### 5. Get your public URL

Project → service → **Settings** tab → **Networking** → **Generate Domain**.

You'll get a URL like `amari-banking-production-XXXX.up.railway.app`. That's your live app.

### 6. First-time setup

Open the URL. Because the database is brand-new, the app redirects you to **`/setup`** — fill in your name, email, and password (12+ characters, 3 of: lowercase / uppercase / digit / symbol). You're now the owner.

### 7. Send invites

Go to **Team & Investors** → add a partner → click the send icon → fill in their email → copy the invite URL. Send the URL to them however you like (email, text, Slack). They click it, set their own password, and they're in. They'll only see their own portfolio.

## After deploy

- **Custom domain:** Settings → Networking → **Custom Domain** → add `amari.yourdomain.com` (point a CNAME at the value Railway shows).
- **Backups:** SQLite is one file at `/data/amari.db`. Railway lets you SSH in or use their CLI to download it (`railway run cat /data/amari.db > backup.db`). Schedule this monthly.
- **Logs:** Service → **Deployments** tab → click any deploy → **Logs**.
- **Re-deploys:** every `git push` to `claude/build-new-feature-lc4pe` triggers an auto-deploy. To stop that, change the watched branch in Settings → Source.

## Troubleshooting

| Symptom | Fix |
|---|---|
| 500 on every page | Check the deploy logs. Most likely a missing env var. |
| "Cannot find module 'better-sqlite3'" | Try **Redeploy** once. Railway sometimes caches a half-built native module. If it persists, post the build log. |
| Database resets on every deploy | The volume isn't mounted. Verify Volume mount path is `/data` and `DB_PATH=/data/amari.db`. |

## Next: Plaid

Once the app is online, we can wire up Plaid (auto-sync transactions instead of CSV imports) — it needs the public URL to receive webhooks. See `PLAID.md` (added when we build that step).
