
import React from 'react';
import { User } from '../types';
import { FireIcon, TrophyIcon } from './icons';

interface HeaderProps {
  user: User;
  onSignOut?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onSignOut }) => {
  const initials = user.name ? user.name.charAt(0).toUpperCase() : '?';
  return (
    <header className="bg-black/20 backdrop-blur-lg p-4 rounded-b-2xl shadow-lg border-b border-white/10 sticky top-0 z-10">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-3xl md:text-4xl font-bold text-cyan-400 font-handwriting">
          RiddleRealm
        </h1>
        <div className="flex items-center space-x-4 md:space-x-6 text-white">
          <div className="flex items-center space-x-2">
            <TrophyIcon className="w-6 h-6 text-yellow-400" />
            <span className="font-semibold text-lg">{user.score}</span>
          </div>
          <div className="flex items-center space-x-2">
            <FireIcon className="w-6 h-6 text-orange-500" />
            <span className="font-semibold text-lg">{user.streak}</span>
          </div>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-10 h-10 rounded-full border-2 border-purple-400 object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-purple-500/50 rounded-full flex items-center justify-center font-bold border-2 border-purple-400">
              {initials}
            </div>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="ml-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:bg-white/10 transition"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
