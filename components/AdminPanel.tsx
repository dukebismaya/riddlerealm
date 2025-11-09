
import React, { useState, useMemo } from 'react';
import { Submission, Difficulty, DailyRiddleEntry } from '../types';
import { AdminIcon, EditIcon, DeleteIcon, CheckCircleIcon, TrophyIcon } from './icons';

interface AdminPanelProps {
  submissions: Submission[];
  onApprove: (id: string) => Promise<void> | void;
  onUpdate: (id: string, updates: Partial<Submission>) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onSetDaily: (submission: Submission) => Promise<void> | void;
  currentDaily?: DailyRiddleEntry | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ submissions, onApprove, onUpdate, onDelete, onSetDaily, currentDaily }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Submission>>({});
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingSubmissions = useMemo(() => submissions.filter(s => s.status === 'pending'), [submissions]);
  const approvedSubmissions = useMemo(() => submissions.filter(s => s.status === 'approved'), [submissions]);

  const handleEditClick = (submission: Submission) => {
    setEditingId(submission.id);
    setEditFormData({
      riddle: submission.riddle,
      answer: submission.answer,
      difficulty: submission.difficulty,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async (id: string) => {
    setPendingActionId(id);
    setActionError(null);
    try {
      await onUpdate(id, editFormData);
      handleCancelEdit();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update riddle.');
    } finally {
      setPendingActionId(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };
  
  const handleDifficultyChange = (difficulty: Difficulty) => {
    setEditFormData({ ...editFormData, difficulty });
  }

  const handleSetDaily = async (submission: Submission) => {
    setPendingActionId(submission.id);
    setActionError(null);
    try {
      await onSetDaily(submission);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to set daily riddle.');
    } finally {
      setPendingActionId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setPendingActionId(id);
    setActionError(null);
    try {
      await onApprove(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to approve riddle.');
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingActionId(id);
    setActionError(null);
    try {
      await onDelete(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete riddle.');
    } finally {
      setPendingActionId(null);
    }
  };

  const renderSubmission = (submission: Submission) => {
    const isEditing = editingId === submission.id;
    const isBusy = pendingActionId === submission.id;
    const isCurrentDaily = currentDaily?.riddleId === submission.id;

    if (isEditing) {
      return (
        <div key={submission.id} className="bg-white/10 p-4 rounded-lg space-y-3">
          <textarea
            name="riddle"
            value={editFormData.riddle}
            onChange={handleInputChange}
            className="w-full p-2 bg-black/20 border border-white/20 rounded-lg text-white text-sm"
            rows={2}
          />
          <input
            type="text"
            name="answer"
            value={editFormData.answer}
            onChange={handleInputChange}
            className="w-full p-2 bg-black/20 border border-white/20 rounded-lg text-white text-sm"
          />
          <div className="flex space-x-2">
            {Object.values(Difficulty).filter(d => d !== Difficulty.Impossible).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handleDifficultyChange(d)}
                className={`flex-1 py-1 text-xs rounded-md transition-colors ${
                  editFormData.difficulty === d ? 'bg-cyan-500/60 text-white' : 'bg-black/20 text-slate-300 hover:bg-black/40'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex justify-end space-x-2 mt-2">
            <button onClick={handleCancelEdit} className="px-3 py-1 bg-slate-500/50 text-white text-xs font-bold rounded-md hover:bg-slate-500/70">Cancel</button>
            <button
              onClick={() => handleSaveEdit(submission.id)}
              disabled={isBusy}
              className="px-3 py-1 bg-green-500/50 text-white text-xs font-bold rounded-md hover:bg-green-500/70 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBusy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={submission.id} className="bg-white/5 p-4 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex-grow mb-3 md:mb-0">
          <p className="text-slate-300 text-sm leading-relaxed">{submission.riddle}</p>
          <p className="text-cyan-400 font-bold text-sm mt-1">Answer: {submission.answer}</p>
          {submission.createdByName && (
            <p className="text-xs text-slate-400 mt-1">Submitted by {submission.createdByName}</p>
          )}
          <span className={`mt-2 inline-block px-2 py-0.5 text-xs font-bold rounded-full ${DIFFICULTY_CONFIG[submission.difficulty]?.color} bg-white/5`}>{submission.difficulty}</span>
        </div>
        <div className="flex-shrink-0 flex items-center space-x-2 self-end md:self-center">
          {submission.status === 'pending' && (
             <button
                onClick={() => handleApprove(submission.id)}
                disabled={isBusy}
                className="p-2 rounded-full bg-green-500/30 hover:bg-green-500/50 text-green-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                title="Approve"
             >
                <CheckCircleIcon className="w-5 h-5" />
             </button>
          )}
          {submission.status === 'approved' && (
            <button
              onClick={() => handleSetDaily(submission)}
              disabled={isBusy || isCurrentDaily}
              className={`p-2 rounded-full transition-colors ${isCurrentDaily ? 'bg-purple-500/40 text-purple-100 cursor-default' : 'bg-purple-500/30 hover:bg-purple-500/50 text-purple-200'} disabled:opacity-60 disabled:cursor-not-allowed`}
              title={isCurrentDaily ? 'Already featured as daily riddle' : 'Set as Daily Riddle'}
            >
              <TrophyIcon className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => handleEditClick(submission)} className="p-2 rounded-full bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 transition-colors" title="Edit">
            <EditIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDelete(submission.id)}
            disabled={isBusy}
            className="p-2 rounded-full bg-red-600/30 hover:bg-red-600/50 text-red-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Delete"
          >
            <DeleteIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black/20 backdrop-blur-lg rounded-2xl shadow-2xl shadow-orange-500/10 border border-white/10 p-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <AdminIcon className="w-7 h-7 mr-3 text-orange-400" />
        Admin Panel
      </h2>

      {currentDaily ? (
        <div className="mb-6 rounded-xl border border-purple-500/40 bg-purple-500/10 p-4">
          <div className="flex items-center text-purple-200 font-semibold mb-2">
            <TrophyIcon className="w-5 h-5 mr-2" />
            Current Daily Riddle
          </div>
          <p className="text-sm text-slate-200 leading-relaxed mb-2">{currentDaily.text}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="font-semibold text-cyan-200">Answer: {currentDaily.answer}</span>
            <span className="px-2 py-0.5 rounded-full border border-white/20 text-white/90">{currentDaily.difficulty}</span>
            <span className="text-slate-400">Date: {currentDaily.date}</span>
            {currentDaily.setByName && <span className="text-slate-400">Set by: {currentDaily.setByName}</span>}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-slate-300">
          No daily riddle has been set yet. Approve a submission and use the trophy button to feature it.
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {actionError}
        </div>
      )}
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 border-b-2 border-white/10 pb-2">Pending Review ({pendingSubmissions.length})</h3>
          <div className="space-y-3">
            {pendingSubmissions.length > 0 ? pendingSubmissions.map(renderSubmission) : <p className="text-slate-400 text-sm">No pending submissions.</p>}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3 border-b-2 border-white/10 pb-2">Approved Riddles ({approvedSubmissions.length})</h3>
           <div className="space-y-3">
            {approvedSubmissions.length > 0 ? approvedSubmissions.map(renderSubmission) : <p className="text-slate-400 text-sm">No riddles have been approved yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// Dummy DIFFICULTY_CONFIG for AdminPanel scope if needed, or import from constants
const DIFFICULTY_CONFIG = {
  [Difficulty.Easy]: { color: 'text-green-400' },
  [Difficulty.Medium]: { color: 'text-yellow-400' },
  [Difficulty.Hard]: { color: 'text-orange-400' },
  [Difficulty.Impossible]: { color: 'text-red-500' },
};

export default AdminPanel;
