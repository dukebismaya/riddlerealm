import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  DocumentData,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from '../services/firebaseClient';
import { deleteUserData } from '../services/accountDeletion';
import { User } from '../types';
import { createOtpChallenge, verifyOtpCode, OtpError } from '../services/otpService';

type AuthRole = 'player' | 'admin';

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  signUpWithEmail: (params: { name: string; email: string; password: string }) => Promise<void>;
  signInWithEmail: (params: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  deleteAccount: (options?: { password?: string }) => Promise<void>;
  signOutUser: () => Promise<void>;
  otpRequired: boolean;
  otpDeliveryPending: boolean;
  otpVerifying: boolean;
  otpError: string | null;
  otpTargetEmail: string | null;
  otpResendCooldownMs: number;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ADMIN_EMAILS = (import.meta.env.VITE_FIREBASE_ADMIN_EMAILS || '')
  .split(',')
  .map((entry: string) => entry.trim().toLowerCase())
  .filter(Boolean);

const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_CODE_LENGTH = 6;

const resolveRole = (email: string | null | undefined): AuthRole => {
  if (!email) {
    return 'player';
  }
  return ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'player';
};

const sanitizeUserDoc = (docData: DocumentData, fallback: Partial<User>): User => {
  const role = (docData.role || fallback.role || 'player') as AuthRole;
  const safeUser: User = {
    id: docData.id || fallback.id || '',
    name: docData.name || fallback.name || 'Explorer',
    email: docData.email || fallback.email,
    score: typeof docData.score === 'number' ? docData.score : 0,
    streak: typeof docData.streak === 'number' ? docData.streak : 0,
    badge: docData.badge || fallback.badge || 'New Challenger',
    role,
    avatarUrl: docData.avatarUrl || fallback.avatarUrl,
  };
  return safeUser;
};

const ensureUserDocument = async (firebaseUser: FirebaseUser, overrides?: Partial<User>) => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userRef);
  const displayName = overrides?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Explorer';
  const derivedRole = overrides?.role || resolveRole(firebaseUser.email);

  if (!snapshot.exists()) {
    const baseDoc: Record<string, unknown> = {
      id: firebaseUser.uid,
      name: displayName,
      email: firebaseUser.email ?? overrides?.email ?? null,
      score: overrides?.score ?? 0,
      streak: overrides?.streak ?? 0,
      badge: overrides?.badge ?? 'New Challenger',
      role: derivedRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (firebaseUser.photoURL || overrides?.avatarUrl) {
      baseDoc.avatarUrl = overrides?.avatarUrl ?? firebaseUser.photoURL;
    }

    await setDoc(userRef, baseDoc, { merge: true });
    return;
  }

  const existingData = snapshot.data();
  const updates: Record<string, unknown> = {};
  let requiresUpdate = false;

  if (!existingData.role && derivedRole) {
    updates.role = derivedRole;
    requiresUpdate = true;
  }

  if (overrides?.name && existingData.name !== overrides.name) {
    updates.name = overrides.name;
    requiresUpdate = true;
  }

  if (requiresUpdate) {
    updates.updatedAt = serverTimestamp();
    await updateDoc(userRef, updates);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpDeliveryPending, setOtpDeliveryPending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpTargetEmail, setOtpTargetEmail] = useState<string | null>(null);
  const [otpResendAvailableAt, setOtpResendAvailableAt] = useState<number>(0);
  const [otpTimerTick, setOtpTimerTick] = useState(() => Date.now());
  const otpInitializedForRef = useRef<string | null>(null);

  const prepareOtpForUser = useCallback(async (user: FirebaseUser) => {
    if (!user.email) {
      setOtpError('Cannot send a verification code because no email is associated with this account.');
      setOtpRequired(false);
      return;
    }

    setOtpTargetEmail(user.email);
    setOtpDeliveryPending(true);
    setOtpRequired(true);
    setOtpError(null);

    try {
      await createOtpChallenge(user.uid, user.email);
      otpInitializedForRef.current = user.uid;
      setOtpResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
    } catch (error) {
      if (error instanceof OtpError) {
        setOtpError(error.message);
      } else {
        setOtpError('Failed to send the verification code. Please try again.');
      }
      throw error;
    } finally {
      setOtpDeliveryPending(false);
    }
  }, []);

  const otpResendCooldownMs = useMemo(
    () => Math.max(0, otpResendAvailableAt - Date.now()),
    [otpResendAvailableAt, otpTimerTick],
  );

  useEffect(() => {
    if (!otpRequired || typeof window === 'undefined') {
      return;
    }

    const intervalId = window.setInterval(() => {
      setOtpTimerTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [otpRequired]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (!currentUser) {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = undefined;
        }
        setProfile(null);
        setLoading(false);
        setOtpRequired(false);
        setOtpError(null);
        setOtpDeliveryPending(false);
        setOtpTargetEmail(null);
        setOtpResendAvailableAt(0);
        otpInitializedForRef.current = null;
        return;
      }

      setOtpTargetEmail(currentUser.email ?? null);

      try {
        await ensureUserDocument(currentUser);
      } catch (error) {
        console.error('Failed to ensure user document exists:', error);
      }

      if (otpInitializedForRef.current !== currentUser.uid) {
        try {
          await prepareOtpForUser(currentUser);
        } catch (error) {
          console.error('Failed to initiate OTP verification:', error);
        }
      }

      if (unsubscribeProfile) {
        unsubscribeProfile();
      }

      const userRef = doc(db, 'users', currentUser.uid);
      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const derivedRole = resolveRole(currentUser.email);
            const sanitized = sanitizeUserDoc(data, {
              id: currentUser.uid,
              email: currentUser.email ?? undefined,
              name: currentUser.displayName ?? undefined,
              avatarUrl: currentUser.photoURL ?? undefined,
              role: derivedRole,
            });
            setProfile(sanitized);
          }
          setLoading(false);
        },
        (error) => {
          console.error('Failed to listen to user profile changes:', error);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribeAuth();
    };
  }, [prepareOtpForUser]);

  const signUpWithEmail = useMemo(
    () =>
      async ({ name, email, password }: { name: string; email: string; password: string }) => {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(credential.user, { displayName: name });
        }
        await ensureUserDocument(credential.user, { name, email, role: resolveRole(email) });
      },
    []
  );

  const signInWithEmail = useMemo(
    () => async ({ email, password }: { email: string; password: string }) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    []
  );

  const signInWithGoogle = useMemo(
    () => async () => {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await ensureUserDocument(result.user, { name: result.user.displayName ?? undefined });
    },
    []
  );

  const signOutUser = useMemo(
    () => async () => {
      await signOut(auth);
    },
    [],
  );

  const sendPasswordReset = useMemo(
    () => async (email: string) => {
      await sendPasswordResetEmail(auth, email);
    },
    [],
  );

  const deleteAccount = useMemo(
    () =>
      async ({ password }: { password?: string } = {}) => {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new Error('NO_CURRENT_USER');
        }

        const providers = currentUser.providerData.map((provider) => provider.providerId);
        const usesEmailPassword = providers.includes('password');

        if (usesEmailPassword && !password) {
          throw new Error('PASSWORD_REQUIRED');
        }

        try {
          if (usesEmailPassword && password && currentUser.email) {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
          } else if (!usesEmailPassword && providers.includes('google.com')) {
            const googleProvider = new GoogleAuthProvider();
            await reauthenticateWithPopup(currentUser, googleProvider);
          }

          await deleteUserData(currentUser.uid);
          await deleteUser(currentUser);
        } catch (error) {
          if (error instanceof FirebaseError && error.code === 'auth/requires-recent-login') {
            throw new Error('RECENT_LOGIN_REQUIRED');
          }
          throw error;
        }
      },
    [],
  );

  const verifyOtp = useCallback(
    async (code: string) => {
      if (!firebaseUser) {
        setOtpError('You must be signed in to verify a code.');
        return;
      }

      const normalized = code.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH);
      if (normalized.length !== OTP_CODE_LENGTH) {
        setOtpError(`Enter the ${OTP_CODE_LENGTH}-digit code we emailed you.`);
        return;
      }

      setOtpVerifying(true);
      setOtpError(null);

      try {
        await verifyOtpCode(firebaseUser.uid, normalized);
        setOtpRequired(false);
        setOtpDeliveryPending(false);
        setOtpResendAvailableAt(0);
        otpInitializedForRef.current = firebaseUser.uid;
      } catch (error) {
        if (error instanceof OtpError) {
          setOtpError(error.message);
          if (error.code === 'OTP_MAX_ATTEMPTS') {
            await signOut(auth);
          }
        } else {
          setOtpError('Failed to verify the code. Please try again.');
        }
      } finally {
        setOtpVerifying(false);
      }
    },
    [firebaseUser],
  );

  const resendOtp = useCallback(async () => {
    if (!firebaseUser) {
      setOtpError('Sign in again to request a new code.');
      return;
    }

    if (otpDeliveryPending) {
      return;
    }

    if (otpResendCooldownMs > 0) {
      const waitSeconds = Math.ceil(otpResendCooldownMs / 1000);
      setOtpError(`Please wait ${waitSeconds}s before requesting a new code.`);
      return;
    }

    try {
      await prepareOtpForUser(firebaseUser);
    } catch (error) {
      console.error('Failed to resend OTP:', error);
    }
  }, [firebaseUser, otpDeliveryPending, otpResendCooldownMs, prepareOtpForUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      deleteAccount,
      signOutUser,
      otpRequired,
      otpDeliveryPending,
      otpVerifying,
      otpError,
      otpTargetEmail,
      otpResendCooldownMs,
      verifyOtp,
      resendOtp,
    }),
    [
      firebaseUser,
      profile,
      loading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      deleteAccount,
      signOutUser,
      otpRequired,
      otpDeliveryPending,
      otpVerifying,
      otpError,
      otpTargetEmail,
      otpResendCooldownMs,
      verifyOtp,
      resendOtp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
