import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { createInvite, type UserRole } from '@/lib/auth/sessions';
import { createPerson, listPeople } from '@/lib/db/cap';

export const dynamic = 'force-dynamic';

/**
 * OWNER-only endpoint to mint an invite URL for an email. Reuses an
 * existing `people` row when one already has this email; otherwise
 * creates one on the fly.
 *
 * POST body:
 *   { email: string, role?: 'OWNER'|'PARTNER'|'CPA'|..., name?: string }
 *
 * Response:
 *   { url, token, expiresAt, person: { id, name, reused } }
 */
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { email?: string; role?: string; name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  }
  const role = (body.role || 'PARTNER') as UserRole;

  // Reuse an existing person with this email if there is one.
  const existing = listPeople().find(
    (p) => p.email && p.email.toLowerCase() === email,
  );
  // PersonRole is the org-graph classification (FOUNDER/EMPLOYEE/etc), NOT
  // the auth role. Default to OTHER when we're minting a person on the fly.
  const person = existing || createPerson({
    name: body.name?.trim() || email.split('@')[0],
    email,
    role: 'OTHER',
    notes: 'Invited via /api/admin/create-invite',
  });

  const invite = createInvite(person.id, email, role, user.id);

  const h = headers();
  const host = h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/invite/${invite.token}`;

  return NextResponse.json({
    url,
    token: invite.token,
    expiresAt: invite.expiresAt,
    person: { id: person.id, name: person.name, reused: !!existing },
  });
}
