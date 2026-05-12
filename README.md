# Amari Banking

A small full-stack banking app built with security as a first-class concern.
Express + SQLite (better-sqlite3) on the back, vanilla HTML/CSS/JS on the front.

## Features

- User registration and sign-in with strong password policy
- Multiple accounts per user with unique 12-digit account numbers
- Deposit, withdraw, and transfer between accounts
- Per-account transaction history with running balance
- Audit log of sensitive actions (login, transfers, account creation)

## Security model

- **Passwords**: bcrypt (`bcryptjs`) with cost 12 by default; min 12 chars and
  must include at least 3 of {lowercase, uppercase, digit, symbol}.
- **Sessions**: `express-session` backed by SQLite. Cookies are `httpOnly`,
  `SameSite=strict`, and `Secure` in production. Sessions regenerate on
  login/register to prevent fixation, have a 15-minute idle timeout, and an
  8-hour absolute lifetime.
- **CSRF**: synchronizer-token pattern. Clients fetch `/api/auth/csrf-token`
  and send it as `X-CSRF-Token` on state-changing requests. Tokens are bound to
  the session and compared with `crypto.timingSafeEqual`.
- **Rate limiting**: `express-rate-limit` on login (20/15min), register
  (10/hour), and money movement (30/min).
- **Account lockout**: 5 failed logins lock the account for 15 minutes.
- **Headers**: `helmet` with a strict CSP (`default-src 'none'`,
  no inline scripts/styles), HSTS in production, `X-Content-Type-Options`,
  `Referrer-Policy: no-referrer`, no `X-Powered-By`.
- **SQL**: every query uses prepared statements (no string interpolation).
  Foreign keys are enforced; balances have `CHECK (balance_cents >= 0)`.
- **Money**: stored as integer cents to avoid floating-point errors. Parsed
  via a strict regex; transfers are atomic SQL transactions and check for
  `Number.isSafeInteger` overflow.
- **Authorization**: every account/transaction query is scoped by `user_id`,
  so users cannot read or mutate other users' data.
- **Generic errors**: login failures and missing destinations return generic
  responses to avoid user/account enumeration.
- **Audit log**: writes for register, login (success/failure/lock), logout,
  account create, deposit, withdraw, transfer — with IP and user-agent.
- **Constant-time login**: a dummy bcrypt hash is verified when the user
  doesn't exist, evening out timing between known and unknown usernames.

## Getting started

```bash
cp .env.example .env
# Generate a real session secret for production:
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

npm install
npm start
# open http://127.0.0.1:3000
```

The SQLite database is created at `./data/bank.db` on first run.

## Production checklist

- Set `NODE_ENV=production` and a strong `SESSION_SECRET`.
- Serve behind HTTPS. If you terminate TLS at a proxy, set `TRUST_PROXY=true`
  so secure cookies and client IPs work correctly.
- Back up `./data/bank.db` regularly. Treat the file as sensitive.
- Consider adding TOTP-based 2FA and email-verified account recovery before
  any real use. This codebase intentionally does not pretend to be a
  regulated financial system.

## Project layout

```
src/
  server.js              Express app, middleware wiring, static files
  config.js              Env-driven configuration with safe defaults
  db.js                  SQLite connection and schema
  lib/
    money.js             Cents parsing/formatting
    password.js          Policy + bcrypt
    audit.js             Audit log writer
  middleware/
    auth.js              Session presence + idle/absolute timeouts
    csrf.js              Synchronizer-token CSRF
    errorHandler.js      404 + final error handler
  routes/
    auth.js              register, login, logout, me, csrf-token
    accounts.js          list, create, get
    transactions.js      deposit, withdraw, transfer, history
public/
  index.html, css/, js/  Vanilla SPA — no inline JS/CSS, CSP-friendly
```
