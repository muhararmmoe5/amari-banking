import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import {
  getTwilioClient,
  getTwilioFromNumber,
  getPublicBaseUrl,
  normalizePhone,
} from '@/lib/twilio';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { initiator?: string; partyA?: string; partyB?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const initiator = normalizePhone(body.initiator || '');
  const partyA = normalizePhone(body.partyA || '');
  const partyB = normalizePhone(body.partyB || '');
  if (!initiator || !partyA || !partyB) {
    return NextResponse.json(
      { error: 'all three numbers required in E.164 format (e.g. +15551234567)' },
      { status: 400 },
    );
  }

  let client, from, base;
  try {
    client = getTwilioClient();
    from = getTwilioFromNumber();
    base = getPublicBaseUrl();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const conference = 'cf_' + randomBytes(6).toString('hex');

  const joinUrl = (muted: boolean, endsConference: boolean) =>
    `${base}/api/voice/join?conf=${conference}` +
    `&muted=${muted ? '1' : '0'}&end=${endsConference ? '1' : '0'}`;

  try {
    const [callInitiator, callA, callB] = await Promise.all([
      client.calls.create({ to: initiator, from, url: joinUrl(true, true) }),
      client.calls.create({ to: partyA, from, url: joinUrl(false, false) }),
      client.calls.create({ to: partyB, from, url: joinUrl(false, false) }),
    ]);
    return NextResponse.json({
      conference,
      sids: {
        initiator: callInitiator.sid,
        partyA: callA.sid,
        partyB: callB.sid,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'twilio call failed' },
      { status: 502 },
    );
  }
}
