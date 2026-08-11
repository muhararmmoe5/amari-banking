'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, UserCheck } from 'lucide-react';
import { claimTransactionAction, flagForIdentificationAction } from '../transactions/actions';

interface Row {
  id: string;
  postingDate: string;
  description: string;
  merchantName: string | null;
  amount: number;
  accountLast4: string;
  accountLabel: string;
  identificationNote: string | null;
  formattedAmount: string;
}

export default function IdentifyClient({
  rows: initialRows, currentUserName, canClaimForOthers,
}: {
  rows: Row[];
  currentUserName: string;
  canClaimForOthers: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', border: '0.5px dashed rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 26, marginBottom: 6 }}>🎉</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 6 }}>
          Nothing to identify
        </div>
        <div style={{ marginBottom: 14 }}>
          Every flagged transaction has been claimed. Flag more from any transaction&apos;s detail page.
        </div>
        <Link href="/transactions" className="btn">Back to transactions</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {msg ? (
        <div style={{ fontSize: 12, color: 'var(--income)', padding: '6px 10px', borderRadius: 8, background: 'color-mix(in oklab, var(--income) 8%, transparent)' }}>
          {msg}
        </div>
      ) : null}
      {rows.map((r) => (
        <IdentifyRow
          key={r.id}
          row={r}
          currentUserName={currentUserName}
          canClaimForOthers={canClaimForOthers}
          isPending={isPending}
          onClaim={(name, andEdit) => {
            startTransition(async () => {
              try {
                await claimTransactionAction(r.id, name);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                setMsg(`Claimed for ${name} — moved out of queue.`);
                if (andEdit) {
                  // For "This was me → fill in details" we jump straight to
                  // the detail page. The claimant can now edit their row.
                  router.push(`/transactions/${r.id}`);
                } else {
                  router.refresh();
                }
              } catch (e) {
                setMsg(`Failed: ${e instanceof Error ? e.message : 'unknown'}`);
              }
            });
          }}
          onUnflag={() => {
            startTransition(async () => {
              try {
                await flagForIdentificationAction(r.id, false, null);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                setMsg('Removed from queue (still uncategorized).');
                router.refresh();
              } catch (e) {
                setMsg(`Failed: ${e instanceof Error ? e.message : 'unknown'}`);
              }
            });
          }}
        />
      ))}
    </div>
  );
}

function IdentifyRow({
  row, currentUserName, canClaimForOthers, isPending, onClaim, onUnflag,
}: {
  row: Row;
  currentUserName: string;
  canClaimForOthers: boolean;
  isPending: boolean;
  onClaim: (name: string, andEdit: boolean) => void;
  onUnflag: () => void;
}) {
  const [otherName, setOtherName] = useState('');
  const [showOther, setShowOther] = useState(false);
  const isExpense = row.amount < 0;

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'var(--bg-1, #111114)',
      }}
    >
      <div className="flex items-start" style={{ gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="num" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            {row.postingDate} · ····{row.accountLast4}
          </div>
          <div className="truncate" style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 3 }}>
            {row.merchantName || row.description.slice(0, 60)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }} className="truncate">
            {row.description}
          </div>
          {row.identificationNote ? (
            <div style={{
              marginTop: 6, padding: '5px 8px', borderRadius: 6,
              background: 'color-mix(in oklab, var(--gold) 6%, transparent)',
              border: '0.5px solid color-mix(in oklab, var(--gold) 20%, transparent)',
              fontSize: 11, color: 'var(--ink-2)',
            }}>
              <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>Note:</em> {row.identificationNote}
            </div>
          ) : null}
        </div>
        <div className="num" style={{ fontSize: 15, fontWeight: 500, color: isExpense ? 'var(--gold)' : 'var(--income)', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {row.formattedAmount}
        </div>
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => onClaim(currentUserName, true)}
          disabled={isPending}
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '6px 12px', opacity: isPending ? 0.5 : 1 }}
          title="Claim as yours and jump to the detail page to fill in category, purpose, etc."
        >
          <UserCheck size={13} /> This was me — fill in details
        </button>
        <button
          type="button"
          onClick={() => onClaim(currentUserName, false)}
          disabled={isPending}
          className="btn"
          style={{ fontSize: 12, padding: '6px 12px', opacity: isPending ? 0.5 : 1 }}
          title="Claim as yours without filling anything else in right now"
        >
          Just claim
        </button>

        {canClaimForOthers ? (
          !showOther ? (
            <button
              type="button"
              onClick={() => setShowOther(true)}
              className="btn"
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              Claim for someone else
            </button>
          ) : (
            <div className="flex items-center" style={{ gap: 6 }}>
              <input
                type="text"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="Their name"
                autoFocus
                style={{
                  padding: '6px 10px',
                  background: 'var(--bg-2, #16161a)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--ink)',
                  outline: 'none',
                  minWidth: 120,
                }}
              />
              <button
                type="button"
                onClick={() => { if (otherName.trim()) onClaim(otherName.trim(), false); }}
                disabled={isPending || !otherName.trim()}
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '6px 10px', opacity: (isPending || !otherName.trim()) ? 0.5 : 1 }}
              >
                <Check size={12} /> Assign
              </button>
              <button
                type="button"
                onClick={() => { setShowOther(false); setOtherName(''); }}
                className="btn"
                style={{ fontSize: 11, padding: '4px 8px', color: 'var(--ink-3)' }}
              >
                Cancel
              </button>
            </div>
          )
        ) : null}

        <div style={{ flex: 1 }} />

        {canClaimForOthers ? (
          <button
            type="button"
            onClick={onUnflag}
            disabled={isPending}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '5px 10px', color: 'var(--ink-3)' }}
            title="Remove from queue without claiming — the tx stays uncategorized"
          >
            Remove flag
          </button>
        ) : null}

        <Link
          href={`/transactions/${row.id}`}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 3, padding: '4px 6px',
          }}
        >
          Detail <ChevronRight size={11} />
        </Link>
      </div>
    </div>
  );
}
