#!/usr/bin/env node
// Reset a user's password directly in the local SQLite database.
// Bypasses the login flow entirely so you can recover from a forgotten
// password or a 15-minute lockout without losing data.
//
// Usage:
//   node scripts/reset-password.mjs you@example.com 'NewPass1234!'
//
// Notes:
//   - Password must meet the same policy as the app:
//     12+ chars, at least 3 of: lowercase, uppercase, digit, symbol.
//   - Quote the password so the shell doesn't eat special characters.
//   - Clears failed_login_count and locked_until on the user too.
//   - Run while the dev server is stopped (avoids SQLite write locks).

import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import Database from 'better-sqlite3';

const scrypt = promisify(crypto.scrypt);

const SCRYPT_N = 16384;
const KEYLEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${key.toString('hex')}`;
}

function validatePasswordPolicy(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'Password must contain at least 3 of: lowercase, uppercase, digit, symbol';
  return null;
}

async function main() {
  const [, , emailArg, pwArg] = process.argv;
  if (!emailArg || !pwArg) {
    console.error("Usage: node scripts/reset-password.mjs <email> '<new-password>'");
    process.exit(1);
  }
  const policyError = validatePasswordPolicy(pwArg);
  if (policyError) {
    console.error('Password rejected: ' + policyError);
    process.exit(1);
  }
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'amari.db');
  const db = new Database(dbPath);
  const row = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(emailArg.trim().toLowerCase());
  if (!row) {
    console.error(`No user with email '${emailArg}'. Existing users:`);
    const all = db.prepare('SELECT email FROM users').all();
    for (const r of all) console.error('  - ' + r.email);
    process.exit(1);
  }
  const hash = await hashPassword(pwArg);
  db.prepare(
    'UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?'
  ).run(hash, Date.now(), row.id);
  console.log(`Reset password for ${row.email} (${row.name}). Lockout cleared. You can log in now.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
