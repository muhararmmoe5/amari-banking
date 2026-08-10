import 'server-only';
import crypto from 'crypto';
import { getDb } from '@/lib/db';

// EDITOR = full read/write access, equivalent to OWNER for every capability
// check. Kept as a distinct role so the UI can still label them differently
// and audit trails can attribute changes to the right user.
export type UserRole = 'OWNER' | 'EDITOR' | 'PARTNER' | 'TEAM_MEMBER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  personId: string | null;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_IDLE_MS = 1000 * 60 * 60 * 24 * 7; // refresh if older than 7 days

function rowToUser(r: any): AuthUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    personId: r.person_id,
  };
}

export function userCount(): number {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
}

export function getUserByEmail(email: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as any;
}

export function getUserById(id: string): AuthUser | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  return r ? rowToUser(r) : null;
}

export interface NewUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  personId?: string | null;
}

export function createUser(input: NewUserInput): AuthUser {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, person_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.email.trim().toLowerCase(),
    input.passwordHash,
    input.name.trim(),
    input.role,
    input.personId || null,
    now,
    now,
  );
  return getUserById(id)!;
}

export function updateUserPassword(userId: string, passwordHash: string): void {
  const db = getDb();
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?').run(
    passwordHash,
    Date.now(),
    userId,
  );
}

export function recordLoginFailure(userId: string, currentCount: number): { locked: boolean } {
  const db = getDb();
  const next = currentCount + 1;
  const locked = next >= 5;
  db.prepare('UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?').run(
    next,
    locked ? Date.now() + 15 * 60 * 1000 : null,
    Date.now(),
    userId,
  );
  return { locked };
}

export function recordLoginSuccess(userId: string): void {
  const db = getDb();
  db.prepare('UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?').run(
    Date.now(),
    userId,
  );
}

export function createSession(userId: string, ip?: string, userAgent?: string): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at, last_seen_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(token, userId, now + SESSION_TTL_MS, now, now, ip || null, userAgent || null);
  return token;
}

export function getSessionUser(token: string | null | undefined): AuthUser | null {
  if (!token) return null;
  const db = getDb();
  const row = db.prepare(
    `SELECT s.token as session_token, s.expires_at, s.last_seen_at, u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? LIMIT 1`
  ).get(token) as any;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  // Touch last_seen_at occasionally
  if (Date.now() - row.last_seen_at > SESSION_IDLE_MS / 7) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(Date.now(), token);
  }
  return rowToUser(row);
}

export function deleteSession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ===== Invite tokens =====

export interface InviteToken {
  token: string;
  personId: string;
  email: string;
  role: UserRole;
  expiresAt: number;
  usedAt: number | null;
}

export function createInvite(personId: string, email: string, role: UserRole, createdByUserId: string | null): InviteToken {
  const db = getDb();
  const token = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  const expiresAt = now + 1000 * 60 * 60 * 24 * 14; // 14 days
  db.prepare(
    `INSERT INTO invite_tokens (token, person_id, email, role, expires_at, created_at, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(token, personId, email.trim().toLowerCase(), role, expiresAt, now, createdByUserId);
  return { token, personId, email, role, expiresAt, usedAt: null };
}

export function getInvite(token: string): InviteToken | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM invite_tokens WHERE token = ?').get(token) as any;
  if (!r) return null;
  return {
    token: r.token,
    personId: r.person_id,
    email: r.email,
    role: r.role,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
  };
}

export function consumeInvite(token: string, userId: string): void {
  const db = getDb();
  db.prepare('UPDATE invite_tokens SET used_at = ?, used_by_user_id = ? WHERE token = ?').run(
    Date.now(),
    userId,
    token,
  );
}

// ===== Password reset tokens =====

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
  usedAt: number | null;
}

const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

export function createPasswordResetToken(userId: string, ip?: string | null): PasswordResetToken {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + RESET_TTL_MS;
  db.prepare(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at, ip)
     VALUES (?, ?, ?, ?, ?)`
  ).run(token, userId, expiresAt, now, ip || null);
  return { token, userId, expiresAt, usedAt: null };
}

export function getPasswordResetToken(token: string): PasswordResetToken | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').get(token) as any;
  if (!r) return null;
  return { token: r.token, userId: r.user_id, expiresAt: r.expires_at, usedAt: r.used_at };
}

export function consumePasswordResetToken(token: string): void {
  const db = getDb();
  db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE token = ?').run(Date.now(), token);
}

export function markPasswordResetEmailSent(token: string): void {
  const db = getDb();
  db.prepare('UPDATE password_reset_tokens SET email_sent_at = ? WHERE token = ?').run(Date.now(), token);
}
