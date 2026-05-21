import { NextResponse } from 'next/server';
import Twilio from 'twilio';

export const runtime = 'nodejs';

function buildTwiml(conf: string, muted: boolean, endsConference: boolean) {
  const r = new Twilio.twiml.VoiceResponse();
  const dial = r.dial({ timeLimit: 60 * 60 });
  dial.conference(
    {
      beep: 'false' as any,
      startConferenceOnEnter: true,
      endConferenceOnExit: endsConference,
      muted,
      waitUrl: '',
    },
    conf,
  );
  return r.toString();
}

function handle(req: Request) {
  const url = new URL(req.url);
  const conf = url.searchParams.get('conf') || '';
  const muted = url.searchParams.get('muted') === '1';
  const end = url.searchParams.get('end') === '1';
  if (!conf) {
    return new NextResponse('missing conf', { status: 400 });
  }
  const xml = buildTwiml(conf, muted, end);
  return new NextResponse(xml, {
    status: 200,
    headers: { 'content-type': 'text/xml; charset=utf-8' },
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
