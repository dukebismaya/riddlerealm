import React, { useEffect, useMemo, useState } from 'react';

const maskEmail = (email: string) => {
  const [localPart, domain] = email.split('@');
  if (!domain) {
    return email;
  }
  if (localPart.length <= 2) {
    return `${localPart[0] ?? ''}***@${domain}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  const hiddenCount = Math.max(1, localPart.length - 2);
  return `${first}${'*'.repeat(hiddenCount)}${last}@${domain}`;
};

type OtpVerificationModalProps = {
  open: boolean;
  verifying: boolean;
  deliveryPending: boolean;
  error: string | null;
  targetEmail: string | null;
  resendCooldownMs: number;
  onSubmit: (code: string) => Promise<void> | void;
  onResend: () => Promise<void> | void;
};

const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  open,
  verifying,
  deliveryPending,
  error,
  targetEmail,
  resendCooldownMs,
  onSubmit,
  onResend,
}) => {
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode('');
      setTouched(false);
    }
  }, [open]);

  const maskedEmail = useMemo(() => (targetEmail ? maskEmail(targetEmail) : null), [targetEmail]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const nextValue = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(nextValue);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (code.length < 6 || verifying) {
      return;
    }
    await onSubmit(code);
  };

  const handleResend = async () => {
    await onResend();
  };

  const countdownSeconds = Math.ceil(resendCooldownMs / 1000);
  const resendDisabled = deliveryPending || countdownSeconds > 0;
  const showValidationError = touched && code.length < 6;

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950/90 p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-white">Two-Step Verification</h2>
        <p className="mt-2 text-sm text-slate-300">
          Enter the 6-digit code sent to{maskedEmail ? ` ${maskedEmail}` : ' your email address'}.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-slate-200">
              Verification code
            </label>
            <input
              id="otp"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              value={code}
              onChange={handleChange}
              onBlur={() => setTouched(true)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-3 text-lg tracking-[0.5em] text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••"
              disabled={verifying}
            />
            {showValidationError && (
              <p className="mt-2 text-sm text-rose-400">Enter the full 6-digit code.</p>
            )}
            {error && (
              <p className="mt-2 text-sm text-rose-400">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/50"
            disabled={verifying || code.length < 6}
          >
            {verifying ? 'Verifying…' : 'Confirm code'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
          <span>Didn’t get the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendDisabled}
            className="font-semibold text-emerald-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {resendDisabled ? `Resend in ${countdownSeconds}s` : 'Resend code'}
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Your session stays locked until you verify this code. Each login prompts a new code to protect your account.
        </p>
      </div>
    </div>
  );
};

export default OtpVerificationModal;
