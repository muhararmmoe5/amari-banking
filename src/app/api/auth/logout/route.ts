import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/auth/sessions';
import { SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return POST();
}
