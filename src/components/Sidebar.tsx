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
  Target,
  Settings,
  PieChart,
  FileSpreadsheet,
  Repeat2,
  Users,
  PieChart as PieChartIcon,
  LogOut,
  User as UserIcon,
  Waves,
} from 'lucide-react';

type NavItem = { href: string; label: string; icon: any; flagBadge?: boolean; ownerOnly?: boolean } | { divider: true; ownerOnly?: boolean };

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, ownerOnly: true },
  { href: '/import', label: 'Import CSV', icon: Upload, ownerOnly: true },
  { href: '/transactions', label: 'Transactions', icon: ListTree, ownerOnly: true },
  { href: '/audit', label: 'Audit Review', icon: ShieldAlert, flagBadge: true, ownerOnly: true },
  { divider: true, ownerOnly: true } as const,
  { href: '/accounts', label: 'Accounts', icon: Building2, ownerOnly: true },
  { href: '/flow', label: 'Cash Flow', icon: Waves, ownerOnly: true },
  { href: '/income', label: 'Income Tracker', icon: TrendingUp, ownerOnly: true },
  { href: '/budgets', label: 'Budgets', icon: Target, ownerOnly: true },
  { href: '/zelle', label: 'Zelle / 1099', icon: Banknote, ownerOnly: true },
  { href: '/pl', label: 'Entity P&L', icon: PieChart, ownerOnly: true },
  { href: '/cpa', label: 'CPA Export', icon: FileSpreadsheet, ownerOnly: true },
  { href: '/reconcile', label: 'Reconciliation', icon: Repeat2, ownerOnly: true },
  { divider: true } as const,
  { href: '/team', label: 'Team & Investors', icon: Users, ownerOnly: true },
  { href: '/cap', label: 'Cap Table', icon: PieChartIcon },
  { href: '/admin/options', label: 'Admin · Dropdown options', icon: Settings, ownerOnly: true },
];

export default function Sidebar({
  openFlags, role, userName, userEmail,
}: {
  openFlags?: number;
  role?: 'OWNER' | 'PARTNER' | 'TEAM_MEMBER';
  userName?: string;
  userEmail?: string;
}) {
  const path = usePathname();
  const isOwner = role === 'OWNER';
  const items = NAV.filter((n) => isOwner || !('ownerOnly' in n) || !n.ownerOnly);
  const initials = (userName || userEmail || '?').slice(0, 2).toUpperCase();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.href = '/login';
  }

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
        {items.map((n, idx) => {
          if ('divider' in n) return <div key={`d-${idx}`} className="w-8 h-px bg-line my-2" />;
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

      <div className="flex flex-col items-center gap-1">
        <div
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-[11px] font-semibold bg-bg-3 text-ink relative group"
          title={`${userName || ''} (${userEmail || ''}) · ${role || ''}`}
        >
          {initials}
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap px-2 py-1 rounded-md bg-bg-3 border border-line text-[12px] text-ink opacity-0 group-hover:opacity-100 transition shadow-soft z-50">
            {userName || userEmail}{role ? ` · ${role.toLowerCase().replace('_', ' ')}` : ''}
          </span>
        </div>
        <button
          onClick={logout}
          className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-ink-mute hover:text-expense hover:bg-bg-2 group relative"
          title="Sign out"
          type="button"
        >
          <LogOut size={18} strokeWidth={1.75} />
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap px-2 py-1 rounded-md bg-bg-3 border border-line text-[12px] text-ink opacity-0 group-hover:opacity-100 transition shadow-soft z-50">
            Sign out
          </span>
        </button>
        <div className="mt-3 text-[9px] mono text-ink-mute opacity-50" title="Build stamp — if you don't see this number, you're on a stale bundle">
          v.passthrough
        </div>
      </div>
    </aside>
  );
}
