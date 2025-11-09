
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import Header from './components/Header';
import RiddleCard from './components/RiddleCard';
import Leaderboard from './components/Leaderboard';
import SubmissionPanel from './components/SubmissionPanel';
import AdminPanel from './components/AdminPanel';
import AccountSettings from './components/AccountSettings';
import AuthScreen from './components/AuthScreen';
import {
  Riddle,
  LeaderboardEntry,
  Difficulty,
  GameState,
  AppTab,
  Submission,
  SubmissionStatus,
  DailyRiddleEntry,
  DailyProgressStatus,
  HintDelivery,
} from './types';
import { DIFFICULTY_CONFIG } from './constants';
import { fetchDailyRiddle, isApiAvailable } from './services/geminiService';
import { fetchPublicRiddle } from './services/publicRiddleService';
import { TrophyIcon, PlusIcon, AdminIcon, UserIcon } from './components/icons';
import { useAuth } from './contexts/AuthContext';
import { db } from './services/firebaseClient';
import { getHintsForRiddle } from './services/hintService';
import SiteFooter from './components/SiteFooter';

type PlayMode = 'daily' | 'practice';

type HintPayload = HintDelivery;

type HintCache = {
  hints: string[];
  roasts: string[];
  index: number;
};

const mapAccountDeletionError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message === 'PASSWORD_REQUIRED') {
      return 'Please enter your current password to confirm the deletion.';
    }
    if (error.message === 'RECENT_LOGIN_REQUIRED') {
      return 'Please sign in again and retry deleting your account.';
    }
  }

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'The password you entered is incorrect. Try again.';
      case 'auth/requires-recent-login':
        return 'Please sign in again and retry deleting your account.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'The sign-in confirmation was closed before completion. Please try again.';
      default:
        return error.message || 'Failed to delete your account. Please try again.';
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : 'Failed to delete your account. Please try again.';
};

