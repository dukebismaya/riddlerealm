import React, { useState } from 'react';

export type PendingUserSummary = {
  id: string;
  name: string;
  email?: string;
  approvalRequestedAt?: string;
};

type UserApprovalQueueProps = {
  users: PendingUserSummary[];
  onApprove: (userId: string) => Promise<void> | void;
  onDeny: (userId: string, reason?: string) => Promise<void> | void;
  resolvingUserId: string | null;
  error: string | null;
};

const formatRequestedAt = (value?: string) => {
  if (!value) {
    return 'Timestamp pending';
  }
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    console.warn('Unable to format approval timestamp.', error);
    return value;
  }
};

const UserApprovalQueue: React.FC<UserApprovalQueueProps> = ({ users, onApprove, onDeny, resolvingUserId, error }) => {
  const hasPending = users.length > 0;
  const [notes, setNotes] = useState<Record<string, string>>({});

  const updateNote = (userId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [userId]: value }));
  };

  const clearNote = (userId: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  return (
    <div className="bg-black/20 backdrop-blur-lg rounded-2xl shadow-2xl shadow-orange-500/10 border border-white/10 p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Access Requests</p>
          <h2 className="text-2xl font-bold text-white">Players awaiting approval</h2>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-white/10 text-white/80">
          {users.length} pending
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!hasPending && (
        <p className="text-sm text-slate-400">No players are waiting for approval right now.</p>
      )}

      {hasPending && (
        <div className="space-y-4">
          {users.map((pendingUser) => {
            const busy = resolvingUserId === pendingUser.id;
            const handleApproveClick = async () => {
              if (busy) {
                return;
              }
              try {
                await onApprove(pendingUser.id);
                clearNote(pendingUser.id);
              } catch (approvalError) {
                console.error('Failed to approve user from queue component:', approvalError);
              }
            };
            const handleDenyClick = async () => {
              if (busy) {
                return;
              }
              try {
                await onDeny(pendingUser.id, notes[pendingUser.id]?.trim());
                clearNote(pendingUser.id);
              } catch (denialError) {
                console.error('Failed to deny user from queue component:', denialError);
              }
            };
            return (
              <div key={pendingUser.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <p className="text-base font-semibold text-white">{pendingUser.name || 'Explorer'}</p>
                  <p className="text-sm text-slate-300">{pendingUser.email ?? 'No email recorded'}</p>
                  <p className="text-xs text-slate-400 mt-1">Requested: {formatRequestedAt(pendingUser.approvalRequestedAt)}</p>
                </div>
                <textarea
                  value={notes[pendingUser.id] ?? ''}
                  onChange={(event) => updateNote(pendingUser.id, event.target.value)}
                  placeholder="Optional note for the player (shown if denied)"
                  className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  rows={2}
                />
                <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                  <button
                    type="button"
                    onClick={handleApproveClick}
                    disabled={busy}
                    className="rounded-lg bg-orange-500/70 hover:bg-orange-500 text-white font-semibold px-4 py-2 transition disabled:cursor-not-allowed disabled:bg-orange-500/30"
                  >
                    {busy ? 'Approving…' : 'Approve access'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDenyClick}
                    disabled={busy}
                    className="rounded-lg bg-rose-500/70 hover:bg-rose-500 text-white font-semibold px-4 py-2 transition disabled:cursor-not-allowed disabled:bg-rose-500/30"
                  >
                    {busy ? 'Processing…' : 'Deny access'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserApprovalQueue;
