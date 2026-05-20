# Deploying Amari Banking

Target: **Railway** — Next.js + persistent SQLite volume, ~$5/month. End-to-end setup ~20 minutes.

> **Why Railway and not Vercel?** Vercel's serverless platform has no persistent filesystem, so SQLite can't survive between deploys. Railway gives us a real disk we can mount and the SQLite database keeps working without rewriting every query for Postgres.

---

## What you need

- The GitHub repo (already at `muhararmmoe5/amari-banking`)
- A Railway account
- (Optional, later) An S3-compatible bucket + GPG recipient for off-site encrypted backups
- (Optional) An Anthropic API key for the in-app AI assistant

---

## 1. Sign up at Railway

<https://railway.app> → **Login with GitHub** → grant access. The hobby plan is $5/mo + small usage; first $5 free.

## 2. Create the project

Dashboard → **+ New Project** → **Deploy from GitHub repo** → pick **`amari-banking`** → **Deploy Now**. Railway auto-detects Next.js. First build ~3 min.

> Make sure Railway is tracking the branch you want to deploy from (default: `claude/deploy-amari-platform-8iRC2`). Settings → Source → **Branch**.

## 3. Add a persistent volume

Without this, every redeploy wipes the database.

Service tile → **Settings** → **Volumes** → **+ Add Volume**

- **Mount path:** `/data`
- **Size:** 1 GB

Save. Railway redeploys automatically.

## 4. Environment variables

Service tile → **Variables** → add:

| Name | Value | Required |
|---|---|---|
| `NODE_ENV` | `production` | yes |
| `DB_PATH` | `/data/amari.db` | yes |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | optional |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | optional, for cheaper AI |

Each variable triggers a redeploy. Wait for green "deployed".

## 5. Generate the public URL

Service → **Settings** → **Networking** → **Generate Domain**. You'll get `amari-banking-production-XXXX.up.railway.app`. That's your live app.

## 6. First-time owner setup

Open the URL. Empty DB → redirects to **`/setup`** → fill name + email + password (12+ chars, 3 of: lower/upper/digit/symbol). You're the owner.

## 7. Invite partners

**Team & Investors** → add person → send icon → fill email → copy invite URL → share it (email/text/Slack). They set their own password and only see their portfolio.

---

## Security posture (what's already in place)

This deploy ships with the Phase-1 hardening turned on automatically:

- **HTTPS everywhere** — Railway terminates TLS; session cookies are `Secure; HttpOnly; SameSite=Strict`.
- **Account lockout** — 5 failed logins per account → 15-min lock.
- **Per-IP login throttle** — 30 login attempts per IP per 15 min, returns 429-style message.
- **Strong password policy** — 12+ chars, 3 of 4 character classes.
- **Scrypt password hashing** with per-user salt.
- **Security headers** — HSTS (2 yr, preload), CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, strict Referrer-Policy, Permissions-Policy blocking camera/mic/geo/usb.
- **Volume encryption at rest** — Railway volumes sit on AWS EBS which is encrypted at rest by the provider.

## Manual encrypted backup (do this weekly until automated)

Two ways to run it.

**A. From your laptop with the Railway CLI**
```bash
npm i -g @railway/cli
railway login
railway link              # pick the amari-banking project
railway shell             # opens a shell inside the running container
# inside the shell:
apt-get update && apt-get install -y sqlite3 gnupg
BACKUP_GPG_RECIPIENT=you@example.com /app/scripts/backup.sh
exit
# back on your laptop, pull the file off:
railway run 'cat /app/backups/amari-YYYYMMDD-HHMMSS.db.gpg' > ./amari-latest.db.gpg
```

**B. Locally against the production DB**
```bash
railway run 'cat /data/amari.db' > /tmp/amari.db
DB_PATH=/tmp/amari.db BACKUP_GPG_RECIPIENT=you@example.com ./scripts/backup.sh
rm /tmp/amari.db   # don't leave a plaintext copy around
```

**To restore:**
```bash
gpg --decrypt amari-YYYYMMDD-HHMMSS.db.gpg > restored.db
# then drop restored.db into /data/amari.db inside the Railway shell
```

Store the encrypted backups somewhere off Railway (iCloud Drive / Drive / S3 bucket). The whole point is that if Railway loses the volume, you still have the data.

---

## After deploy — operational notes

- **Custom domain:** Settings → Networking → Custom Domain → `amari.yourdomain.com` (CNAME to the value Railway shows).
- **Logs:** Service → Deployments → click any deploy → Logs.
- **Re-deploys:** every push to the watched branch auto-deploys. Change the branch in Settings → Source.
- **Database location:** one file at `/data/amari.db` (+ `-wal` and `-shm` siblings). Don't delete those.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| 500 on every page | Check deploy logs. Most likely a missing env var. |
| "Cannot find module 'better-sqlite3'" | Hit **Redeploy** once — Railway sometimes caches a half-built native module. |
| Database resets on every deploy | Volume isn't mounted. Verify mount path is `/data` and `DB_PATH=/data/amari.db`. |
| "Too many attempts" on login | Per-IP throttle hit. Wait 15 min or restart the service. |
| CSP error in browser console | A library tried to load an external URL. Add it to `connect-src`/`script-src` in `next.config.mjs`. |

---

## Roadmap — remaining "production-grade" hardening

Tracked here so we don't forget. Each item is its own PR.

| Phase | Item | Why it's deferred |
|---|---|---|
| 2 | **TOTP 2FA** on every account | Needs a new table, QR enrollment screen, backup codes, login-step UI. Half-day. |
| 3 | **Audit log** — append-only record of every login + every mutation, surfaced in `/admin/audit` | Needs an `audit_log` table and a helper called from every server action (~40 sites). Half-day. |
| 4 | **Automated nightly off-site encrypted backups** | Needs YOU to provision an S3 bucket + GPG keypair, then a Railway cron + script (~2 hr once those exist). |
| 5 | **App-level DB encryption (SQLCipher)** | Requires swapping `better-sqlite3` for `better-sqlite3-multiple-ciphers` and a key-management story. Provider already encrypts at rest, so this is defense-in-depth. |

## Next product step: Plaid

Once stable, wire up Plaid (auto-sync transactions, replace CSV imports). Needs the public URL for webhooks. See `PLAID.md` when we build it.
