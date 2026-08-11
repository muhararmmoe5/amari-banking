import { NextRequest, NextResponse } from 'next/server';
import { listPeople, createPerson } from '@/lib/db/cap';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const people = listPeople();
  return NextResponse.json({
    people: people.map((p) => ({ id: p.id, name: p.name, role: p.role, email: p.email })),
  });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const email = body.email ? String(body.email).trim() : null;
  // Allow-list on PersonRole so a rogue client can't pollute people.role.
  const VALID_PERSON_ROLES = ['FOUNDER', 'INVESTOR', 'EMPLOYEE', 'CONTRACTOR', 'ADVISOR', 'OTHER'] as const;
  type PersonRoleUnion = typeof VALID_PERSON_ROLES[number];
  const requestedRole = body.role ? String(body.role).trim() : 'OTHER';
  const role: PersonRoleUnion = (VALID_PERSON_ROLES as readonly string[]).includes(requestedRole)
    ? (requestedRole as PersonRoleUnion) : 'OTHER';
  const p = createPerson({ name, email, role });
  return NextResponse.json({ person: { id: p.id, name: p.name, role: p.role, email: p.email } });
}
