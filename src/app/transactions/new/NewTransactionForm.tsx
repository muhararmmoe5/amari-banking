'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, MinusCircle, PlusCircle } from 'lucide-react';
import { createTransactionAction } from '../actions';
import type { EntityType } from '@/types';

interface AccountLite { id: string; last4: string; label: string; entity: string }
interface InflowOption { id: string; postingDate: string; description: string; merchant: string | null; amount: number }

const TYPE_OPTIONS = [
  'CARD', 'ACH_IN', 'ACH_OUT', 'WIRE_IN', 'WIRE_OUT', 'TRANSFER',
  'CHASE_TO_PARTNERFI', 'CHECK', 'FEE', 'OTHER',
];

function fmtMoney(n: number) {
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function NewTransactionForm({
  accounts, entityOptions, initialAccountId, initialInflows,
}: {
  accounts: AccountLite[];
  entityOptions: { value: EntityType; label: string }[];
  initialAccountId: string;
  initialInflows: InflowOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [accountId, setAccountId] = useState(initialAccountId);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [type, setType] = useState<string>('CARD');
  const [entity, setEntity] = useState<EntityType | ''>('');
  const [individual, setIndividual] = useState('');
  const [fundedById, setFundedById] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [inflows, setInflows] = useState<InflowOption[]>(initialInflows);

  // Refetch inflows when the account changes so the source picker reflects
  // the chosen account.
  useEffect(() => {
    if (accountId === initialAccountId) {
      setInflows(initialInflows);
      return;
    }
    let cancelled = false;
    fetch(`/api/transactions/inflows?accountId=${encodeURIComponent(accountId)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && Array.isArray(d.inflows)) setInflows(d.inflows); })
      .catch(() => { if (!cancelled) setInflows([]); });
    return () => { cancelled = true; };
  }, [accountId, initialAccountId, initialInflows]);

  const numericAmount = useMemo(() => {
    const raw = parseFloat(amount);
    if (!isFinite(raw) || raw === 0) return 0;
    return direction === 'out' ? -Math.abs(raw) : Math.abs(raw);
  }, [amount, direction]);

  const canSubmit = !!accountId && !!postingDate && description.trim().length > 0 && numericAmount !== 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    startTransition(async () => {
      try {
        const res = await createTransactionAction({
          accountId,
          postingDate,
          description: description.trim(),
          amount: numericAmount,
          type: type || null,
          merchantName: merchant.trim() || null,
          confirmedEntity: entity || null,
          individual: individual.trim() || null,
          fundedByTransactionId: direction === 'out' ? (fundedById || null) : null,
          notes: notes.trim() || null,
        });
        router.push(`/transactions/${res.id}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to create');
      }
    });
  }

  const label = (txt: string) => (
    <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 6 }}>
      {txt}
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-1, #111114)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--ink)',
    outline: 'none',
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/transactions" className="flex items-center" style={{ gap: 6, fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none' }}>
          <ArrowLeft size={13} /> Back to transactions
        </Link>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
            Banking / Transactions / New
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-.02em', color: 'var(--ink)' }}>
            <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>Add</em>{' '}
            a transaction
          </h1>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
            Manual entry — for expenses you can pick the inflow that funded it.
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Direction toggle */}
        <div>
          {label('Direction')}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setDirection('out')}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 8, fontSize: 12.5,
                border: '1px solid ' + (direction === 'out' ? 'color-mix(in oklab, var(--gold) 35%, rgba(255,255,255,0.06))' : 'rgba(255,255,255,0.06)'),
                background: direction === 'out' ? 'color-mix(in oklab, var(--gold) 9%, var(--bg-1, #111114))' : 'var(--bg-1, #111114)',
                color: direction === 'out' ? 'var(--gold)' : 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
              }}
            >
              <MinusCircle size={14} /> Expense (money out)
            </button>
            <button
              type="button"
              onClick={() => setDirection('in')}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 8, fontSize: 12.5,
                border: '1px solid ' + (direction === 'in' ? 'color-mix(in oklab, var(--income) 35%, rgba(255,255,255,0.06))' : 'rgba(255,255,255,0.06)'),
                background: direction === 'in' ? 'color-mix(in oklab, var(--income) 9%, var(--bg-1, #111114))' : 'var(--bg-1, #111114)',
                color: direction === 'in' ? 'var(--income)' : 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
              }}
            >
              <PlusCircle size={14} /> Income (money in)
            </button>
          </div>
        </div>

        {/* Account + Date side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            {label('Account')}
            <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setFundedById(''); }} style={inputStyle}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>····{a.last4} · {a.label}</option>
              ))}
            </select>
          </div>
          <div>
            {label('Date')}
            <input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Amount */}
        <div>
          {label('Amount')}
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 14, color: direction === 'out' ? 'var(--gold)' : 'var(--income)',
              }}
            >
              {direction === 'out' ? '−$' : '+$'}
            </span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
          {numericAmount !== 0 ? (
            <div className="num" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              Will record as <span style={{ color: direction === 'out' ? 'var(--gold)' : 'var(--income)' }}>{fmtMoney(numericAmount)}</span>
            </div>
          ) : null}
        </div>

        {/* Description + Merchant */}
        <div>
          {label('Description')}
          <input
            type="text"
            placeholder="ZELLE PAYMENT TO JACKY"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            {label('Merchant (optional)')}
            <input type="text" placeholder="Jacky" value={merchant} onChange={(e) => setMerchant(e.target.value)} style={inputStyle} />
          </div>
          <div>
            {label('Type')}
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Source of money — only for expenses */}
        {direction === 'out' ? (
          <div>
            {label('Source of money (optional)')}
            <select value={fundedById} onChange={(e) => setFundedById(e.target.value)} style={inputStyle}>
              <option value="">— Auto (FIFO trace) —</option>
              {inflows.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.postingDate} · {(i.merchant || i.description).slice(0, 40)} · +${i.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>
              Pick which inflow on ····{accounts.find((a) => a.id === accountId)?.last4} funded this expense. Leave blank to let the FIFO trace figure it out.
            </div>
          </div>
        ) : null}

        {/* Entity + Individual */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            {label('Owner — entity')}
            <select value={entity} onChange={(e) => setEntity(e.target.value as EntityType)} style={inputStyle}>
              <option value="">— Unspecified —</option>
              {entityOptions.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div>
            {label('Owner — person (optional)')}
            <input type="text" placeholder="Mohammed Muharram" value={individual} onChange={(e) => setIndividual(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Notes */}
        <div>
          {label('Notes (optional)')}
          <textarea
            rows={3}
            placeholder="Anything you want a CPA to see"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {err ? (
          <div style={{ fontSize: 12, color: 'var(--danger, #ff7676)' }}>{err}</div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Link href="/transactions" className="btn" style={{ flex: 1, textAlign: 'center' }}>Cancel</Link>
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="btn btn-primary"
            style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              opacity: !canSubmit || isPending ? 0.5 : 1,
            }}
          >
            <Save size={14} /> {isPending ? 'Saving…' : 'Save transaction'}
          </button>
        </div>
      </form>
    </div>
  );
}
