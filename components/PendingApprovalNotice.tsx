import React, { useMemo, useState } from 'react';

type PendingApprovalNoticeProps = {
  name?: string | null;
  email?: string | null;
  status?: 'pending' | 'denied';
  denialReason?: string | null;
  onSignOut: () => Promise<void> | void;
};

const maskEmail = (value: string | null | undefined) => {
  if (!value) {
    return 'your email address';
  }
  const [localPart, domain] = value.split('@');
  if (!domain || localPart.length <= 2) {
    return `${localPart ?? ''}***${domain ? `@${domain}` : ''}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  return `${first}${'*'.repeat(localPart.length - 2)}${last}@${domain}`;
};

const PendingApprovalNotice: React.FC<PendingApprovalNoticeProps> = ({
  name,
  email,
  status = 'pending',
  denialReason,
  onSignOut,
}) => {
  const [signingOut, setSigningOut] = useState(false);
  const maskedEmail = useMemo(() => maskEmail(email), [email]);
  const isDenied = status === 'denied';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (error) {
      console.error('Failed to sign out while pending approval:', error);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-8 shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
        <p className={`text-sm uppercase tracking-[0.4em] mb-4 ${isDenied ? 'text-rose-300' : 'text-cyan-300'}`}>
          {isDenied ? 'Access Denied' : 'Awaiting Access'}
        </p>
        <h1 className="text-3xl font-bold text-white">
          {isDenied ? `Sorry, ${name || 'Explorer'}.` : `Hang tight, ${name || 'Explorer'}!`}
        </h1>
        {isDenied ? (
          <>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">
              An admin reviewed your request and declined access for now. You can sign out and try a different
              email later or reach out to an admin if you believe this was a mistake.
            </p>
            {denialReason && (
              <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
                <p className="font-semibold uppercase tracking-wide text-xs mb-1 text-rose-200">Admin note</p>
                <p>{denialReason}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">
              Your account request is waiting for an admin to approve it. Once they give the green light,
              you&apos;ll be able to dive back into the realm using {maskedEmail}.
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              Trying to sign up again won&apos;t speed things up—we already have your request on file.
              Feel free to check back later or contact an admin if you need help.
            </p>
          </>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-6 w-full rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingOut ? 'Signing you out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
};

export default PendingApprovalNotice;
