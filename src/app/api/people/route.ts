import { NextResponse } from 'next/server';
import { listPeople } from '@/lib/db/cap';
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
