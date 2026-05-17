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
    <aside className="w-[72px] shrink-0 border-r border-line bg-bg-1/80 backdrop-blur-xl min-h-screen flex flex-col items-center py-5 sticky top-0 z-30">
      {/* Logo */}
      <Link
        href="/"
        className="relative w-11 h-11 rounded-xl inline-flex items-center justify-center mb-7 transition-transform hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, #C060F0 0%, #7c3aed 100%)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: 0.3,
          boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 20px rgba(124,58,237,0.35)',
        }}
        title="Amari Ventures"
      >
        AV
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-1 w-full">
        {items.map((n, idx) => {
          if ('divider' in n) {
            return (
              <div key={`d-${idx}`} className="w-7 h-px my-3 bg-gradient-to-r from-transparent via-line-strong to-transparent" />
            );
          }
          const Icon = n.icon;
          const isActive = n.href === '/' ? path === '/' : path?.startsWith(n.href!);
          return (
            <Link
              key={n.href}
              href={n.href!}
              title={n.label}
              className={clsx(
                'relative w-11 h-11 inline-flex items-center justify-center rounded-xl transition-all duration-150 group',
                isActive
                  ? 'text-bg-0 bg-entity-bytes shadow-glow-bytes'
                  : 'text-ink-mute hover:text-ink hover:bg-bg-2'
              )}
              style={isActive ? {
                background: 'linear-gradient(135deg, #D4F470 0%, #A5DE3F 100%)',
              } : undefined}
            >
              <Icon size={19} strokeWidth={isActive ? 2.25 : 1.75} />
              {n.flagBadge && openFlags ? (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center bg-expense text-white ring-2 ring-bg-1">
                  {openFlags > 99 ? '99+' : openFlags}
                </span>
              ) : null}
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap px-2.5 py-1.5 rounded-lg surface-glass border border-line-strong text-xs font-medium text-ink opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-elev-2">
                {n.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-2 mt-3">
        <div
          className="relative w-10 h-10 rounded-xl inline-flex items-center justify-center text-xs font-semibold bg-bg-3 text-ink border border-line group cursor-default"
          title={`${userName || ''} (${userEmail || ''}) · ${role || ''}`}
        >
          {initials}
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap px-2.5 py-1.5 rounded-lg surface-glass border border-line-strong text-xs text-ink opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-elev-2">
            {userName || userEmail}{role ? ` · ${role.toLowerCase().replace('_', ' ')}` : ''}
          </span>
        </div>
        <button
          onClick={logout}
          className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-mute hover:text-expense hover:bg-bg-2 transition group relative"
          title="Sign out"
          type="button"
        >
          <LogOut size={18} strokeWidth={1.75} />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap px-2.5 py-1.5 rounded-lg surface-glass border border-line-strong text-xs text-ink opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-elev-2">
            Sign out
          </span>
        </button>
        <div className="mt-2 text-[9px] mono text-ink-ghost" title="Build stamp">
          v.ui-modern.2
        </div>
      </div>
    </aside>
  );
}
