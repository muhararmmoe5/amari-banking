import { NextRequest, NextResponse } from 'next/server';
import { listPeople, createPerson } from '@/lib/db/cap';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const people = listPeople();
  return NextResponse.json({
    people: people.map((p) => ({ id: p.id, name: p.name, role: p.role, email: p.email })),
  });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const email = body.email ? String(body.email).trim() : null;
  const role = body.role ? String(body.role).trim() : 'OTHER';
  const p = createPerson({ name, email, role: role as any });
  return NextResponse.json({ person: { id: p.id, name: p.name, role: p.role, email: p.email } });
}
