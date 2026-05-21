import 'server-only';

// Email delivery via Resend. The whole module is opt-in: if RESEND_API_KEY is
// missing the functions return { ok: false, reason: 'not_configured' } instead
// of throwing, so the rest of the app keeps working in environments where
// transactional email isn't set up yet.
//
// Env vars:
//   RESEND_API_KEY   — get one at https://resend.com/api-keys
//   RESET_FROM_EMAIL — sender address, must be on a verified Resend domain
//                      (e.g. 'security@amari.yourdomain.com').
//                      Defaults to 'onboarding@resend.dev' which only works
//                      when sending TO the email tied to your Resend account
//                      (good for local testing, not for real users).

interface SendResult {
  ok: boolean;
  reason?: 'not_configured' | 'send_failed';
  error?: string;
}

const DEFAULT_FROM = 'onboarding@resend.dev';

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendPasswordResetEmail(args: {
  toEmail: string;
  toName?: string | null;
  resetUrl: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: 'not_configured' };

  const from = process.env.RESET_FROM_EMAIL || DEFAULT_FROM;
  const subject = 'Reset your Amari password';
  const greetingName = args.toName ? args.toName.split(' ')[0] : '';

  const text = [
    greetingName ? `Hi ${greetingName},` : 'Hi,',
    '',
    'A password reset was requested for your Amari account. Open this link within the next hour to set a new password:',
    '',
    args.resetUrl,
    '',
    "If you didn't request this, ignore this email — your password stays unchanged and the link expires on its own.",
    '',
    '— Amari',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0a0a0c; color:#e5e5e5; padding:32px;">
  <div style="max-width:540px; margin:0 auto; background:#111114; border:1px solid #2a2a2e; border-radius:12px; padding:32px;">
    <h1 style="font-size:18px; font-weight:600; margin:0 0 16px; color:#fff;">Reset your Amari password</h1>
    <p style="font-size:14px; line-height:1.55; color:#c5c5c5; margin:0 0 18px;">
      ${greetingName ? `Hi ${greetingName},` : 'Hi,'}
    </p>
    <p style="font-size:14px; line-height:1.55; color:#c5c5c5; margin:0 0 18px;">
      A password reset was requested for your Amari account. Click the button below within the next <strong>hour</strong> to set a new password.
    </p>
    <p style="margin:24px 0;">
      <a href="${args.resetUrl}" style="display:inline-block; padding:11px 18px; background:#c9a87a; color:#0a0a0c; font-weight:600; text-decoration:none; border-radius:8px; font-size:14px;">Reset password</a>
    </p>
    <p style="font-size:12px; line-height:1.6; color:#888; margin:18px 0 0;">
      Or open this link manually:<br/>
      <span style="word-break:break-all; color:#aaa;">${args.resetUrl}</span>
    </p>
    <p style="font-size:12px; line-height:1.55; color:#666; margin:24px 0 0; padding-top:16px; border-top:1px solid #2a2a2e;">
      If you didn't request this, ignore this email — your password stays unchanged and the link expires on its own.
    </p>
  </div>
</body></html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: args.toEmail,
        subject,
        text,
        html,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return { ok: false, reason: 'send_failed', error: `resend_http_${r.status} ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: 'send_failed', error: e?.message || 'unknown' };
  }
}
