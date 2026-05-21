import ForgotForm from './ForgotForm';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-bg-0 font-bold"
            style={{ background: 'linear-gradient(135deg, #C060F0 0%, #7c3aed 100%)' }}
          >
            AV
          </span>
          <div>
            <div className="font-semibold">Reset your password</div>
            <div className="text-xs text-ink-mute">We&apos;ll email you a link to set a new one</div>
          </div>
        </div>
        <ForgotForm />
      </div>
    </div>
  );
}
