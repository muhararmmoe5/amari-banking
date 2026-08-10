import { NextRequest, NextResponse } from 'next/server';
import { traceFundingSource } from '@/lib/db/flow-trace';
import { addFundingSplit, listFundingSplits } from '@/lib/db/queries';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Run FIFO trace on this expense and persist the top source(s) as AI-tagged
 *  funding splits. Returns the resulting split list. */
export async function POST(req: NextRequest) {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const txId = String(body.txId || '');
  if (!txId) return NextResponse.json({ error: 'txId required' }, { status: 400 });

  const trace = traceFundingSource(txId);
  if (!trace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!trace.sources || trace.sources.length === 0) {
    return NextResponse.json({ error: 'no_source_found', splits: listFundingSplits(txId) }, { status: 200 });
  }

  // Don't double-write — if AI splits already exist, return existing.
  const existing = listFundingSplits(txId);
  if (existing.some((s) => s.fromAI)) {
    return NextResponse.json({ splits: existing, alreadyTagged: true });
  }

  for (const src of trace.sources) {
    addFundingSplit({
      expenseTxId: txId,
      sourceTxId: src.txId,
      sourceLabel: src.merchant || src.incomeSource || 'AI traced source',
      amountCents: Math.round(Math.abs(src.amount) * 100),
      notes: 'AI · traced via FIFO',
      fromAI: true,
    });
  }

  return NextResponse.json({ splits: listFundingSplits(txId) });
}
