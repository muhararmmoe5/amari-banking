'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getInvite, consumeInvite, createSession, createUser, getUserByEmail, updateUserPassword } from '@/lib/auth/sessions';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import { SESSION_COOKIE } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function redeemInviteAction(token: string, formData: FormData): Promise<{ error?: string }> {
  const invite = getInvite(token);
  if (!invite) return { error: 'Invite not found' };
  if (invite.usedAt) return { error: 'This invite has already been used' };
  if (invite.expiresAt < Date.now()) return { error: 'This invite has expired' };

  const name = String(formData.get('name') || '').trim();
  const password = String(formData.get('password') || '');
  if (!name) return { error: 'Name is required' };
  const policyError = validatePasswordPolicy(password);
  if (policyError) return { error: policyError };

  const hash = await hashPassword(password);

  // Reuse an existing user with this email if present, else create
  const existing = getUserByEmail(invite.email);
  let userId: string;
  if (existing) {
    updateUserPassword(existing.id, hash);
    userId = existing.id;
  } else {
    const user = createUser({
      email: invite.email,
      name,
      passwordHash: hash,
      role: invite.role,
      personId: invite.personId,
    });
    userId = user.id;
  }

  consumeInvite(token, userId);

  const h = headers();
  const ua = (h.get('user-agent') || '').slice(0, 512);
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const sessionToken = createSession(userId, ip || undefined, ua || undefined);
  cookies().set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath('/');
  redirect('/');
}
