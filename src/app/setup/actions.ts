'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { userCount, createUser, createSession } from '@/lib/auth/sessions';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import { SESSION_COOKIE } from '@/lib/auth';

export async function setupOwnerAction(formData: FormData): Promise<{ error?: string }> {
  if (userCount() > 0) {
    return { error: 'Setup is already complete.' };
  }
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!name || !email) return { error: 'Name and email are required' };
  const policyError = validatePasswordPolicy(password);
  if (policyError) return { error: policyError };

  const hash = await hashPassword(password);
  const user = createUser({ email, name, passwordHash: hash, role: 'OWNER', personId: null });

  const h = headers();
  const ua = (h.get('user-agent') || '').slice(0, 512);
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const token = createSession(user.id, ip || undefined, ua || undefined);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect('/');
}
