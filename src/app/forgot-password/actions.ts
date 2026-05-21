'use server';

import { headers } from 'next/headers';
import {
  getUserByEmail,
  createPasswordResetToken,
  markPasswordResetEmailSent,
} from '@/lib/auth/sessions';
import { checkPasswordResetRate } from '@/lib/auth/ratelimit';
import { sendPasswordResetEmail, isEmailConfigured } from '@/lib/email/resend';

export interface RequestResult {
  // The user always sees a generic "if your email is on file, we sent a link"
  // — we never reveal whether the email exists. But owners running locally
  // benefit from seeing the actual outcome, so we surface a 'configError'
  // when the SMTP key is missing entirely.
  ok: boolean;
  configError?: 'email_not_configured';
  rateLimited?: boolean;
  retryAfterSec?: number;
}

export async function requestPasswordResetAction(formData: FormData): Promise<RequestResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email) return { ok: false };

  const h = headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const rate = checkPasswordResetRate(ip);
  if (!rate.allowed) {
    return { ok: false, rateLimited: true, retryAfterSec: rate.retryAfterSec };
  }

  if (!isEmailConfigured()) {
    return { ok: false, configError: 'email_not_configured' };
  }

  // Always return ok=true regardless of whether the email matches a user. This
  // prevents user-enumeration via the reset endpoint.
  const user = getUserByEmail(email);
  if (!user) {
    return { ok: true };
  }

  const tok = createPasswordResetToken(user.id, ip);
  const host = h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const resetUrl = `${proto}://${host}/reset-password/${tok.token}`;

  const send = await sendPasswordResetEmail({
    toEmail: user.email,
    toName: user.name,
    resetUrl,
  });

  if (send.ok) {
    markPasswordResetEmailSent(tok.token);
  } else {
    // Log server-side; user still sees generic success so we don't leak.
    console.warn('[password-reset] email send failed:', send.reason, send.error);
  }
  return { ok: true };
}
