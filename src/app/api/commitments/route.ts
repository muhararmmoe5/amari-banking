import { NextResponse } from 'next/server';
import { listCommitments, getPerson } from '@/lib/db/cap';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = getCurrentUser();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const commitments = listCommitments()
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => {
      const person = getPerson(c.personId);
      return {
        id: c.id,
        entity: c.entity,
        personId: c.personId,
        personName: person?.name || null,
        monthlyAmountCents: c.monthlyAmountCents,
        equityPercent: c.equityPercent,
      };
    });
  return NextResponse.json({ commitments });
}
