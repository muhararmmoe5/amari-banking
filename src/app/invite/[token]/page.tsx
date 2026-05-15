import { getInvite } from '@/lib/auth/sessions';
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
          <p className="text-sm text-ink-dim">This invite link is invalid or has expired.</p>
        </div>
      </div>
    );
  }
  if (invite.usedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold mb-2">Invite already used</h1>
          <p className="text-sm text-ink-dim">This link has already been claimed. <a href="/login" className="text-entity-bytes">Sign in</a> instead.</p>
        </div>
      </div>
    );
  }
  if (invite.expiresAt < Date.now()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold mb-2">Invite expired</h1>
          <p className="text-sm text-ink-dim">Ask the owner for a new invite link.</p>
        </div>
      </div>
    );
  }

  const person = getPerson(invite.personId);

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
            <div className="text-xs text-ink-mute">You&apos;ve been invited as {invite.role.replace('_', ' ').toLowerCase()}</div>
          </div>
        </div>
        <p className="text-xs text-ink-mute mb-4">
          Set up your account to see {person?.name ? `${person.name}'s` : 'your'} equity, contributions, and portfolio value.
        </p>
        <InviteForm token={params.token} defaultName={person?.name || ''} email={invite.email} />
      </div>
    </div>
  );
}
