'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getUserByEmail, createSession, recordLoginFailure, recordLoginSuccess, userCount,
} from '@/lib/auth/sessions';
import { verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE } from '@/lib/auth';
import { checkLoginRate } from '@/lib/auth/ratelimit';

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  if (userCount() === 0) {
    redirect('/setup');
  }
  const h = headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const rate = checkLoginRate(ip);
  if (!rate.allowed) {
    return { error: `Too many attempts from this network. Try again in ${Math.ceil((rate.retryAfterSec || 60) / 60)} min.` };
  }

  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = String(formData.get('next') || '/');
  if (!email || !password) return { error: 'Email and password required' };

  const user = getUserByEmail(email);
  // Always do a hash check to keep timing roughly constant
  const dummy = 'scrypt$16384$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  const ok = await verifyPassword(password, user ? user.password_hash : dummy);
  if (!user) return { error: 'Invalid email or password' };
  if (user.locked_until && user.locked_until > Date.now()) {
    return { error: 'Account temporarily locked. Try again later.' };
  }
  if (!ok) {
    recordLoginFailure(user.id, user.failed_login_count);
    return { error: 'Invalid email or password' };
  }
  recordLoginSuccess(user.id);

  const ua = (h.get('user-agent') || '').slice(0, 512);
  const token = createSession(user.id, ip || undefined, ua || undefined);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  // Only accept same-origin relative paths for `next`. Reject
  // protocol-relative URLs like //evil.com — Next resolves those as
  // off-site redirects, which is a phishing vector.
  const isSafeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  redirect(isSafeNext ? next : '/');
}
