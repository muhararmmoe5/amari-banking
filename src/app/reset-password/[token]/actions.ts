'use server';

import { headers } from 'next/headers';
import {
  getPasswordResetToken,
  consumePasswordResetToken,
  updateUserPassword,
  getUserById,
  createSession,
} from '@/lib/auth/sessions';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth';

export async function redeemPasswordResetAction(
  token: string,
  formData: FormData,
): Promise<{ error?: string; ok?: true }> {
  const password = String(formData.get('password') || '');
  const policyError = validatePasswordPolicy(password);
  if (policyError) return { error: policyError };

  const reset = getPasswordResetToken(token);
  if (!reset) return { error: 'Reset link is invalid.' };
  if (reset.usedAt) return { error: 'This reset link has already been used.' };
  if (reset.expiresAt < Date.now()) return { error: 'This reset link has expired. Request a new one.' };

  const user = getUserById(reset.userId);
  if (!user) return { error: 'Account not found.' };

  const hash = await hashPassword(password);
  updateUserPassword(user.id, hash);
  consumePasswordResetToken(token);

  // Sign the user in immediately so they don't have to type the new password.
  const h = headers();
  const ua = (h.get('user-agent') || '').slice(0, 512);
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const sessionToken = createSession(user.id, ip || undefined, ua || undefined);
  cookies().set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return { ok: true };
}
