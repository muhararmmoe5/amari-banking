import { getPasswordResetToken, getUserById } from '@/lib/auth/sessions';
import ResetForm from './ResetForm';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const reset = getPasswordResetToken(params.token);

  if (!reset) {
    return (
      <Wrap title="Reset link not found" body="This link is invalid. Request a new one from the sign-in page." showHome />
    );
  }
  if (reset.usedAt) {
    return (
      <Wrap title="Already used" body="This reset link has already been claimed. Sign in or request a new one." showHome />
    );
  }
  if (reset.expiresAt < Date.now()) {
    return (
      <Wrap title="Link expired" body="Reset links are good for 1 hour. Request a new one." showHome />
    );
  }
  const user = getUserById(reset.userId);
  if (!user) {
    return <Wrap title="Account not found" body="The account this link belongs to no longer exists." showHome />;
  }

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
            <div className="font-semibold">Set a new password</div>
            <div className="text-xs text-ink-mute">Signed in as {user.email}</div>
          </div>
        </div>
        <p className="text-xs text-ink-mute mb-4">
          Pick a strong password. Your old one stops working as soon as you save and you&apos;ll be signed in here.
        </p>
        <ResetForm token={params.token} />
      </div>
    </div>
  );
}

function Wrap({ title, body, showHome }: { title: string; body: string; showHome?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 text-center max-w-md">
        <h1 className="text-lg font-semibold mb-2">{title}</h1>
        <p className="text-sm text-ink-dim mb-4">{body}</p>
        {showHome ? <a href="/login" className="btn btn-primary">Back to sign in</a> : null}
      </div>
    </div>
  );
}
