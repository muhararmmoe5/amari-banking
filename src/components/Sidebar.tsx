'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '◆' },
  { href: '/import', label: 'Import CSV', icon: '⬆' },
  { href: '/transactions', label: 'Transactions', icon: '≡' },
  { href: '/audit', label: 'Audit Review', icon: '⚠' },
  { href: '/accounts', label: 'Accounts', icon: '⌗' },
  { href: '/income', label: 'Income', icon: '↗' },
  { href: '/zelle', label: 'Zelle / 1099', icon: '☎' },
  { href: '/pl', label: 'Entity P&L', icon: '◐' },
  { href: '/cpa', label: 'CPA Export', icon: '⬇' },
];

export default function Sidebar({ openFlags }: { openFlags?: number }) {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-line bg-bg-1 min-h-screen flex flex-col">
      <div className="p-5 border-b border-line">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-md inline-flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #C8F060 0%, #60C8F0 100%)',
              color: '#0C0C0E',
              fontWeight: 800,
            }}
          >
            A
          </span>
          <div>
            <div className="font-semibold text-sm leading-none">Amari</div>
            <div className="text-[11px] text-ink-mute leading-none mt-1">Reconciliation</div>
          </div>
        </div>
      </div>
      <nav className="p-2 flex-1">
        {NAV.map((n) => {
          const isActive = n.href === '/' ? path === '/' : path?.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition',
                isActive ? 'bg-bg-3 text-ink' : 'text-ink-dim hover:text-ink hover:bg-bg-2'
              )}
            >
              <span className="w-4 text-center opacity-70">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.href === '/audit' && openFlags ? (
                <span className="pill bg-flag-critBg text-flag-critText">{openFlags}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-[11px] text-ink-mute border-t border-line">
        Local. Private. Your data never leaves this machine.
      </div>
    </aside>
  );
}
