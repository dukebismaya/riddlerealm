
import { LeaderboardEntry, User, Submission, Difficulty } from './types';

export const INITIAL_USER: User = {
  id: 'user-1',
  name: 'RiddleMaster',
  email: 'riddlemaster@example.com',
  score: 1250,
  streak: 5,
  badge: 'Brain Cell Champion',
  role: 'player',
};

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { id: 'user-2', name: 'LogicLord', score: 9800, badge: 'Riddle Sensei' },
  { id: 'user-3', name: 'QuizQueen', score: 8500, badge: 'Certified Genius' },
  { id: 'user-1', name: 'RiddleMaster', score: 7250, badge: 'Brain Cell Champion' },
  { id: 'user-4', name: 'Puzzler', score: 6100, badge: 'Adept Guesser' },
  { id: 'user-5', name: 'CaptainClueless', score: 1200, badge: 'Certified Confused' },
  { id: 'user-6', name: 'HintHog', score: 800, badge: 'Just Here for the Roasts' },
];

export const MOCK_SUBMISSIONS: Submission[] = [
  { id: 'sub-1', riddle: 'I have a neck without a head, and a body without legs. What am I?', answer: 'A bottle', difficulty: Difficulty.Easy, status: 'pending', createdBy: 'user-4', createdByName: 'Puzzler' },
  { id: 'sub-2', riddle: 'What can travel around the world while staying in a corner?', answer: 'A stamp', difficulty: Difficulty.Medium, status: 'pending', createdBy: 'user-5', createdByName: 'CaptainClueless' },
  { id: 'sub-3', riddle: 'What comes once in a minute, twice in a moment, but never in a thousand years?', answer: 'The letter M', difficulty: Difficulty.Hard, status: 'approved', createdBy: 'user-3', createdByName: 'QuizQueen' },
];


export const DIFFICULTY_CONFIG = {
  Easy: { points: 10, attempts: 5, color: 'text-green-400' },
  Medium: { points: 25, attempts: 4, color: 'text-yellow-400' },
  Hard: { points: 50, attempts: 3, color: 'text-orange-400' },
  Impossible: { points: 100, attempts: 2, color: 'text-red-500' },
};
