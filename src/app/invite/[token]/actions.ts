'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getInvite, consumeInvite, createSession, createUser, getUserByEmail, updateUserPassword, updateUserRole, type UserRole } from '@/lib/auth/sessions';
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

  // Reuse an existing user with this email if present, else create.
  // For existing users, upgrade the role if the invite grants MORE
  // privilege than they currently have — but never silently downgrade
  // (e.g. a "password reset" invite that carried role=PARTNER used to
  // demote an existing EDITOR).
  const existing = getUserByEmail(invite.email);
  let userId: string;
  let finalRole: UserRole;
  if (existing) {
    updateUserPassword(existing.id, hash);
    userId = existing.id;
    // Role privilege order (lowest → highest): TEAM_MEMBER, PARTNER,
    // EDITOR, OWNER. Only apply the invite's role if it's a bump.
    const rank: Record<UserRole, number> = { TEAM_MEMBER: 0, PARTNER: 1, EDITOR: 2, OWNER: 3 };
    const existingRole = (existing.role as UserRole) || 'TEAM_MEMBER';
    if ((rank[invite.role] ?? 0) > (rank[existingRole] ?? 0)) {
      updateUserRole(existing.id, invite.role);
      finalRole = invite.role;
    } else {
      finalRole = existingRole;
    }
  } else {
    const user = createUser({
      email: invite.email,
      name,
      passwordHash: hash,
      role: invite.role,
      personId: invite.personId,
    });
    userId = user.id;
    finalRole = user.role;
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
  // Send editors/owners to the full dashboard; everyone else to their
  // own team profile page (or /cap if no personId).
  const canSeeDashboard = finalRole === 'OWNER' || finalRole === 'EDITOR';
  if (canSeeDashboard) redirect('/');
  if (invite.personId) redirect(`/team/${invite.personId}`);
  redirect('/cap');
}
