import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';
import { classifyBatchWithClaude, type ClassifyInput } from '@/lib/ai/classify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * OWNER/EDITOR-only. Accepts up to 40 transaction summaries, calls Claude
 * with a cached system prompt (entity + account catalogue), and returns
 * per-transaction suggestions the bulk-review UI can merge into the
 * existing rule-based row state.
 *
 * Body: { transactions: ClassifyInput[] }
 * Response: { suggestions: ClassifySuggestion[] }
 */
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { transactions?: ClassifyInput[] } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  const items = Array.isArray(body.transactions) ? body.transactions : [];
  if (items.length === 0) return NextResponse.json({ suggestions: [] });
  if (items.length > 40) return NextResponse.json({ error: 'batch too large (max 40)' }, { status: 400 });

  try {
    const suggestions = await classifyBatchWithClaude(items);
    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json(
      { error: 'classification_failed', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
