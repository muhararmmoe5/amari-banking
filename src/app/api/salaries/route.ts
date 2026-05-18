import { NextResponse } from 'next/server';
import { listSalaries } from '@/lib/db/salaries';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = getCurrentUser();
  if (!u || u.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ salaries: listSalaries({ activeOnly: true }) });
}
