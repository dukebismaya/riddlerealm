
import React, { useState, useEffect } from 'react';
import { Riddle, GameState, HintDelivery } from '../types';
import { DIFFICULTY_CONFIG } from '../constants';
import { LightbulbIcon, SkullIcon, CheckCircleIcon, XCircleIcon } from './icons';
import { isAnswerCorrect, isAnswerCorrectWithAI } from '../utils/answerMatching';

interface RiddleCardProps {
  riddle: Riddle;
  title: string;
  gameState: GameState;
  onCorrectAnswer: () => void;
  onWrongAnswer: () => void;
  onGiveUp: () => void;
  onGetHint: () => Promise<HintDelivery>;
  attemptsLeft: number;
  onNextRiddle?: () => void;
  nextLabel?: string;
}

const RiddleCard: React.FC<RiddleCardProps> = ({ riddle, title, gameState, onCorrectAnswer, onWrongAnswer, onGiveUp, onGetHint, attemptsLeft, onNextRiddle, nextLabel }) => {
  const [answer, setAnswer] = useState('');
  const [hints, setHints] = useState<Array<{ hint: string; roast: string }>>([]);
  const [hintNotice, setHintNotice] = useState<string | null>(null);
  const [remainingHints, setRemainingHints] = useState<number | null>(null);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [shake, setShake] = useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);

  useEffect(() => {
    setAnswer('');
    setHints([]);
    setHintNotice(null);
    setRemainingHints(null);
    setIsCheckingAnswer(false);
  }, [riddle.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || gameState !== 'playing' || isCheckingAnswer) return;

    setIsCheckingAnswer(true);

    try {
      let accepted = isAnswerCorrect(answer, riddle.answer, riddle.alternateAnswers);

      if (!accepted) {
        accepted = await isAnswerCorrectWithAI(answer, riddle.answer, riddle.alternateAnswers);
      }

      if (accepted) {
        onCorrectAnswer();
      } else {
        onWrongAnswer();
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } finally {
      setIsCheckingAnswer(false);
      setAnswer('');
    }
  };

  const handleGetHint = async () => {
    if (isGettingHint) {
      return;
    }

    setIsGettingHint(true);
    try {
      const result = await onGetHint();
      if (!result) {
        setHintNotice('No hints are available for this riddle right now.');
        setRemainingHints(0);
        return;
      }

      if (result.hint) {
        setHints((prev) => [...prev, { hint: result.hint, roast: result.roast }]);
      }

      let message: string | null = null;
      if (!result.hint) {
        message = 'No hint text was provided.';
      }
      if (result.exhausted && result.remaining === 0) {
        message = 'No more hints available for this riddle.';
      }

      setHintNotice(message);
      setRemainingHints(typeof result.remaining === 'number' ? result.remaining : 0);
    } catch (error) {
      console.error('Failed to retrieve hint:', error);
      setHintNotice('Unable to fetch a hint. Please try again in a moment.');
      setRemainingHints(0);
    } finally {
      setIsGettingHint(false);
    }
  };

  const difficulty = DIFFICULTY_CONFIG[riddle.difficulty];

  const renderContent = () => {
    if (gameState === 'solved') {
      return (
        <div className="text-center p-8 flex flex-col items-center justify-center space-y-4">
          <CheckCircleIcon className="w-24 h-24 text-green-400 mb-4" />
          <h3 className="text-2xl font-bold text-white">Correct!</h3>
          <p className="text-lg text-slate-300">The answer was: <span className="font-bold text-cyan-400">{riddle.answer}</span></p>
          <p className="text-yellow-400 mt-2">You earned {difficulty.points} points!</p>
          {onNextRiddle && (
            <button
              type="button"
              onClick={onNextRiddle}
              className="mt-2 inline-flex items-center px-4 py-2 bg-cyan-500/30 border border-cyan-500/50 text-white font-semibold rounded-lg hover:bg-cyan-500/50 transition"
            >
              {nextLabel ?? 'Next Riddle'}
            </button>
          )}
        </div>
      );
    }

    if (gameState === 'failed') {
      return (
        <div className="text-center p-8 flex flex-col items-center justify-center space-y-4">
          <XCircleIcon className="w-24 h-24 text-red-500 mb-4" />
          <h3 className="text-2xl font-bold text-white">Nice Try!</h3>
          <p className="text-lg text-slate-300">The answer was: <span className="font-bold text-cyan-400">{riddle.answer}</span></p>
          {attemptsLeft <= 0 && <p className="text-slate-400 mt-2">You ran out of attempts.</p>}
          {onNextRiddle && (
            <button
              type="button"
              onClick={onNextRiddle}
              className="mt-2 inline-flex items-center px-4 py-2 bg-white/10 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/20 transition"
            >
              {nextLabel ?? 'Try Another'}
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="p-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${difficulty.color} bg-white/5`}>{riddle.difficulty}</span>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed min-h-[100px]">{riddle.text}</p>
        </div>
        
        {(hints.length > 0 || hintNotice) && (
          <div className="px-8 pb-4 space-y-3">
            {hints.map((entry, index) => (
              <div key={`hint-${index}`} className="bg-white/5 p-4 rounded-lg border border-white/10">
                <p className="text-cyan-300">
                  <span className="font-bold">Hint {index + 1}:</span> {entry.hint}
                </p>
                {entry.roast && (
                  <p className="text-purple-400 italic mt-2 text-sm">"{entry.roast}"</p>
                )}
              </div>
            ))}
            {hintNotice && (
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-sm text-slate-200">
                {hintNotice}
              </div>
            )}
          </div>
        )}

        <div className="px-8 py-6 bg-black/20 border-t border-white/10 rounded-b-2xl">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer..."
              className={`w-full p-3 bg-white/5 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-300 ${shake ? 'animate-shake border-red-500' : 'border-white/10'}`}
              disabled={gameState !== 'playing' || isCheckingAnswer}
            />
            <button type="submit" disabled={gameState !== 'playing' || isCheckingAnswer} className="w-full mt-4 bg-cyan-500/30 border border-cyan-500/50 text-white font-bold py-3 rounded-lg hover:bg-cyan-500/50 disabled:bg-white/5 disabled:text-white/30 disabled:border-transparent disabled:cursor-not-allowed transition-colors">
              {isCheckingAnswer ? 'Checking...' : 'Submit Answer'}
            </button>
          </form>
          <div className="mt-4 flex justify-between items-center">
            <div className="flex space-x-2">
              <button onClick={handleGetHint} disabled={isGettingHint || gameState !== 'playing' || isCheckingAnswer || remainingHints === 0} className="flex items-center space-x-2 px-4 py-2 bg-yellow-500/30 border border-yellow-500/50 text-white font-semibold rounded-lg hover:bg-yellow-500/50 disabled:bg-white/5 disabled:text-white/30 disabled:border-transparent disabled:cursor-not-allowed transition-colors text-sm">
                <LightbulbIcon className="w-5 h-5" />
                <span>{isGettingHint ? 'Thinking...' : hints.length > 0 ? 'More Hint' : 'Hint'}</span>
              </button>
              <button onClick={onGiveUp} disabled={gameState !== 'playing' || isCheckingAnswer} className="flex items-center space-x-2 px-4 py-2 bg-red-600/30 border border-red-600/50 text-white font-semibold rounded-lg hover:bg-red-600/50 disabled:bg-white/5 disabled:text-white/30 disabled:border-transparent disabled:cursor-not-allowed transition-colors text-sm">
                <SkullIcon className="w-5 h-5" />
                <span>Give Up</span>
              </button>
            </div>
            <div className="text-slate-400 font-medium">
              Attempts Left: <span className="font-bold text-white">{attemptsLeft}</span>
            </div>
          </div>
        </div>
      </>
    );
  };
  
  return (
    <div className={`bg-black/30 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/20 border border-white/10 overflow-hidden transition-all duration-500 ${gameState !== 'playing' ? 'min-h-[450px] flex items-center justify-center' : 'min-h-[450px]'}`}>
      {renderContent()}
       <style>{`
          @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
          }
          .animate-shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
          }
        `}</style>
    </div>
  );
};

export default RiddleCard;
