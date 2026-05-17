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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #C060F0 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, #C8F060 0%, transparent 70%)' }}
        />
      </div>

      <div className="card-elev p-9 w-full max-w-sm animate-scale-in">
        <div className="flex items-center gap-3 mb-7">
          <span
            className="w-11 h-11 rounded-xl inline-flex items-center justify-center text-white font-bold text-base"
            style={{
              background: 'linear-gradient(135deg, #C060F0 0%, #7c3aed 100%)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 20px rgba(124,58,237,0.35)',
            }}
          >
            AV
          </span>
          <div>
            <div className="font-semibold text-lg tracking-tight">Amari Ventures</div>
            <div className="text-xs text-ink-mute">Sign in to continue</div>
          </div>
        </div>
        <LoginForm next={searchParams.next} />
        <p className="text-2xs text-ink-mute mt-6 text-center">
          Don&apos;t have an account? Ask the owner to send you an invite link.
        </p>
      </div>
    </div>
  );
}
