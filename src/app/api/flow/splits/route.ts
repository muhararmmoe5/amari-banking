import { NextRequest, NextResponse } from 'next/server';
import { listFundingSplits, addFundingSplit, deleteFundingSplit } from '@/lib/db/queries';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const expenseTxId = req.nextUrl.searchParams.get('expenseTxId');
  if (!expenseTxId) return NextResponse.json({ error: 'expenseTxId required' }, { status: 400 });
  return NextResponse.json({ splits: listFundingSplits(expenseTxId) });
}

export async function POST(req: NextRequest) {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const expenseTxId = String(body.expenseTxId || '');
  const sourceTxId = body.sourceTxId ? String(body.sourceTxId) : null;
  const sourceLabel = body.sourceLabel ? String(body.sourceLabel) : null;
  const amount = Number(body.amount);
  const notes = body.notes ? String(body.notes) : null;
  if (!expenseTxId) return NextResponse.json({ error: 'expenseTxId required' }, { status: 400 });
  if (!sourceTxId && !sourceLabel) return NextResponse.json({ error: 'sourceTxId or sourceLabel required' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'invalid amount' }, { status: 400 });
  const split = addFundingSplit({
    expenseTxId,
    sourceTxId,
    sourceLabel,
    amountCents: Math.round(amount * 100),
    notes,
    fromAI: !!body.fromAI,
  });
  return NextResponse.json({ split });
}

export async function DELETE(req: NextRequest) {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  deleteFundingSplit(id);
  return NextResponse.json({ ok: true });
}
