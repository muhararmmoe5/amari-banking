/**
 * Boot-time password reset.
 *
 * If the container starts with BOTH of these env vars set:
 *   RESET_OWNER_EMAIL     = the user's email
 *   RESET_OWNER_PASSWORD  = the new password (must pass policy)
 *
 * then on the first getDb() call we look up that user, replace their
 * password hash with a fresh scrypt of the new value, clear the failed
 * login counter, and lift any active lockout. This lets a locked-out
 * OWNER recover from the Railway Variables UI without shelling into
 * the container or exposing an unauthed endpoint on the internet.
 *
 * After the reset lands in the logs, unset the two env vars and
 * redeploy so the credential doesn't sit in Railway's variables page.
 *
 * The reset is idempotent — it runs once per boot, but re-running it
 * with the same env vars just re-hashes to the same password.
 */

import crypto from 'crypto';
import { promisify } from 'util';
import type Database from 'better-sqlite3';

const scrypt = promisify(crypto.scrypt);
const SCRYPT_N = 16384;
const KEYLEN = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${key.toString('hex')}`;
}

function validatePolicy(password: string): string | null {
  if (password.length < 12) return 'password must be at least 12 characters';
  if (password.length > 128) return 'password must be at most 128 characters';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'password needs 3 of: lowercase, uppercase, digit, symbol';
  return null;
}

let _alreadyRan = false;

export function maybeResetOwnerFromEnv(db: Database.Database): void {
  if (_alreadyRan) return;
  const email = (process.env.RESET_OWNER_EMAIL || '').trim().toLowerCase();
  const pw = process.env.RESET_OWNER_PASSWORD || '';
  if (!email || !pw) return;
  _alreadyRan = true;

  const policyErr = validatePolicy(pw);
  if (policyErr) {
    // eslint-disable-next-line no-console
    console.error(`[password-reset] refusing: ${policyErr}`);
    return;
  }

  const row = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email) as
    | { id: string; email: string; name: string | null }
    | undefined;
  if (!row) {
    // eslint-disable-next-line no-console
    console.error(`[password-reset] no user with email '${email}'`);
    const all = db.prepare('SELECT email FROM users').all() as { email: string }[];
    // eslint-disable-next-line no-console
    console.error(`[password-reset] existing emails: ${all.map((r) => r.email).join(', ')}`);
    return;
  }

  hashPassword(pw)
    .then((hash) => {
      db.prepare(
        'UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?'
      ).run(hash, Date.now(), row.id);
      // eslint-disable-next-line no-console
      console.log(`[password-reset] OK — reset ${row.email}. Now UNSET the env vars and redeploy.`);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[password-reset] hash failed', e);
    });
}
