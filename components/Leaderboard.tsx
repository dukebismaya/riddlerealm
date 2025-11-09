
import React from 'react';
import { LeaderboardEntry } from '../types';
import { TrophyIcon } from './icons';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries, currentUserId }) => {
  const sortedEntries = [...entries].sort((a, b) => b.score - a.score);

  const getRankColor = (rank: number) => {
    if (rank === 0) return 'text-yellow-400';
    if (rank === 1) return 'text-slate-300';
    if (rank === 2) return 'text-yellow-600';
    return 'text-slate-400';
  };

  return (
    <div className="bg-black/20 backdrop-blur-lg rounded-2xl shadow-2xl shadow-purple-500/10 border border-white/10 p-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <TrophyIcon className="w-7 h-7 mr-3 text-yellow-400" />
        Global Leaderboard
      </h2>
      <div className="space-y-3">
        {sortedEntries.map((entry, index) => (
          <div
            key={entry.id}
            className={`flex items-center p-3 rounded-lg transition-all ${
              entry.id === currentUserId ? 'bg-purple-500/30 border-2 border-purple-400' : 'bg-white/5'
            }`}
          >
            <div className={`w-10 font-bold text-xl ${getRankColor(index)}`}>
              #{index + 1}
            </div>
            <div className="flex-grow ml-4">
              <p className="font-semibold text-white">{entry.name}</p>
              <p className="text-sm text-slate-400 italic">"{entry.badge}"</p>
            </div>
            <div className="font-bold text-lg text-yellow-400">{entry.score} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
