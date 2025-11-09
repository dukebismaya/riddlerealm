import React, { useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../contexts/AuthContext';
import SiteFooter from './SiteFooter';

const mapFirebaseError = (error: unknown): string => {
  if (!(error instanceof FirebaseError)) {
    return 'Something went wrong. Please try again.';
  }

  const firebaseError: FirebaseError = error;

  switch (firebaseError.code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Please choose a stronger password (min 6 characters).';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Give it another go.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found. Try signing up first.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    default:
      return firebaseError.message || 'Authentication failed. Please try again.';
  }
};

type AuthMode = 'signin' | 'signup';

const AuthScreen: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const resetThreshold = 3;

  const headingText = useMemo(
    () => (mode === 'signin' ? 'Welcome back to RiddleRealm' : 'Join the RiddleRealm'),
    [mode]
  );

  const subheadingText = useMemo(
    () =>
      mode === 'signin'
        ? 'Sign in to keep your streak alive and climb the leaderboard.'
        : 'Create a free account to track your progress and submit riddles.',
    [mode]
  );

  const toggleMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setFailedAttempts(0);
    setResetEmailSent(false);
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setResetEmailSent(false);

    try {
      if (mode === 'signup') {
        await signUpWithEmail({ name: name.trim(), email: email.trim(), password: password.trim() });
      } else {
        await signInWithEmail({ email: email.trim(), password: password.trim() });
        setFailedAttempts(0);
      }
    } catch (err) {
      setError(mapFirebaseError(err));
      if (mode === 'signin') {
        setFailedAttempts((prev) => prev + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (resetLoading) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email address first, then request a reset.');
      return;
    }

    setError(null);
    setResetLoading(true);
    try {
      await sendPasswordReset(trimmedEmail);
      setResetEmailSent(true);
    } catch (err) {
      setResetEmailSent(false);
      setError(mapFirebaseError(err));
    } finally {
      setResetLoading(false);
    }
  };

  const heartbeatState = loading ? 'active' : error ? 'flat' : 'idle';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col p-4 text-white relative overflow-hidden isolate">
      <div className={`auth-heartbeat-backdrop ${heartbeatState}`} aria-hidden="true">
        <svg className="auth-heartbeat-canvas" viewBox="0 0 600 160" preserveAspectRatio="none">
          <polyline className="auth-heartbeat-trace auth-heartbeat-trace--active" points="0,90 80,90 120,50 150,130 180,60 240,60 270,20 295,140 320,70 390,70 420,90 600,90" />
          <polyline className="auth-heartbeat-trace auth-heartbeat-trace--flat" points="0,90 600,90" />
        </svg>
        <div className="auth-heartbeat-glow" />
      </div>
      <div className="flex-1 flex items-center justify-center w-full relative z-10">
        <div className="w-full max-w-lg bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(56,189,248,0.2)] p-8">
          <h1 className="text-3xl font-bold text-cyan-300 text-center mb-2">{headingText}</h1>
          <p className="text-slate-300 text-center mb-8">{subheadingText}</p>

          {error && <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

          {mode === 'signin' && failedAttempts >= resetThreshold && (
            <div className="mb-6 rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <p className="font-semibold">Having trouble signing in?</p>
              <p className="mt-1 text-cyan-50/80">We can send you a password reset link so you can get back into the realm.</p>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="mt-3 w-full rounded-lg border border-cyan-400/50 bg-cyan-500/30 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500/50 disabled:cursor-not-allowed disabled:bg-cyan-500/20"
              >
                {resetLoading ? 'Sending reset link...' : 'Email me a reset link'}
              </button>
              {resetEmailSent && (
                <p className="mt-2 text-xs text-emerald-200">
                  Reset email sent! Check your inbox (and spam folder) for instructions.
                </p>
              )}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleEmailAuth}>
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
                  Display name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="RiddleMaster"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-cyan-500/70 hover:bg-cyan-500 font-semibold py-3 transition disabled:cursor-not-allowed disabled:bg-cyan-500/30"
            >
              {loading ? 'Working on it...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <span className="flex-1 border-t border-white/10" />
            <span className="text-xs uppercase tracking-widest text-slate-400">or</span>
            <span className="flex-1 border-t border-white/10" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white hover:bg-white/10 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}{' '}
            <button type="button" onClick={toggleMode} className="font-semibold text-cyan-300 hover:text-cyan-200">
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
      <SiteFooter className="mt-10 pb-6 relative z-10" />
    </div>
  );
};

export default AuthScreen;
