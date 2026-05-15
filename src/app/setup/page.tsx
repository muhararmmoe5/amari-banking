import { redirect } from 'next/navigation';
import { userCount } from '@/lib/auth/sessions';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  if (userCount() > 0) redirect('/login');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-bg-0 font-bold"
            style={{ background: 'linear-gradient(135deg, #C060F0 0%, #7c3aed 100%)' }}
          >
            AV
          </span>
          <div>
            <div className="font-semibold">Welcome to Amari</div>
            <div className="text-xs text-ink-mute">Create the owner account to get started</div>
          </div>
        </div>
        <p className="text-xs text-ink-mute mb-4">
          This first account is the <strong>owner</strong> — full access to everything. Other people sign in via invites you create later.
        </p>
        <SetupForm />
      </div>
    </div>
  );
}
