import './globals.css';
import type { Metadata, Viewport } from 'next';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';
import AIChat from '@/components/AIChat';
import { portfolioSummary, countUnclaimedTransactions } from '@/lib/db/queries';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Amari Banking — Reconciliation',
  description: 'Multi-entity financial reconciliation and audit trail',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0c',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let openFlags = 0;
  let unclaimedCount = 0;
  let user: ReturnType<typeof getCurrentUser> = null;
  try {
    user = getCurrentUser();
    if (hasEditAccess(user)) openFlags = portfolioSummary().openFlagCount;
    // Every signed-in user can see /identify — count it for all roles so
    // the sidebar badge shows for cofounders too.
    if (user) unclaimedCount = countUnclaimedTransactions();
  } catch {
    /* ignore */
  }

  if (!user) {
    // Login / setup / invite pages render full-bleed (no sidebar).
    return (
      <html lang="en">
        <body>
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar openFlags={openFlags} unclaimedCount={unclaimedCount} role={user.role} userName={user.name} userEmail={user.email} />
            <main className="flex-1 min-w-0 pt-[52px] md:pt-0">{children}</main>
          </div>
          {hasEditAccess(user) ? <AIChat /> : null}
        </ToastProvider>
      </body>
    </html>
  );
}
