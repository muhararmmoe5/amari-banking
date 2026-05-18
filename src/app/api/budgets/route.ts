import { NextResponse } from 'next/server';
import { listBudgets } from '@/lib/db/budgets';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = getCurrentUser();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const budgets = listBudgets({ activeOnly: true }).map((b) => ({
    id: b.id,
    name: b.name,
    entity: b.entity,
    kind: b.kind,
    monthlyAmountCents: b.monthlyAmountCents,
  }));
  return NextResponse.json({ budgets });
}
