'use client';

import type { Account } from '@/lib/dash/types';
import { $, $compact } from '@/lib/dash/format';

export function BankChip({ acct, big = false }: { acct: Account; big?: boolean }) {
  const w = big ? 78 : 56;
  const h = big ? 34 : 24;
  return (
    <div
      className="ds-bankchip"
      style={{ width: w, height: h, background: acct.instColor, color: acct.instFg }}
    >
      <span className="ds-bankchip-wm">{acct.inst}</span>
    </div>
  );
}

export function CardVisual({ acct }: { acct: Account }) {
  const isCredit = acct.kind === 'credit';
  const balLabel = isCredit ? 'Owes' : 'Balance';
  const bal = Math.abs(acct.balance);
  return (
    <div
      className={'ds-card-vis ' + (isCredit ? 'credit' : 'deposit')}
      style={{ ['--ic' as any]: acct.instFg }}
    >
      <div className="ds-card-vis-shine" />
      <div className="ds-card-vis-top">
        <BankChip acct={acct} />
        <span className="ds-card-vis-type">{acct.type.toUpperCase()}</span>
      </div>
      <div className="ds-card-vis-mid">
        <div className="ds-card-vis-name">{acct.name}</div>
        {acct.points ? <div className="ds-card-vis-pts">{acct.points}</div> : null}
      </div>
      <div className="ds-card-vis-bot">
        <div>
          <div className="ds-card-vis-lbl">•••• {acct.mask}</div>
          {acct.apy ? <div className="ds-card-vis-apy">{(acct.apy * 100).toFixed(2)}% APY</div> : null}
        </div>
        <div className="ds-card-vis-bal">
          <div className="ds-card-vis-lbl">{balLabel}</div>
          <div className="ds-card-vis-num">{$compact(bal)}</div>
        </div>
      </div>
      {isCredit && acct.limit && acct.limit > 0 ? (
        <div className="ds-card-vis-util">
          <div className="ds-card-vis-util-bar">
            <div style={{ width: Math.min(100, (bal / acct.limit) * 100) + '%' }} />
          </div>
          <span>
            {$compact(bal)} / {$compact(acct.limit)} · {((bal / acct.limit) * 100).toFixed(0)}%
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function AcctRow({ acct }: { acct: Account }) {
  const isCredit = acct.kind === 'credit';
  return (
    <tr className="ds-acct-row">
      <td>
        <div className="ds-acct-cell-bank">
          <BankChip acct={acct} />
          <span className="ds-acct-mask">•••• {acct.mask}</span>
        </div>
      </td>
      <td>
        <div className="ds-acct-name">{acct.name}</div>
        <div className="ds-acct-meta">
          <span className="ds-acct-type">{acct.type}</span>
          {acct.apy ? <span className="ds-acct-apy">{(acct.apy * 100).toFixed(2)}% APY</span> : null}
          {acct.reauth ? <span className="ds-acct-reauth">re-auth needed</span> : null}
          {acct.primary ? <span className="ds-acct-primary">primary</span> : null}
        </div>
      </td>
      <td className="ds-acct-cell-sync">
        <span className={'ds-acct-sync-dot ' + (acct.reauth ? 'warn' : 'ok')} />
        {acct.lastSync}
      </td>
      <td className={'ds-acct-cell-bal ' + (isCredit ? 'neg' : '')}>
        {$(acct.balance)}
        {isCredit && acct.limit ? (
          <div className="ds-acct-cell-util">{((Math.abs(acct.balance) / acct.limit) * 100).toFixed(0)}% used</div>
        ) : null}
      </td>
    </tr>
  );
}
