import { NextRequest, NextResponse } from 'next/server';
import { listOptionsGrouped, createOption, OPTION_FIELDS, type OptionField } from '@/lib/db/options';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = getCurrentUser();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const grouped = listOptionsGrouped();
  return NextResponse.json({ options: grouped });
}

export async function POST(req: NextRequest) {
  const u = getCurrentUser();
  if (!u || u.role !== 'OWNER') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const field = body?.field as OptionField;
  const value = String(body?.value || '');
  if (!(OPTION_FIELDS as readonly string[]).includes(field)) {
    return NextResponse.json({ error: 'bad_field' }, { status: 400 });
  }
  const o = createOption(field, value);
  if (!o) return NextResponse.json({ error: 'invalid_value' }, { status: 400 });
  return NextResponse.json({ option: o });
}
