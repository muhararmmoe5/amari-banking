import Twilio from 'twilio';

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  }
  return Twilio(sid, token);
}

export function getTwilioFromNumber() {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error('Missing TWILIO_FROM_NUMBER');
  return from;
}

export function getPublicBaseUrl() {
  const url = process.env.PUBLIC_BASE_URL;
  if (!url) throw new Error('Missing PUBLIC_BASE_URL');
  return url.replace(/\/$/, '');
}

export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\s()\-.]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return '+1' + trimmed;
  return null;
}
