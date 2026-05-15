import Link from 'next/link';
import { redirect } from 'next/navigation';
import { userCount } from '@/lib/auth/sessions';
import { getCurrentUser } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  if (userCount() === 0) redirect('/setup');
  if (getCurrentUser()) redirect('/');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <span
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-bg-0 font-bold"
            style={{ background: 'linear-gradient(135deg, #C060F0 0%, #7c3aed 100%)' }}
          >
            AV
          </span>
          <div>
            <div className="font-semibold">Amari</div>
            <div className="text-xs text-ink-mute">Sign in to continue</div>
          </div>
        </div>
        <LoginForm next={searchParams.next} />
        <p className="text-[11px] text-ink-mute mt-5">
          Don&apos;t have an account? Ask the owner to send you an invite link.
        </p>
      </div>
    </div>
  );
}
