'use client';

import { useDashCtx } from '@/components/dash/DashCtx';
import { BankChip, CardVisual, AcctRow } from '@/components/dash/Banks';
import { ENTITIES, PERSONAL_ACCOUNTS, accountsFor } from '@/lib/dash/fixtures';
import { $compact } from '@/lib/dash/format';
import type { Account, AccountKind } from '@/lib/dash/types';

const GROUP_LABELS: Record<AccountKind, string> = {
  deposit: 'Cash & deposits',
  treasury: 'Treasury / Money Mkt',
  processor: 'Payment processors',
  fx: 'FX / multi-currency',
  credit: 'Credit cards',
  investment: 'Investments',
  retirement: 'Retirement',
  crypto: 'Crypto',
};

const GROUP_ORDER: AccountKind[] = [
  'deposit',
  'treasury',
  'processor',
  'fx',
  'credit',
  'investment',
  'retirement',
  'crypto',
];

export default function AccountsPage() {
  const { mode, entity } = useDashCtx();
  const personal = mode === 'personal';
  const accounts: Account[] = personal ? PERSONAL_ACCOUNTS : accountsFor(entity);
  const ent = ENTITIES[entity];

  const groups: Record<AccountKind, Account[]> = {
    deposit: [], treasury: [], processor: [], fx: [],
    credit: [], investment: [], retirement: [], crypto: [],
  };
  accounts.forEach((a) => groups[a.kind].push(a));

  const liquidKinds: AccountKind[] = ['deposit', 'treasury', 'processor', 'fx', 'investment', 'retirement', 'crypto'];
  const liquid = accounts.filter((a) => liquidKinds.includes(a.kind)).reduce((s, a) => s + a.balance, 0);
  const credit = -accounts.filter((a) => a.kind === 'credit').reduce((s, a) => s + a.balance, 0);
  const insts = new Set(accounts.map((a) => a.inst));
  const reauth = accounts.filter((a) => a.reauth).length;

  return (
    <div className="ds-page">
      <div className="ds-page-h">
        <div className="ds-page-h-l">
          <div className="ds-page-eyebrow">
            {personal ? 'PERSONAL · BANKING' : `BUSINESS · ${ent.short.toUpperCase()} · BANKING`}
          </div>
          <h1 className="ds-page-title">
            <em>Banks</em> &amp; cards
          </h1>
          <div className="ds-page-sub">
            {accounts.length} accounts across {insts.size} institutions
            {reauth > 0 ? <span className="ds-warn"> · {reauth} need re-auth</span> : null}
          </div>
        </div>
        <div className="ds-page-h-r">
          <button className="ds-btn ghost" type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 12 a9 9 0 1 1 -9 -9" strokeLinecap="round" />
              <path d="M21 4 V12 H13" strokeLinecap="round" />
            </svg>
            Sync all
          </button>
          <button className="ds-btn gold" type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5 V19 M5 12 H19" />
            </svg>
            Connect institution
          </button>
        </div>
      </div>

      <div className="ds-bk-hero">
        <div className="ds-bk-hero-cell">
          <div className="ds-bk-hero-lbl">LIQUID + INVESTED</div>
          <div className="ds-bk-hero-num">{$compact(liquid)}</div>
          <div className="ds-bk-hero-sub">across {accounts.filter((a) => a.kind !== 'credit').length} accounts</div>
        </div>
        <div className="ds-bk-hero-div" />
        <div className="ds-bk-hero-cell">
          <div className="ds-bk-hero-lbl">CREDIT BALANCE</div>
          <div className={'ds-bk-hero-num ' + (credit > 0 ? 'neg' : '')}>{$compact(credit)}</div>
          <div className="ds-bk-hero-sub">{accounts.filter((a) => a.kind === 'credit').length} cards</div>
        </div>
        <div className="ds-bk-hero-div" />
        <div className="ds-bk-hero-cell">
          <div className="ds-bk-hero-lbl">NET POSITION</div>
          <div className="ds-bk-hero-num pos">{$compact(liquid - credit)}</div>
          <div className="ds-bk-hero-sub">{personal ? 'personal' : ent.short}</div>
        </div>
      </div>

      {reauth > 0 ? (
        <div className="ds-bk-reauth">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 4 L22 20 H2 Z" strokeLinejoin="round" />
            <path d="M12 10 V14 M12 17.5 V17.6" strokeLinecap="round" />
          </svg>
          <div className="ds-bk-reauth-text">
            <b>{reauth} {reauth === 1 ? 'institution needs' : 'institutions need'} re-authentication.</b>
            <span> Your sync has stopped — connect now to continue posting transactions.</span>
          </div>
          <button className="ds-btn sm" type="button">Re-authenticate</button>
        </div>
      ) : null}

      <section className="ds-bk-section">
        <div className="ds-bk-section-h">
          <div className="ds-eyebrow mute">CARDS &amp; CHIPS</div>
          <div className="ds-bk-section-sub">Tap to view details · drag to reorder</div>
        </div>
        <div className="ds-bk-cardgrid">
          {accounts
            .filter((a) => ['deposit', 'treasury', 'credit', 'processor'].includes(a.kind))
            .map((a) => (
              <CardVisual key={a.id} acct={a} />
            ))}
        </div>
      </section>

      <section className="ds-bk-section">
        <div className="ds-bk-section-h">
          <div className="ds-eyebrow mute">FULL LEDGER</div>
          <div className="ds-bk-section-sub">{accounts.length} accounts · grouped by type</div>
        </div>

        {GROUP_ORDER.filter((k) => groups[k].length > 0).map((k) => (
          <div key={k} className="ds-bk-group">
            <div className="ds-bk-group-h">
              <span className="ds-bk-group-lbl">{GROUP_LABELS[k]}</span>
              <span className="ds-bk-group-ct">{groups[k].length}</span>
              <span className="ds-bk-group-tot">{$compact(groups[k].reduce((s, a) => s + a.balance, 0))}</span>
            </div>
            <table className="ds-acct-table">
              <tbody>
                {groups[k].map((a) => (
                  <AcctRow key={a.id} acct={a} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="ds-bk-security">
        <div className="ds-bk-security-l">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
            <path d="M9 12 L11 14 L15 10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="ds-bk-security-ttl">Bank-grade security</div>
            <div className="ds-bk-security-sub">256-bit AES encryption · SOC 2 Type II · Read-only Plaid · Multi-factor required</div>
          </div>
        </div>
        <div className="ds-bk-security-r">
          <span className="ds-chip"><span className="ds-chip-dot" style={{ background: 'var(--ds-pos)' }} />Plaid · live</span>
          <span className="ds-chip"><span className="ds-chip-dot" style={{ background: 'var(--ds-pos)' }} />SOC 2</span>
        </div>
      </section>
    </div>
  );
}
