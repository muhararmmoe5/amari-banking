import { getInvite, getUserByEmail } from '@/lib/auth/sessions';
import { getPerson } from '@/lib/db/cap';
import InviteForm from './InviteForm';

export const dynamic = 'force-dynamic';

export default function InvitePage({ params }: { params: { token: string } }) {
  const invite = getInvite(params.token);
  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold mb-2">Invite not found</h1>
          <p className="text-sm text-ink-dim mb-4">This invite link is invalid or has expired.</p>
          <a href="/login" className="btn btn-primary">Go to sign in</a>
        </div>
      </div>
    );
  }
  if (invite.usedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold mb-2">Invite already used</h1>
          <p className="text-sm text-ink-dim mb-4">This link has already been claimed.</p>
          <a href="/login" className="btn btn-primary">Sign in</a>
        </div>
      </div>
    );
  }
  if (invite.expiresAt < Date.now()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold mb-2">Invite expired</h1>
          <p className="text-sm text-ink-dim mb-4">Ask the owner for a new invite link.</p>
          <a href="/login" className="btn">Back to sign in</a>
        </div>
      </div>
    );
  }

  const person = getPerson(invite.personId);
  const existingUser = getUserByEmail(invite.email);
  const isReset = !!existingUser;

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
            <div className="font-semibold">{isReset ? 'Reset your password' : 'Welcome to Amari'}</div>
            <div className="text-xs text-ink-mute">
              {isReset
                ? `Signed in as ${invite.email}`
                : `You've been invited as ${invite.role.replace('_', ' ').toLowerCase()}`}
            </div>
          </div>
        </div>
        <p className="text-xs text-ink-mute mb-4">
          {isReset
            ? 'Pick a new password below. Your old password stops working as soon as you save.'
            : `Set up your account to see ${person?.name ? `${person.name}'s` : 'your'} equity, contributions, and portfolio value.`}
        </p>
        <InviteForm token={params.token} defaultName={existingUser?.name || person?.name || ''} email={invite.email} />
      </div>
    </div>
  );
}
