import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser, type AuthUser } from './sessions';

export const SESSION_COOKIE = 'amari_sid';

export function getCurrentUser(): AuthUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export function requireUser(): AuthUser {
  const user = getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export function requireOwner(): AuthUser {
  const user = requireUser();
  if (user.role !== 'OWNER') redirect('/');
  return user;
}

/**
 * Returns true for users who can write anywhere in the app. OWNER and EDITOR
 * are treated identically for every capability gate — this is the single
 * source of truth so we don't scatter `role === 'OWNER' || role === 'EDITOR'`
 * across the codebase.
 */
export function hasEditAccess(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'OWNER' || user.role === 'EDITOR';
}

/** Convenience for pages that need to redirect viewers away. */
export function requireEditAccess(): AuthUser {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/');
  return user;
}

export { type AuthUser, type UserRole } from './sessions';
