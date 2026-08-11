import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listCustomCategorySuggestions } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

/**
 * Any signed-in user can read the list — needed by team members
 * categorizing their own claimed rows. Admins and team members
 * share the same custom-category dictionary so labeling stays
 * consistent across the org.
 */
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const suggestions = listCustomCategorySuggestions(100);
  return NextResponse.json({ suggestions });
}