const App: React.FC = () => {
  const { profile: user, loading: authLoading, firebaseUser, deleteAccount, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('riddle');
  const [playMode, setPlayMode] = useState<PlayMode>('daily');
  const [isApiOnline, setIsApiOnline] = useState(true);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [dailyEntry, setDailyEntry] = useState<DailyRiddleEntry | null>(null);
  const [dailyRiddle, setDailyRiddle] = useState<Riddle | null>(null);
  const [dailyGameState, setDailyGameState] = useState<GameState>('loading');
  const [dailyAttemptsLeft, setDailyAttemptsLeft] = useState(0);
  const [dailyProgressStatus, setDailyProgressStatus] = useState<DailyProgressStatus>('pending');
  const [dailyError, setDailyError] = useState<string | null>(null);

  const [practiceRiddle, setPracticeRiddle] = useState<Riddle | null>(null);
  const [practiceGameState, setPracticeGameState] = useState<GameState>('loading');
  const [practiceAttemptsLeft, setPracticeAttemptsLeft] = useState(0);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [isPracticeLoading, setIsPracticeLoading] = useState(false);
  const practiceSeenIdsRef = useRef<Set<string>>(new Set());
  const [practiceSolvedIds, setPracticeSolvedIds] = useState<Set<string>>(new Set());
  const dailyHintCacheRef = useRef<HintCache>({ hints: [], roasts: [], index: 0 });
  const practiceHintCacheRef = useRef<HintCache>({ hints: [], roasts: [], index: 0 });

  const isAdmin = user?.role === 'admin';
  const providerData = firebaseUser?.providerData ?? [];
  const requiresPasswordForDeletion = providerData.some((provider) => provider.providerId === 'password');
  const willPromptGoogleReauth = !requiresPasswordForDeletion && providerData.some((provider) => provider.providerId === 'google.com');
  const accountEmail = firebaseUser?.email ?? user?.email ?? null;

  const approvedRiddles = useMemo(() => {
    return submissions
      .filter((s) => s.status === 'approved')
      .map(({ id, riddle, answer, difficulty }) => ({ id, text: riddle, answer, difficulty }));
  }, [submissions]);

  useEffect(() => {
    setIsApiOnline(isApiAvailable());
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      setActiveTab('riddle');
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (activeTab !== 'account' && accountDeleteError) {
      setAccountDeleteError(null);
    }
  }, [activeTab, accountDeleteError]);

  useEffect(() => {
    if (!user) {
      setLeaderboard([]);
      return;
    }

    const leaderboardQuery = query(collection(db, 'users'), orderBy('score', 'desc'), limit(50));
    const unsubscribe = onSnapshot(leaderboardQuery, (snapshot) => {
      const entries = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: data.id || docSnapshot.id,
          name: data.name || 'Explorer',
          score: typeof data.score === 'number' ? data.score : 0,
          badge: data.badge || 'Adventurer',
        } as LeaderboardEntry;
      });
      setLeaderboard(entries);
    });

    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      return;
    }

    const submissionsQuery = query(collection(db, 'submissions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      const docs: Submission[] = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        const status = (data.status ?? 'pending') as SubmissionStatus;
        const difficultyValue = (data.difficulty ?? Difficulty.Medium) as Difficulty;
        return {
          id: docSnapshot.id,
          riddle: data.riddle,
          answer: data.answer,
          difficulty: difficultyValue,
          status,
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as Submission;
      });
      setSubmissions(docs);
    });

    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setPracticeSolvedIds(new Set());
      return;
    }

    const solvedQuery = query(
      collection(db, 'practiceProgress'),
      where('userId', '==', user.id),
      where('status', '==', 'solved'),
    );

    const unsubscribe = onSnapshot(
      solvedQuery,
      (snapshot) => {
        const solved = new Set<string>();
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (typeof data.riddleId === 'string') {
            solved.add(data.riddleId);
          }
        });
        setPracticeSolvedIds(solved);
      },
      (error) => {
        console.error('Failed to load practice progress:', error);
      },
    );

    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    const dailyRef = doc(db, 'dailyRiddle', 'current');
    const unsubscribe = onSnapshot(
      dailyRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDailyEntry(null);
          setDailyRiddle(null);
          setDailyGameState('loading');
          setDailyAttemptsLeft(0);
          setDailyProgressStatus('pending');
          setDailyError('Daily riddle has not been set yet.');
          return;
        }

        const data = snapshot.data();
        const difficultyValue = (data.difficulty ?? Difficulty.Medium) as Difficulty;
        const dateString = data.date || new Date().toISOString().split('T')[0];

        const entry: DailyRiddleEntry = {
          id: snapshot.id,
          riddleId: data.riddleId ?? snapshot.id,
          text: data.riddle,
          answer: data.answer,
          difficulty: difficultyValue,
          date: dateString,
          setBy: data.setBy,
          setByName: data.setByName,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };

        const riddle: Riddle = {
          id: data.riddleId ?? snapshot.id,
          text: data.riddle,
          answer: data.answer,
          difficulty: difficultyValue,
        };

        setDailyEntry(entry);
        setDailyRiddle(riddle);
        setDailyAttemptsLeft(DIFFICULTY_CONFIG[difficultyValue].attempts);
        setDailyProgressStatus('pending');
        setDailyGameState('loading');
        setDailyError(null);
      },
      (error) => {
        console.error('Failed to load daily riddle:', error);
        setDailyEntry(null);
        setDailyRiddle(null);
        setDailyGameState('failed');
        setDailyAttemptsLeft(0);
        setDailyError('Failed to load the daily riddle. Please try again later.');
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    dailyHintCacheRef.current = { hints: [], roasts: [], index: 0 };
  }, [dailyRiddle?.id]);

  useEffect(() => {
    if (!user || !dailyEntry || !dailyRiddle) {
      return;
    }

    const progressId = `${user.id}_${dailyEntry.date}`;
    const progressRef = doc(db, 'dailyProgress', progressId);

    setDailyGameState('loading');

    const unsubscribe = onSnapshot(
      progressRef,
      (snapshot) => {
        if (!dailyRiddle) {
          return;
        }

        const attempts = DIFFICULTY_CONFIG[dailyRiddle.difficulty].attempts;

        if (!snapshot.exists()) {
          setDailyProgressStatus('pending');
          setDailyAttemptsLeft(attempts);
          setDailyGameState('playing');
          return;
        }

        const data = snapshot.data();
        const status = (data.status ?? 'pending') as DailyProgressStatus;
        setDailyProgressStatus(status);

        if (status === 'solved') {
          setDailyGameState('solved');
          setDailyAttemptsLeft(0);
        } else if (status === 'failed') {
          setDailyGameState('failed');
          setDailyAttemptsLeft(0);
        } else {
          setDailyAttemptsLeft(attempts);
          setDailyGameState('playing');
        }
      },
      (error) => {
        console.error('Failed to load daily progress:', error);
      }
    );

    return unsubscribe;
  }, [user?.id, dailyEntry, dailyRiddle]);

  useEffect(() => {
    practiceHintCacheRef.current = { hints: [], roasts: [], index: 0 };
  }, [practiceRiddle?.id]);

  const loadPracticeRiddle = useCallback(
    async () => {
      setIsPracticeLoading(true);
      setPracticeError(null);
      setPracticeGameState('loading');

      try {
        let nextRiddle: Riddle | null = null;

        if (approvedRiddles.length > 0) {
          const unsolved = approvedRiddles.filter((candidate) => !practiceSolvedIds.has(candidate.id));
          const unseen = unsolved.filter((candidate) => !practiceSeenIdsRef.current.has(candidate.id));
          const pool = unseen.length > 0 ? unseen : unsolved;
          if (pool.length > 0) {
            const choice = pool[Math.floor(Math.random() * pool.length)];
            if (choice) {
              nextRiddle = { ...choice, source: 'firestore' };
            }
          }
        }

        if (!nextRiddle) {
          try {
            const publicRiddle = await fetchPublicRiddle();
            nextRiddle = { ...publicRiddle, source: 'public-api' };
          } catch (error) {
            console.warn('Public riddle API unavailable, falling back to offline riddles.', error);
            nextRiddle = await fetchDailyRiddle(Difficulty.Medium, approvedRiddles);
            if (nextRiddle) {
              nextRiddle.source = 'offline';
            }
          }
        }

        if (!nextRiddle && approvedRiddles.length > 0) {
          const fallback = approvedRiddles[Math.floor(Math.random() * approvedRiddles.length)];
          if (fallback) {
            nextRiddle = { ...fallback, source: 'firestore' };
          }
        }

        if (!nextRiddle) {
          throw new Error('No practice riddles available.');
        }

        practiceSeenIdsRef.current.add(nextRiddle.id);
        if (practiceSeenIdsRef.current.size > 200) {
          const first = practiceSeenIdsRef.current.values().next().value as string | undefined;
          if (first) {
            practiceSeenIdsRef.current.delete(first);
          }
        }
        setPracticeRiddle(nextRiddle);
        setPracticeAttemptsLeft(DIFFICULTY_CONFIG[nextRiddle.difficulty].attempts);
        setPracticeGameState('playing');
      } catch (error) {
        console.error('Failed to load practice riddle:', error);
        setPracticeError('Failed to load a practice riddle. Please try again.');
        setPracticeRiddle(null);
        setPracticeAttemptsLeft(0);
        setPracticeGameState('failed');
      } finally {
        setIsPracticeLoading(false);
      }
    },
    [approvedRiddles, practiceSolvedIds]
  );

  useEffect(() => {
    if (playMode === 'practice' && !practiceRiddle && !isPracticeLoading) {
      void loadPracticeRiddle();
    }
  }, [playMode, practiceRiddle, loadPracticeRiddle, isPracticeLoading]);

  const rewardUser = useCallback(
    async (pointsDelta: number, streakDelta: number) => {
      if (!user) return;

      try {
        const userRef = doc(db, 'users', user.id);
        const updates: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };

        if (pointsDelta !== 0) {
          updates.score = increment(pointsDelta);
        }
        if (streakDelta !== 0) {
          updates.streak = increment(streakDelta);
        }

        await updateDoc(userRef, updates);
      } catch (error) {
        console.error('Failed to update user stats:', error);
      }
    },
    [user]
  );

  const resetUserStreak = useCallback(async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        streak: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to reset streak:', err);
    }
  }, [user]);

  const recordDailyProgress = useCallback(
    async (status: DailyProgressStatus) => {
      if (!user || !dailyEntry || !dailyRiddle) {
        return;
      }

      if (dailyProgressStatus === status) {
        return;
      }

      const progressId = `${user.id}_${dailyEntry.date}`;
      try {
        await setDoc(
          doc(db, 'dailyProgress', progressId),
          {
            id: progressId,
            userId: user.id,
            riddleId: dailyRiddle.id,
            date: dailyEntry.date,
            status,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setDailyProgressStatus(status);
      } catch (error) {
        console.error('Failed to record daily progress:', error);
      }
    },
    [user, dailyEntry, dailyRiddle, dailyProgressStatus]
  );

  const handleDailyCorrect = useCallback(async () => {
    if (!dailyRiddle || !user || dailyGameState !== 'playing') return;

    const points = DIFFICULTY_CONFIG[dailyRiddle.difficulty].points;
    setDailyGameState('solved');
    setDailyAttemptsLeft(0);
    await rewardUser(points, 1);
    await recordDailyProgress('solved');
  }, [dailyRiddle, user, dailyGameState, rewardUser, recordDailyProgress]);

  const handleDailyWrong = useCallback(() => {
    if (dailyGameState !== 'playing') return;

    setDailyAttemptsLeft((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setDailyGameState('failed');
        void recordDailyProgress('failed');
        void resetUserStreak();
        return 0;
      }
      return next;
    });
  }, [dailyGameState, recordDailyProgress, resetUserStreak]);

  const handleDailyGiveUp = useCallback(() => {
    if (dailyGameState !== 'playing') return;
    setDailyGameState('failed');
    setDailyAttemptsLeft(0);
    void recordDailyProgress('failed');
    void resetUserStreak();
  }, [dailyGameState, recordDailyProgress, resetUserStreak]);

  const handleDailyHint = useCallback(async (): Promise<HintPayload> => {
    if (!dailyRiddle) {
      return { hint: 'No daily riddle is available right now.', roast: '', remaining: 0, exhausted: true };
    }

    try {
      if (dailyHintCacheRef.current.hints.length === 0) {
        const hintSet = await getHintsForRiddle(dailyRiddle);
        dailyHintCacheRef.current = { hints: hintSet.hints, roasts: hintSet.roasts, index: 0 };
      }

      const cache = dailyHintCacheRef.current;

      if (cache.index >= cache.hints.length) {
        return { hint: 'No more hints available for this riddle.', roast: '', remaining: 0, exhausted: true };
      }

      const hint = cache.hints[cache.index];
      const roast = cache.roasts[cache.index] ?? '';
      cache.index += 1;
      const remaining = Math.max(0, cache.hints.length - cache.index);

      return { hint, roast, remaining, exhausted: remaining === 0 };
    } catch (error) {
      console.error('Failed to provide daily hint:', error);
      return { hint: 'Unable to fetch a hint right now. Try again shortly.', roast: '', remaining: 0, exhausted: true };
    }
  }, [dailyRiddle]);

  const recordPracticeSolve = useCallback(
    async (riddle: Riddle) => {
      if (!user) {
        return;
      }

      try {
        const progressId = `${user.id}_${riddle.id}`;
        await setDoc(
          doc(db, 'practiceProgress', progressId),
          {
            id: progressId,
            userId: user.id,
            riddleId: riddle.id,
            status: 'solved',
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        console.error('Failed to record practice solve:', error);
      }
    },
    [user],
  );

  const handlePracticeCorrect = useCallback(async () => {
    if (!practiceRiddle || !user || practiceGameState !== 'playing') return;
    const points = DIFFICULTY_CONFIG[practiceRiddle.difficulty].points;
    setPracticeGameState('solved');
    setPracticeAttemptsLeft(0);
    await rewardUser(points, 1);
    if (practiceRiddle.source === 'firestore') {
      await recordPracticeSolve(practiceRiddle);
    }
  }, [practiceRiddle, user, practiceGameState, rewardUser, recordPracticeSolve]);

  const handlePracticeWrong = useCallback(() => {
    if (practiceGameState !== 'playing') return;
    setPracticeAttemptsLeft((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setPracticeGameState('failed');
        void resetUserStreak();
        return 0;
      }
      return next;
    });
  }, [practiceGameState, resetUserStreak]);

  const handlePracticeGiveUp = useCallback(() => {
    if (practiceGameState !== 'playing') return;
    setPracticeGameState('failed');
    setPracticeAttemptsLeft(0);
    void resetUserStreak();
  }, [practiceGameState, resetUserStreak]);

  const handlePracticeHint = useCallback(async (): Promise<HintPayload> => {
    if (!practiceRiddle) {
      return { hint: 'Load a riddle first before asking for hints.', roast: '', remaining: 0, exhausted: true };
    }

    try {
      if (practiceHintCacheRef.current.hints.length === 0) {
        const hintSet = await getHintsForRiddle(practiceRiddle);
        practiceHintCacheRef.current = { hints: hintSet.hints, roasts: hintSet.roasts, index: 0 };
      }

      const cache = practiceHintCacheRef.current;

      if (cache.index >= cache.hints.length) {
        return { hint: 'You have used every hint for this riddle.', roast: '', remaining: 0, exhausted: true };
      }

      const hint = cache.hints[cache.index];
      const roast = cache.roasts[cache.index] ?? '';
      cache.index += 1;
      const remaining = Math.max(0, cache.hints.length - cache.index);

      return { hint, roast, remaining, exhausted: remaining === 0 };
    } catch (error) {
      console.error('Failed to provide practice hint:', error);
      return { hint: 'Unable to fetch a hint right now. Try again shortly.', roast: '', remaining: 0, exhausted: true };
    }
  }, [practiceRiddle]);

  const handlePracticeNext = useCallback(() => {
    void loadPracticeRiddle();
  }, [loadPracticeRiddle]);

  const handleRiddleSubmit = useCallback(
    async (submission: { riddle: string; answer: string; difficulty: Difficulty }) => {
      if (!user) {
        throw new Error('You need to be signed in to submit a riddle.');
      }

      try {
        await addDoc(collection(db, 'submissions'), {
          riddle: submission.riddle,
          answer: submission.answer,
          difficulty: submission.difficulty,
          status: 'pending',
          createdBy: user.id,
          createdByName: user.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to submit riddle:', err);
        throw err instanceof Error ? err : new Error('Failed to submit riddle.');
      }
    },
    [user]
  );

  const handleApproveRiddle = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) {
        throw new Error('Only admins can approve riddles.');
      }
      try {
        const submissionRef = doc(db, 'submissions', id);
        await updateDoc(submissionRef, {
          status: 'approved',
          updatedAt: serverTimestamp(),
          approvedBy: user.id,
        });
      } catch (err) {
        console.error('Failed to approve riddle:', err);
        throw err instanceof Error ? err : new Error('Failed to approve riddle.');
      }
    },
    [isAdmin, user]
  );

  const handleUpdateRiddle = useCallback(
    async (id: string, updates: Partial<Submission>) => {
      if (!user || !isAdmin) {
        throw new Error('Only admins can update riddles.');
      }
      try {
        const submissionRef = doc(db, 'submissions', id);
        await updateDoc(submissionRef, {
          ...('riddle' in updates ? { riddle: updates.riddle } : {}),
          ...('answer' in updates ? { answer: updates.answer } : {}),
          ...('difficulty' in updates ? { difficulty: updates.difficulty } : {}),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to update riddle:', err);
        throw err instanceof Error ? err : new Error('Failed to update riddle.');
      }
    },
    [isAdmin, user]
  );

  const handleDeleteRiddle = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) {
        throw new Error('Only admins can delete riddles.');
      }
      try {
        await deleteDoc(doc(db, 'submissions', id));
      } catch (err) {
        console.error('Failed to delete riddle:', err);
        throw err instanceof Error ? err : new Error('Failed to delete riddle.');
      }
    },
    [isAdmin, user]
  );

  const handleSetDailyRiddle = useCallback(
    async (submission: Submission) => {
      if (!user || !isAdmin) {
        throw new Error('Only admins can set the daily riddle.');
      }

      try {
        const dailyRef = doc(db, 'dailyRiddle', 'current');
        const date = new Date().toISOString().split('T')[0];
        await setDoc(
          dailyRef,
          {
            riddleId: submission.id,
            riddle: submission.riddle,
            answer: submission.answer,
            difficulty: submission.difficulty,
            date,
            setBy: user.id,
            setByName: user.name,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Failed to set daily riddle:', err);
        throw err instanceof Error ? err : new Error('Failed to set daily riddle.');
      }
    },
    [isAdmin, user]
  );

  const handleAccountDelete = useCallback(
    async ({ password }: { password?: string }) => {
      setAccountDeleteError(null);
      setIsDeletingAccount(true);
      try {
        await deleteAccount({ password });
      } catch (err) {
        const message = mapAccountDeletionError(err);
        setAccountDeleteError(message);
        throw new Error(message);
      } finally {
        setIsDeletingAccount(false);
      }
    },
    [deleteAccount]
  );

  const renderDailySection = () => {
    if (!dailyRiddle) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[320px] bg-black/20 backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center text-slate-300">
          <p>{dailyError ?? 'Hang tight! The daily riddle will be revealed soon.'}</p>
        </div>
      );
    }

    if (dailyGameState === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[320px] bg-black/20 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white mt-4 text-lg">Fetching the daily challenge...</p>
        </div>
      );
    }

    return (
      <RiddleCard
        riddle={dailyRiddle}
        title="Daily Riddle"
        gameState={dailyGameState}
        onCorrectAnswer={handleDailyCorrect}
        onWrongAnswer={handleDailyWrong}
        onGiveUp={handleDailyGiveUp}
        onGetHint={handleDailyHint}
        attemptsLeft={dailyAttemptsLeft}
      />
    );
  };

  const renderPracticeSection = () => {
    if (isPracticeLoading || practiceGameState === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[320px] bg-black/20 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <div className="w-14 h-14 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white mt-4 text-lg">Finding your next brain teaser...</p>
        </div>
      );
    }

    if (practiceError) {
      return (
        <div className="bg-black/20 backdrop-blur-lg rounded-2xl border border-red-500/30 p-6 text-center text-red-200">
          <p className="mb-4 text-sm">{practiceError}</p>
          <button
            type="button"
            onClick={() => loadPracticeRiddle()}
            className="rounded-lg bg-red-500/40 px-4 py-2 font-semibold text-white hover:bg-red-500/60"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (!practiceRiddle) {
      return null;
    }

    return (
      <RiddleCard
        riddle={practiceRiddle}
        title="Practice Riddle"
        gameState={practiceGameState}
        onCorrectAnswer={handlePracticeCorrect}
        onWrongAnswer={handlePracticeWrong}
        onGiveUp={handlePracticeGiveUp}
        onGetHint={handlePracticeHint}
        attemptsLeft={practiceAttemptsLeft}
        onNextRiddle={handlePracticeNext}
        nextLabel={practiceGameState === 'failed' ? 'Try Another Riddle' : 'Next Riddle'}
      />
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'riddle':
        return (
          <div className="space-y-4">
            <div className="flex gap-2 bg-black/20 backdrop-blur-lg p-2 rounded-xl border border-white/10">
              <button
                onClick={() => setPlayMode('daily')}
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                  playMode === 'daily'
                    ? 'bg-cyan-500/40 text-white shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                Daily Challenge
              </button>
              <button
                onClick={() => setPlayMode('practice')}
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                  playMode === 'practice'
                    ? 'bg-green-500/40 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                Practice Run
              </button>
            </div>

            {playMode === 'daily' ? renderDailySection() : renderPracticeSection()}

            {playMode === 'daily' && dailyProgressStatus !== 'pending' && dailyEntry && (
              <p className="text-center text-sm text-slate-300">
                {dailyProgressStatus === 'solved'
                  ? 'Great job! Come back tomorrow for a brand-new daily riddle.'
                  : 'Daily challenge locked in for today. Return tomorrow for a fresh puzzle.'}
              </p>
            )}
          </div>
        );
      case 'leaderboard':
        return <Leaderboard entries={leaderboard} currentUserId={user?.id ?? ''} />;
      case 'submit':
        return <SubmissionPanel onRiddleSubmit={handleRiddleSubmit} />;
      case 'account':
        if (!user) {
          return null;
        }
        return (
          <AccountSettings
            user={user}
            email={accountEmail}
            requiresPassword={requiresPasswordForDeletion}
            willPromptGoogleReauth={willPromptGoogleReauth}
            isDeleting={isDeletingAccount}
            error={accountDeleteError}
            onDeleteAccount={handleAccountDelete}
          />
        );
      case 'admin':
        if (!isAdmin) {
          return (
            <div className="bg-black/20 backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center text-slate-300">
              You do not have access to the admin panel.
            </div>
          );
        }
        return (
          <AdminPanel
            submissions={submissions}
            onApprove={handleApproveRiddle}
            onUpdate={handleUpdateRiddle}
            onDelete={handleDeleteRiddle}
            onSetDaily={handleSetDailyRiddle}
            currentDaily={dailyEntry}
          />
        );
      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="bg-transparent min-h-screen text-white">
      <Header user={user} onSignOut={signOutUser} />
      <main className="container mx-auto p-4 md:p-8 max-w-2xl">
        {!isApiOnline && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-sm rounded-lg p-3 text-center mb-6">
            <p>
              <strong>Offline Mode:</strong> No API key found. Riddles and hints are limited.
            </p>
          </div>
        )}

        <div className="bg-black/20 backdrop-blur-lg p-2 rounded-xl mb-8 border border-white/10 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('riddle')}
            className={`flex-1 min-w-[45%] py-2 rounded-lg font-semibold transition-colors text-center ${
              activeTab === 'riddle'
                ? 'bg-cyan-500/40 text-white shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                : 'hover:bg-white/10 text-slate-300'
            }`}
          >
            Play
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 min-w-[45%] py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'leaderboard'
                ? 'bg-purple-500/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'hover:bg-white/10 text-slate-300'
            }`}
          >
            <TrophyIcon className="w-5 h-5" /> <span>Leaderboard</span>
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 min-w-[45%] py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'submit'
                ? 'bg-green-500/40 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                : 'hover:bg-white/10 text-slate-300'
            }`}
          >
            <PlusIcon className="w-5 h-5" /> <span>Submit</span>
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 min-w-[45%] py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'account'
                ? 'bg-rose-500/40 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'hover:bg-white/10 text-slate-300'
            }`}
          >
            <UserIcon className="w-5 h-5" /> <span>Account</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 min-w-[45%] py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${
                activeTab === 'admin'
                  ? 'bg-orange-500/40 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                  : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              <AdminIcon className="w-5 h-5" /> <span>Admin</span>
            </button>
          )}
        </div>

        {renderActiveTab()}
      </main>
      <SiteFooter className="mt-16 pb-10" />
    </div>
  );
};

export default App;
