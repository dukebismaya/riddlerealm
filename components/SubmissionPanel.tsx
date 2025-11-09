
import React, { useState } from 'react';
import { Difficulty } from '../types';
import { PlusIcon } from './icons';

interface SubmissionPanelProps {
    onRiddleSubmit: (submission: { riddle: string; answer: string; difficulty: Difficulty }) => Promise<void>;
}

const SubmissionPanel: React.FC<SubmissionPanelProps> = ({ onRiddleSubmit }) => {
  const [riddleText, setRiddleText] = useState('');
  const [answer, setAnswer] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riddleText.trim() || !answer.trim()) return;

    setError(null);
    setLoading(true);

    try {
      await onRiddleSubmit({
        riddle: riddleText,
        answer,
        difficulty,
      });

      setSubmitted(true);
      setRiddleText('');
      setAnswer('');
      setDifficulty(Difficulty.Medium);

      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-black/20 backdrop-blur-lg rounded-2xl shadow-2xl shadow-green-500/10 border border-white/10 p-6 text-center">
         <h2 className="text-2xl font-bold text-white mb-2">Thanks for your submission!</h2>
         <p className="text-slate-300">Your riddle has been sent for review. Our team of highly-trained squirrels will check it shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-black/20 backdrop-blur-lg rounded-2xl shadow-2xl shadow-green-500/10 border border-white/10 p-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <PlusIcon className="w-7 h-7 mr-3 text-green-400" />
        Submit a Riddle
      </h2>
      {error && <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/40 text-red-200 text-sm p-3">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="riddleText" className="block text-sm font-medium text-slate-300 mb-1">Riddle</label>
          <textarea
            id="riddleText"
            rows={3}
            value={riddleText}
            onChange={(e) => setRiddleText(e.target.value)}
            className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400"
            placeholder="What has an eye, but cannot see?"
            required
          />
        </div>
        <div>
          <label htmlFor="answer" className="block text-sm font-medium text-slate-300 mb-1">Answer</label>
          <input
            type="text"
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400"
            placeholder="A needle"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Difficulty</label>
          <div className="flex space-x-2">
            {Object.values(Difficulty).filter(d => d !== Difficulty.Impossible).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                  difficulty === d ? 'bg-green-500/40 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-green-500/30 border border-green-500/50 text-white font-bold py-3 rounded-lg hover:bg-green-500/50 disabled:bg-white/5 disabled:border-transparent disabled:cursor-not-allowed transition-colors">
          {loading ? 'Sending...' : 'Submit for Review'}
        </button>
      </form>
    </div>
  );
};

export default SubmissionPanel;
