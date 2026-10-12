import React, { useState, useEffect } from 'react';
import { LogIn, Play, Clock, Users, Spade, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { money, VARIANTS } from '@/lib/poker';
import { discardSavedSession } from '@/lib/liveSync';
import { db } from '@/api/base44Client';

export default function StartScreen({ onNewSession, onResumeSession, savedGuestSession, savedGuestUpdatedAt, onDismissGuest }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [listError, setListError] = useState('');
  const [deletingCode, setDeletingCode] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { setSessions([]); return; }
    setLoadingSessions(true);
    setListError('');
    db.functions.invoke('listSavedSessions', {})
      .then((res) => {
        const data = res?.data || res || {};
        setSessions(data.sessions || []);
      })
      .catch(() => setListError('Could not load saved sessions.'))
      .finally(() => setLoadingSessions(false));
  }, [isAuthenticated]);

  const handleDelete = async (shareCode, e) => {
    e.stopPropagation();
    if (deletingCode) return;
    if (!window.confirm('Delete this saved session? This cannot be undone.')) return;
    setDeletingCode(shareCode);
    try {
      await discardSavedSession(shareCode);
      setSessions((prev) => prev.filter((s) => s.shareCode !== shareCode));
    } catch {
      setListError('Could not delete session.');
    } finally {
      setDeletingCode(null);
    }
  };

  const login = () => { db.auth.redirectToLogin(window.location.href); };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-[#2a2f37] border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Spade size={22} className="text-emerald-400" />
            <h1 className="text-2xl font-semibold text-white">Welcome back, {user?.full_name || user?.email}</h1>
          </div>
          <p className="text-sm text-slate-400 mb-6">Resume a saved session or start a new one.</p>
          <button
            onClick={onNewSession}
            className="w-full mb-5 rounded-xl bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white py-3 flex items-center justify-center gap-2 font-medium cursor-pointer"
          >
            <Play size={18} /> Start new session
          </button>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Saved sessions</div>
          {loadingSessions ? (
            <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
          ) : listError ? (
            <div className="text-sm text-rose-400 py-4">{listError}</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-[#2a2f37] bg-[#1e2227] p-6 text-center text-sm text-slate-500">
              No saved sessions yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {sessions.map((s) => (
                <div
                  key={s.shareCode}
                  className="group relative rounded-lg border border-[#2a2f37] bg-[#1e2227] hover:bg-[#242a30] hover:border-[#4a5a4a] p-3 transition-colors"
                >
                  <button
                    onClick={() => onResumeSession(s.shareCode)}
                    className="w-full text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 pr-8">
                        <div className="text-sm font-semibold text-white truncate">
                          {VARIANTS[s.variant]?.label || "Hold'em"} – Hand #{s.handNumber}
                        </div>
                        <div className="text-xs text-slate-400">
                          {s.mode === 'cash' ? 'Cash' : 'Tournament'} – Blinds {money(s.smallBlind, s.currency)} / {money(s.bigBlind, s.currency)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <Users size={12} />
                          <span className="truncate">{s.playerNames.join(', ') || 'No players'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 text-right">
                        <Clock size={12} />
                        <span>{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDelete(s.shareCode, e)}
                    disabled={deletingCode === s.shareCode}
                    title="Delete session"
                    className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#2a2f37] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <Spade size={26} className="text-emerald-400" />
          <h1 className="text-2xl font-semibold text-white">Poker Action Tracker</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">Track live poker hands, stacks, and action for up to 10 players.</p>
        {savedGuestSession?.hand && (
          <div className="rounded-xl border border-[#4a5a4a] bg-[#1e2227] p-4 mb-4">
            <div className="flex items-center gap-2 text-emerald-300 mb-1">
              <Clock size={14} />
              <span className="text-xs font-semibold uppercase tracking-wide">Saved session in progress</span>
            </div>
            <div className="text-sm text-white mb-1">
              {VARIANTS[savedGuestSession.hand.variant]?.label || "Hold'em"} – Hand #{savedGuestSession.hand.handNumber}
            </div>
            {savedGuestUpdatedAt && (
              <div className="text-xs text-slate-500 mb-3">Last saved {new Date(savedGuestUpdatedAt).toLocaleString()}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => onResumeSession(null)}
                className="flex-1 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2 cursor-pointer"
              >
                Resume
              </button>
              <button
                onClick={onDismissGuest}
                className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm px-3 cursor-pointer"
              >
                Start new
              </button>
            </div>
          </div>
        )}
        <button
          onClick={onNewSession}
          className="w-full mb-3 rounded-xl bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white py-3 flex items-center justify-center gap-2 font-medium cursor-pointer"
        >
          <Play size={18} /> Continue as guest
        </button>
        <button
          onClick={login}
          className="w-full rounded-xl bg-[#2a2f37] hover:bg-[#363c45] text-white py-3 flex items-center justify-center gap-2 font-medium cursor-pointer"
        >
          <LogIn size={18} /> Sign in to access saved sessions
        </button>
        <p className="text-xs text-slate-500 mt-4 text-center">
          Signing in lets you resume sessions across devices. Guests can still save and resume on this device.
        </p>
      </div>
    </div>
  );
}
