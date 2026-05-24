'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashCtx } from './DashCtx';
import { ENTITIES, ENTITY_ORDER } from '@/lib/dash/fixtures';
import type { EntityId, Mode } from '@/lib/dash/types';

type NavItem = { id: string; lbl: string; href: string; group: string; num?: string };

const PERSONAL_NAV: NavItem[] = [
  { id: 'command', lbl: 'Command Center', href: '/', group: 'Overview' },
  { id: 'networth', lbl: 'Net Worth', href: '/networth', group: 'Overview', num: '$5.37M' },
  { id: 'banks', lbl: 'Banks & Cards', href: '/accounts', group: 'Accounts' },
  { id: 'transactions', lbl: 'Transactions', href: '/transactions', group: 'Accounts' },
];

const BUSINESS_NAV: NavItem[] = [
  { id: 'command', lbl: 'Command Center', href: '/', group: 'Portfolio' },
  { id: 'sales', lbl: 'Daily Sales', href: '/sales', group: 'Entity' },
  { id: 'banks', lbl: 'Banks & Cards', href: '/accounts', group: 'Entity' },
  { id: 'transactions', lbl: 'Transactions', href: '/transactions', group: 'Entity' },
];

function pageIdFor(pathname: string | null): string {
  if (!pathname) return 'command';
  if (pathname === '/') return 'command';
  if (pathname.startsWith('/networth')) return 'networth';
  if (pathname.startsWith('/accounts') || pathname.startsWith('/banks')) return 'banks';
  if (pathname.startsWith('/transactions')) return 'transactions';
  if (pathname.startsWith('/sales')) return 'sales';
  return 'command';
}

function PersonIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 a8 8 0 0 1 16 0" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="1.5" />
      <path d="M8 7 V5 a2 2 0 0 1 2 -2 H14 a2 2 0 0 1 2 2 V7" />
    </svg>
  );
}

function Sidebar({ pageId }: { pageId: string }) {
  const { mode, entity, setMode, setEntity } = useDashCtx();
  const nav = mode === 'personal' ? PERSONAL_NAV : BUSINESS_NAV;
  const ent = ENTITIES[entity];

  const groups: Record<string, NavItem[]> = {};
  nav.forEach((it) => {
    (groups[it.group] = groups[it.group] || []).push(it);
  });

  return (
    <aside className="ds-side">
      <div className="ds-brand">
        <div className="ds-bm">A</div>
        <div>
          <div className="ds-bname">Amari</div>
          <div className="ds-btag">Private wealth</div>
        </div>
      </div>

      <div className="ds-modeswitch">
        <button className={'ds-mode ' + (mode === 'personal' ? 'act' : '')} onClick={() => setMode('personal')}>
          <PersonIcon /> Personal
        </button>
        <button className={'ds-mode ' + (mode === 'business' ? 'act' : '')} onClick={() => setMode('business')}>
          <BuildingIcon /> Business
        </button>
      </div>

      {mode === 'business' && (
        <div className="ds-entswitch">
          <div className="ds-entswitch-h">
            <span>Active entity</span>
            <span className="ds-entswitch-ct">{ENTITY_ORDER.length}</span>
          </div>
          <div className="ds-entswitch-grid">
            {ENTITY_ORDER.map((id) => {
              const e = ENTITIES[id];
              return (
                <button
                  key={id}
                  className={'ds-entdot ' + (id === entity ? 'act' : '')}
                  style={{ ['--ec' as any]: e.c }}
                  title={e.name}
                  onClick={() => setEntity(id)}
                >
                  {e.init}
                </button>
              );
            })}
          </div>
          <div className="ds-entswitch-name">
            <em>{ent.short}</em>
            <span className="sub">{ent.type}</span>
          </div>
        </div>
      )}

      <div className="ds-nav">
        {Object.entries(groups).map(([grp, items]) => (
          <div key={grp} className="ds-nav-group">
            <div className="ds-nav-label">{grp === 'Entity' && mode === 'business' ? `${ent.short} · ${grp}` : grp}</div>
            {items.map((it) => (
              <Link key={it.id} href={it.href} className={'ds-nav-row ' + (it.id === pageId ? 'act' : '')}>
                <span className="ds-nav-dot" />
                <span className="ds-nav-lbl">{it.lbl}</span>
                {it.num ? <span className="ds-nav-num">{it.num}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="ds-side-foot">
        <div className="ds-side-foot-avatar">M</div>
        <div className="ds-side-foot-meta">
          <div className="nm">Moe Muharram</div>
          <div className="rl">Owner · Single user</div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ crumbs }: { crumbs?: string[] }) {
  const { mode, entity } = useDashCtx();
  const ent = ENTITIES[entity];
  const personal = mode === 'personal';
  return (
    <div className="ds-top">
      <div className="ds-crumb">
        <span className="ds-crumb-side">
          <span className="ds-crumb-dot" style={{ background: personal ? '#c9a87a' : ent.c }} />
          <b>{personal ? 'Personal' : 'Business'}</b>
        </span>
        <span className="ds-crumb-sp">/</span>
        {!personal && (
          <>
            <span className="ds-crumb-ent">
              <span className="ds-crumb-mark" style={{ background: ent.c }}>{ent.init}</span>
              <em>{ent.short}</em>
            </span>
            <span className="ds-crumb-sp">/</span>
          </>
        )}
        {(crumbs || []).map((c, i, arr) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 ? <span className="ds-crumb-sp">/</span> : null}
            {i === arr.length - 1 ? <b>{c}</b> : <a>{c}</a>}
          </span>
        ))}
      </div>

      <div className="ds-top-spacer" />

      <div className="ds-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15 15 L20.5 20.5" strokeLinecap="round" />
        </svg>
        <input placeholder={personal ? 'Search personal…' : `Search ${ent.short}…`} />
        <span className="ds-search-kbd">⌘K</span>
      </div>

      <button className="ds-top-btn" title="Notifications" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 8 a6 6 0 0 1 12 0 c0 7 3 8 3 8 H3 s3-1 3-8" strokeLinejoin="round" />
          <path d="M10 21 a2 2 0 0 0 4 0" />
        </svg>
        <span className="ds-top-btn-dot" />
      </button>
    </div>
  );
}

export function DashShell({ crumbs, children }: { crumbs?: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const pageId = pageIdFor(pathname);
  return (
    <div className="ds-app">
      <Sidebar pageId={pageId} />
      <div className="ds-main">
        <Topbar crumbs={crumbs} />
        <div className="ds-content">{children}</div>
      </div>
    </div>
  );
}

export function useForceMode(target: Mode) {
  const { mode, setMode } = useDashCtx();
  if (typeof window !== 'undefined' && mode !== target) {
    // Defer to next tick to avoid setState in render
    queueMicrotask(() => setMode(target));
  }
}

export type { EntityId };
