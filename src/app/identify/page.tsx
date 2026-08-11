import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listUnclaimedTransactions } from '@/lib/db/queries';
import { ACCOUNTS } from '@/constants/accounts';
import { fmtMoney } from '@/lib/format';
import IdentifyClient from './IdentifyClient';

export const dynamic = 'force-dynamic';

/**
 * Any signed-in user (OWNER / EDITOR / PARTNER / TEAM_MEMBER) can view
 * this queue — cofounders NEED read access here to spot their own
 * charges. The claim server action itself enforces that non-editors
 * can only claim for themselves.
 */
export default function IdentifyPage() {
  const user = requireUser();
  const rows = listUnclaimedTransactions(200);

  const enriched = rows.map((r) => {
    const acct = ACCOUNTS.find((a) => a.id === r.accountId);
    return {
      id: r.id,
      postingDate: r.postingDate,
      description: r.description,
      merchantName: r.merchantName,
      amount: r.amount,
      accountLast4: acct?.last4 || r.accountId,
      accountLabel: acct?.label || '',
      identificationNote: r.identificationNote,
      formattedAmount: fmtMoney(r.amount),
    };
  });

  return (
    <div className="page-pad-mobile" style={{ padding: '24px 24px 100px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
          Banking / Identify
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-.02em', color: 'var(--ink)' }}>
          <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>
            Whose
          </em>{' '}
          charge is this?
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.55, maxWidth: 620 }}>
          Transactions that couldn&apos;t be auto-identified. Anyone on the team who
          recognizes one from their own records can claim it — the row moves out
          of this queue and gets tagged to them.
        </p>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span
            className="pill"
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 999,
              color: 'var(--gold)',
              background: 'color-mix(in oklab, var(--gold) 10%, transparent)',
              border: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)',
            }}
          >
            {rows.length} pending
          </span>
          <Link href="/transactions" className="btn btn-sm">Back to transactions</Link>
        </div>
      </div>

      <IdentifyClient
        rows={enriched}
        currentUserName={user.name || user.email}
        canClaimForOthers={user.role === 'OWNER' || user.role === 'EDITOR'}
      />
    </div>
  );
}
