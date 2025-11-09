import React, { useState } from 'react';
import { User } from '../types';
import { DeleteIcon } from './icons';

interface AccountSettingsProps {
  user: User;
  email?: string | null;
  requiresPassword: boolean;
  willPromptGoogleReauth: boolean;
  isDeleting: boolean;
  error?: string | null;
  onDeleteAccount: (options: { password?: string }) => Promise<void>;
}

const CONFIRMATION_PHRASE = 'DELETE';

const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  email,
  requiresPassword,
  willPromptGoogleReauth,
  isDeleting,
  error,
  onDeleteAccount,
}) => {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');

  const confirmationValid = confirmation.trim().toUpperCase() === CONFIRMATION_PHRASE;
  const passwordValid = !requiresPassword || password.trim().length >= 6;
  const canSubmit = confirmationValid && passwordValid && !isDeleting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    try {
      await onDeleteAccount({ password: requiresPassword ? password.trim() : undefined });
    } catch {
      // Error message propagated via `error` prop from parent.
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-black/20 backdrop-blur-lg rounded-2xl border border-white/10 p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Account Overview</h2>
          <p className="text-sm text-slate-300 mt-1">Manage your profile and see what data is stored for you.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm text-slate-200">
          <div className="flex justify-between border border-white/5 rounded-lg bg-white/5 px-4 py-2">
            <span className="text-slate-400">Name</span>
            <span className="font-semibold text-white">{user.name}</span>
          </div>
          <div className="flex justify-between border border-white/5 rounded-lg bg-white/5 px-4 py-2">
            <span className="text-slate-400">Email</span>
            <span className="font-semibold text-white">{email ?? 'Not provided'}</span>
          </div>
          <div className="flex justify-between border border-white/5 rounded-lg bg-white/5 px-4 py-2">
            <span className="text-slate-400">Role</span>
            <span className="font-semibold text-white text-right">{user.role ?? 'player'}</span>
          </div>
          <div className="flex justify-between border border-white/5 rounded-lg bg-white/5 px-4 py-2">
            <span className="text-slate-400">Score</span>
            <span className="font-semibold text-white">{user.score}</span>
          </div>
          <div className="flex justify-between border border-white/5 rounded-lg bg-white/5 px-4 py-2">
            <span className="text-slate-400">Streak</span>
            <span className="font-semibold text-white">{user.streak}</span>
          </div>
          <div className="flex justify-between border border-white/5 rounded-lg bg-white/5 px-4 py-2">
            <span className="text-slate-400">Badge</span>
            <span className="font-semibold text-white">{user.badge}</span>
          </div>
        </div>
      </section>

      <section className="bg-black/20 backdrop-blur-lg rounded-2xl border border-red-500/40 p-6">
        <h3 className="text-lg font-semibold text-red-300">Danger zone</h3>
        <p className="text-sm text-slate-300 mt-2">
          Deleting your account removes your profile, leaderboard progress, submissions, and daily progress records.
          This action cannot be undone.
        </p>
        {requiresPassword && (
          <p className="text-xs text-slate-400 mt-3">Enter your current password so we can verify it is really you.</p>
        )}
        {!requiresPassword && willPromptGoogleReauth && (
          <p className="text-xs text-slate-400 mt-3">When you continue, a Google confirmation popup will appear before the deletion proceeds.</p>
        )}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="confirmation" className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
              Type {CONFIRMATION_PHRASE} to confirm
            </label>
            <input
              id="confirmation"
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/40"
            />
          </div>

          {requiresPassword && (
            <div>
              <label htmlFor="delete-password" className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                Current password
              </label>
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                minLength={6}
              />
            </div>
          )}

          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/60 bg-red-600/30 px-4 py-3 font-semibold text-red-100 transition hover:bg-red-600/50 disabled:cursor-not-allowed disabled:border-red-500/20 disabled:bg-red-500/10"
          >
            <DeleteIcon className="w-5 h-5" />
            <span>{isDeleting ? 'Deleting account...' : 'Delete account permanently'}</span>
          </button>
        </form>
      </section>
    </div>
  );
};

export default AccountSettings;
