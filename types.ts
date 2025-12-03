
export enum Difficulty {
  Easy = "Easy",
  Medium = "Medium",
  Hard = "Hard",
  Impossible = "Impossible",
}

export interface Riddle {
  id: string;
  text: string;
  answer: string;
  difficulty: Difficulty;
  alternateAnswers?: string[];
  source?: 'firestore' | 'offline' | 'public-api';
}

export type UserApprovalStatus = 'pending' | 'approved' | 'denied';

export interface User {
  id: string;
  name: string;
  email?: string;
  score: number;
  streak: number;
  badge: string;
  role?: 'player' | 'admin';
  avatarUrl?: string;
  approvalStatus?: UserApprovalStatus;
  approvalRequestedAt?: string;
  approvalUpdatedAt?: string;
  approvalDeniedAt?: string;
  approvalDenialReason?: string;
}

export type DailyProgressStatus = 'pending' | 'solved' | 'failed';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  badge: string;
}

export type GameState = 'playing' | 'solved' | 'failed' | 'loading';

export type AppTab = 'riddle' | 'leaderboard' | 'submit' | 'account' | 'admin';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  riddle: string;
  answer: string;
  difficulty: Difficulty;
  status: SubmissionStatus;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  alternateAnswers?: string[];
}

export interface DailyRiddleEntry {
  id: string;
  riddleId: string;
  text: string;
  answer: string;
  difficulty: Difficulty;
  date: string;
  setBy?: string;
  setByName?: string;
  updatedAt?: string;
  alternateAnswers?: string[];
}

export interface DailyProgressRecord {
  id: string;
  userId: string;
  riddleId: string;
  date: string;
  status: DailyProgressStatus;
  updatedAt?: string;
}

export interface HintDelivery {
  hint: string;
  roast: string;
  remaining: number;
  exhausted?: boolean;
}
