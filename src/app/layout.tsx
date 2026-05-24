import './globals.css';
import './dash.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/Toast';
import AIChat from '@/components/AIChat';
import { DashCtxProvider } from '@/components/dash/DashCtx';
import { DashShell } from '@/components/dash/DashShell';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Amari — Private wealth',
  description: 'Personal + business finance command center',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let user: ReturnType<typeof getCurrentUser> = null;
  try {
    user = getCurrentUser();
  } catch {
    /* ignore */
  }

  if (!user) {
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
          <DashCtxProvider>
            <DashShell>{children}</DashShell>
          </DashCtxProvider>
          {user.role === 'OWNER' ? <AIChat /> : null}
        </ToastProvider>
      </body>
    </html>
  );
}
