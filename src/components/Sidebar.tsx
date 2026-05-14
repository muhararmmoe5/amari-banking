'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Upload,
  ListTree,
  ShieldAlert,
  Building2,
  TrendingUp,
  Banknote,
  PieChart,
  FileSpreadsheet,
  Settings,
  Repeat2,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/import', label: 'Import CSV', icon: Upload },
  { href: '/transactions', label: 'Transactions', icon: ListTree },
  { href: '/audit', label: 'Audit Review', icon: ShieldAlert, flagBadge: true },
  { divider: true } as const,
  { href: '/accounts', label: 'Accounts', icon: Building2 },
  { href: '/income', label: 'Income Tracker', icon: TrendingUp },
  { href: '/zelle', label: 'Zelle / 1099', icon: Banknote },
  { href: '/pl', label: 'Entity P&L', icon: PieChart },
  { href: '/cpa', label: 'CPA Export', icon: FileSpreadsheet },
  { href: '/reconcile', label: 'Reconciliation', icon: Repeat2 },
];

export default function Sidebar({ openFlags }: { openFlags?: number }) {
  const path = usePathname();
  return (
    <aside className="w-[68px] shrink-0 border-r border-line bg-bg-1 min-h-screen flex flex-col items-center py-4 sticky top-0 z-30">
      <Link
        href="/"
        className="w-10 h-10 rounded-full inline-flex items-center justify-center mb-6"
        style={{
          background: 'linear-gradient(135deg, #C060F0 0%, #7c3aed 100%)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: 0.5,
        }}
        title="Amari Ventures"
      >
        AV
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-1 w-full">
        {NAV.map((n, idx) => {
          if ('divider' in n) return <div key={idx} className="w-8 h-px bg-line my-2" />;
          const Icon = n.icon;
          const isActive = n.href === '/' ? path === '/' : path?.startsWith(n.href!);
          return (
            <Link
              key={n.href}
              href={n.href!}
              title={n.label}
              className={clsx(
                'relative w-11 h-11 inline-flex items-center justify-center rounded-lg transition group',
                isActive ? 'bg-bg-3 text-entity-bytes' : 'text-ink-dim hover:text-ink hover:bg-bg-2'
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              {n.flagBadge && openFlags ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold inline-flex items-center justify-center bg-flag-critText/90 text-bg-0">
                  {openFlags > 99 ? '99+' : openFlags}
                </span>
              ) : null}
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap px-2 py-1 rounded-md bg-bg-3 border border-line text-[12px] text-ink opacity-0 group-hover:opacity-100 transition shadow-soft z-50">
                {n.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <button
        className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-ink-mute hover:text-ink hover:bg-bg-2"
        title="Settings (coming soon)"
        type="button"
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>
    </aside>
  );
}
