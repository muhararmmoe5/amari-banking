import { NextResponse } from 'next/server';
import { listCommitments, getPerson, commitmentFundedCents } from '@/lib/db/cap';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = getCurrentUser();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const commitments = listCommitments()
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => {
      const person = getPerson(c.personId);
      const fundedCents = commitmentFundedCents(c.id);
      const remainingCents = Math.max(0, c.totalAmountCents - fundedCents);
      const pctFunded = c.totalAmountCents > 0 ? Math.min(1, fundedCents / c.totalAmountCents) : 0;
      return {
        id: c.id,
        entity: c.entity,
        personId: c.personId,
        personName: person?.name || null,
        totalAmountCents: c.totalAmountCents,
        monthlyAmountCents: c.monthlyAmountCents,
        fundedCents,
        remainingCents,
        pctFunded,
        equityPercent: c.equityPercent,
      };
    });
  return NextResponse.json({ commitments });
}
