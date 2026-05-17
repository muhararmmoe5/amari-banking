import 'server-only';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/db';
import { ACCOUNTS, ENTITY_LABELS } from '@/constants/accounts';

export interface CpaExportOptions {
  dateFrom?: string;
  dateTo?: string;
}

export function generateCpaWorkbook(opts: CpaExportOptions = {}): Buffer {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.dateFrom) { where.push('posting_date >= @dateFrom'); params.dateFrom = opts.dateFrom; }
  if (opts.dateTo) { where.push('posting_date <= @dateTo'); params.dateTo = opts.dateTo; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const wb = XLSX.utils.book_new();

  // 1) Cover Sheet
  const portfolio = db.prepare(`
    SELECT
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses,
      COUNT(*) as totalCount,
      SUM(CASE WHEN audit_status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN audit_status = 'UNREVIEWED' THEN 1 ELSE 0 END) as unreviewed
    FROM transactions ${whereSql}
  `).get(params) as any;
  const cover = [
    ['Amari Ventures — CPA Package'],
    [],
    ['Period from', opts.dateFrom || 'beginning'],
    ['Period to', opts.dateTo || 'today'],
    ['Generated', new Date().toISOString()],
    [],
    ['Total external income', portfolio.income || 0],
    ['Total external expenses', portfolio.expenses || 0],
    ['Net cash flow', (portfolio.income || 0) - (portfolio.expenses || 0)],
    ['Transactions total', portfolio.totalCount || 0],
    ['Confirmed', portfolio.confirmed || 0],
    ['Unreviewed (see "Needs Review" tab)', portfolio.unreviewed || 0],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cover), 'Cover Sheet');

  // 2) By Account
  const byAccount = db.prepare(`
    SELECT
      account_id,
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses,
      SUM(CASE WHEN is_internal = 0 THEN amount ELSE 0 END) as net,
      COUNT(*) as count
    FROM transactions ${whereSql}
    GROUP BY account_id
    ORDER BY account_id
  `).all(params) as any[];
  const byAcctRows = [
    ['Account', 'Entity', 'Label', 'Income', 'Expenses', 'Net', 'Tx count'],
    ...byAccount.map((r) => {
      const a = ACCOUNTS.find((x) => x.id === r.account_id);
      return [
        r.account_id,
        a ? ENTITY_LABELS[a.entity] : 'Unknown',
        a?.label || '',
        r.income || 0,
        r.expenses || 0,
        r.net || 0,
        r.count || 0,
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byAcctRows), 'By Account');

  // 3) By Entity
  const byEntity = db.prepare(`
    SELECT
      COALESCE(confirmed_entity, entity_tag) as entity,
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses
    FROM transactions ${whereSql}
    GROUP BY entity
    ORDER BY income DESC
  `).all(params) as any[];
  const byEntityRows = [
    ['Entity', 'Income', 'Expenses', 'Net'],
    ...byEntity.map((r) => [
      ENTITY_LABELS[r.entity as keyof typeof ENTITY_LABELS] || r.entity,
      r.income || 0,
      r.expenses || 0,
      (r.income || 0) - (r.expenses || 0),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byEntityRows), 'By Entity');

  // 4) Income Breakdown
  const incomeBreak = db.prepare(`
    SELECT income_source, COALESCE(confirmed_entity, entity_tag) as entity, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE amount > 0 AND is_internal = 0 ${where.length ? 'AND ' + where.join(' AND ') : ''}
    GROUP BY income_source, entity
    ORDER BY total DESC
  `).all(params) as any[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Source', 'Entity', 'Total', 'Count'],
      ...incomeBreak.map((r) => [
        r.income_source || 'Unspecified',
        ENTITY_LABELS[r.entity as keyof typeof ENTITY_LABELS] || r.entity,
        r.total || 0,
        r.count || 0,
      ]),
    ]),
    'Income Breakdown'
  );

  // 5) Expense Breakdown
  const expenseBreak = db.prepare(`
    SELECT
      COALESCE(confirmed_entity, entity_tag) as entity,
      COALESCE(confirmed_category, category) as category,
      SUM(ABS(amount)) as total,
      COUNT(*) as count
    FROM transactions
    WHERE amount < 0 AND is_internal = 0 ${where.length ? 'AND ' + where.join(' AND ') : ''}
    GROUP BY entity, category
    ORDER BY total DESC
  `).all(params) as any[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Entity', 'Category', 'Total', 'Count'],
      ...expenseBreak.map((r) => [
        ENTITY_LABELS[r.entity as keyof typeof ENTITY_LABELS] || r.entity,
        r.category,
        r.total || 0,
        r.count || 0,
      ]),
    ]),
    'Expense Breakdown'
  );

  // 6) Contractor 1099 List
  const contractors = db.prepare(`
    SELECT zelle_person as person, SUM(ABS(amount)) as totalPaid, COUNT(*) as count,
      MIN(posting_date) as firstDate, MAX(posting_date) as lastDate,
      MAX(zelle_type) as zelleType
    FROM transactions
    WHERE zelle_person IS NOT NULL AND amount < 0 AND is_internal = 0
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    GROUP BY zelle_person
    HAVING totalPaid >= 600
    ORDER BY totalPaid DESC
  `).all(params) as any[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Recipient', 'Total Paid', '# Payments', 'First Payment', 'Last Payment', 'Type', '1099 Required'],
      ...contractors.map((r) => [
        r.person,
        r.totalPaid || 0,
        r.count || 0,
        r.firstDate,
        r.lastDate,
        r.zelleType || 'UNKNOWN',
        (r.zelleType === 'CONTRACTOR' || r.zelleType === 'COMPENSATION') ? 'YES' : 'Verify',
      ]),
    ]),
    'Contractor 1099 List'
  );

  // 7) Wires & International
  const wires = db.prepare(`
    SELECT posting_date, account_id, description, amount, audit_status, business_purpose, receipt_ref
    FROM transactions
    WHERE (category = 'EXPENSE_WIRE_INTL' OR category = 'EXPENSE_WIRE_DOMESTIC' OR category = 'EXPENSE_REMITTANCE')
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    ORDER BY posting_date DESC
  `).all(params) as any[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Date', 'Account', 'Description', 'Amount', 'Status', 'Business Purpose', 'Documentation'],
      ...wires.map((r) => [
        r.posting_date, r.account_id, r.description, r.amount, r.audit_status,
        r.business_purpose || '', r.receipt_ref || '',
      ]),
    ]),
    'Wires & International'
  );

  // 8) Spacetel Flow
  const spacetel = db.prepare(`
    SELECT posting_date, account_id, description, amount
    FROM transactions
    WHERE income_source IN ('SPACETEL','OMAR_ALGHAZALI')
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    ORDER BY posting_date DESC
  `).all(params) as any[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Date', 'Account', 'Description', 'Amount'],
      ...spacetel.map((r) => [r.posting_date, r.account_id, r.description, r.amount]),
    ]),
    'Spacetel Flow'
  );

  // 9) Full Ledger (confirmed) — emits one row per split if the tx has splits, else one row per tx
  const ledger = db.prepare(`
    SELECT t.id, t.posting_date, t.account_id, t.description, t.amount,
      COALESCE(t.confirmed_entity, t.entity_tag) as entity,
      COALESCE(t.confirmed_category, t.category) as category,
      t.audit_status, t.business_purpose, t.receipt_ref,
      t.individual, t.sub_category_1, t.sub_category_2, t.source_of_money, t.need_to_get_from,
      t.cpa_reviewed, t.tagged_date
    FROM transactions t
    WHERE t.audit_status IN ('CONFIRMED','TAGGED','PERSONAL_NO_DEDUCT')
      ${where.length ? 'AND ' + where.join(' AND ').replace(/posting_date/g, 't.posting_date') : ''}
    ORDER BY t.posting_date DESC
  `).all(params) as any[];

  const splitRows = db.prepare(`
    SELECT transaction_id, amount_cents, entity, category, individual,
      sub_category_1, sub_category_2, business_purpose, notes,
      period_start, period_end, sort_order
    FROM transaction_splits
    ORDER BY sort_order ASC, created_at ASC
  `).all() as any[];
  const splitsByTx = new Map<string, any[]>();
  for (const s of splitRows) {
    const list = splitsByTx.get(s.transaction_id) || [];
    list.push(s);
    splitsByTx.set(s.transaction_id, list);
  }

  const ledgerHeader = [
    'Date', 'Account', 'Description', 'Amount', 'Entity', 'Category',
    'Sub 1', 'Sub 2', 'Individual', 'Source of Money', 'Need to Get From',
    'Status', 'CPA Reviewed', 'Tagged Date', 'Period Start', 'Period End',
    'Purpose', 'Doc Ref', 'Split',
  ];
  const ledgerAoa: any[][] = [ledgerHeader];
  for (const r of ledger) {
    const splits = splitsByTx.get(r.id);
    if (splits && splits.length > 0) {
      splits.forEach((s, idx) => {
        ledgerAoa.push([
          r.posting_date,
          r.account_id,
          r.description,
          s.amount_cents / 100,
          ENTITY_LABELS[s.entity as keyof typeof ENTITY_LABELS] || s.entity,
          s.category || r.category,
          s.sub_category_1 || r.sub_category_1 || '',
          s.sub_category_2 || r.sub_category_2 || '',
          s.individual || r.individual || '',
          r.source_of_money || '',
          r.need_to_get_from || '',
          r.audit_status,
          r.cpa_reviewed ? 'YES' : 'NO',
          r.tagged_date || '',
          s.period_start || '',
          s.period_end || '',
          s.business_purpose || r.business_purpose || '',
          r.receipt_ref || '',
          `${idx + 1}/${splits.length}`,
        ]);
      });
    } else {
      ledgerAoa.push([
        r.posting_date, r.account_id, r.description, r.amount,
        ENTITY_LABELS[r.entity as keyof typeof ENTITY_LABELS] || r.entity,
        r.category, r.sub_category_1 || '', r.sub_category_2 || '',
        r.individual || '', r.source_of_money || '', r.need_to_get_from || '',
        r.audit_status,
        r.cpa_reviewed ? 'YES' : 'NO',
        r.tagged_date || '',
        '', '',
        r.business_purpose || '', r.receipt_ref || '',
        '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ledgerAoa), 'Full Ledger');

  // 10) Needs Review
  const needsReview = db.prepare(`
    SELECT posting_date, account_id, description, amount, category, entity_tag, audit_score
    FROM transactions
    WHERE audit_status = 'UNREVIEWED'
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    ORDER BY audit_score DESC, posting_date DESC
  `).all(params) as any[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Date', 'Account', 'Description', 'Amount', 'Auto-Category', 'Auto-Entity', 'Audit Score'],
      ...needsReview.map((r) => [
        r.posting_date, r.account_id, r.description, r.amount, r.category, r.entity_tag, r.audit_score,
      ]),
    ]),
    'Needs Review'
  );

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return out as Buffer;
}
