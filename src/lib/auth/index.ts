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

export { type AuthUser, type UserRole } from './sessions';
