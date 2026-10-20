import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Play, Clock, Users, Spade, Trash2, Trophy, X, Sliders } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { money, VARIANTS } from '@/lib/poker';
import { discardSavedSession, discardAllSavedSessions } from '@/lib/liveSync';
import { db } from '@/api/base44Client';

export default function StartScreen({ onNewSession, onResumeSession, savedGuestSession, savedGuestUpdatedAt, onDismissGuest }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [listError, setListError] = useState('');
  const [deletingCode, setDeletingCode] = useState(null);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState(null);
  const [showModeModal, setShowModeModal] = useState(false);

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
    setDeletingCode(shareCode);
    try {
      await discardSavedSession(shareCode);
      setSessions((prev) => prev.filter((s) => s.shareCode !== shareCode && s.id !== shareCode));
      setConfirmDeleteCode(null);
    } catch {
      setListError('Could not delete session.');
    } finally {
      setDeletingCode(null);
    }
  };

  const handleClearAll = async () => {
    setLoadingSessions(true);
    try {
      await discardAllSavedSessions();
      setSessions([]);
    } catch {
      setListError('Could not clear sessions.');
    } finally {
      setLoadingSessions(false);
    }
  };

  const login = () => { db.auth.redirectToLogin(window.location.href); };

  const handleLaunchDirector = () => {
    setShowModeModal(false);
    navigate('/director');
  };

  const handleLaunchTracker = () => {
    setShowModeModal(false);
    onNewSession();
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-[#2a2f37] border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6 relative">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Spade size={22} className="text-emerald-400" />
          <h1 className="text-2xl font-semibold text-white">
            {isAuthenticated ? `Welcome back, ${user?.full_name || user?.email}` : 'Poker Action Tracker & Tournament Director'}
          </h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          {isAuthenticated ? 'Resume a saved session or launch a new game mode.' : 'Run a full hand action tracker or direct a tournament with broadcast clock and payouts.'}
        </p>

        {/* Saved guest session banner */}
        {savedGuestSession?.hand && (
          <div className="rounded-xl border border-emerald-500/40 bg-[#1e2227] p-4 mb-4 shadow-lg">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-emerald-300">
                <Clock size={15} />
                <span className="text-xs font-bold uppercase tracking-wider">Saved Session In Progress</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissGuest();
                }}
                title="Discard and delete saved session"
                className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="text-sm font-semibold text-white mb-1">
              {VARIANTS[savedGuestSession.hand.variant]?.label || "Hold'em"} – Hand #{savedGuestSession.hand.handNumber}
            </div>
            {savedGuestUpdatedAt && (
              <div className="text-xs text-slate-500 mb-3">Last saved {new Date(savedGuestUpdatedAt).toLocaleString()}</div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onResumeSession(null)}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm py-2 font-medium cursor-pointer transition-colors shadow"
              >
                Resume Session
              </button>
              <button
                type="button"
                onClick={onDismissGuest}
                className="rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-sm px-3.5 py-2 cursor-pointer font-medium flex items-center gap-1.5 transition-colors"
                title="Discard this session permanently and start fresh"
              >
                <Trash2 size={14} /> Discard & Start New
              </button>
            </div>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setShowModeModal(true)}
            className="rounded-xl bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white py-3.5 px-4 flex items-center justify-center gap-2 font-medium cursor-pointer shadow-lg"
          >
            <Play size={18} /> Start New Session
          </button>

          <Link
            to="/director"
            className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3.5 px-4 flex items-center justify-center gap-2 font-medium cursor-pointer transition-colors"
          >
            <Trophy size={18} className="text-amber-400" /> Tournament Director Mode
          </Link>
        </div>

        {!isAuthenticated && (
          <button
            onClick={login}
            className="w-full mb-6 rounded-xl bg-[#2a2f37] hover:bg-[#363c45] text-white py-3 flex items-center justify-center gap-2 font-medium cursor-pointer"
          >
            <LogIn size={18} /> Sign in to access saved sessions
          </button>
        )}

        {/* Saved Sessions list for logged in users */}
        {isAuthenticated && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Saved sessions</div>
              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Delete all saved sessions"
                >
                  <Trash2 size={12} /> Clear all
                </button>
              )}
            </div>
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
                    key={s.shareCode || s.id}
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
                            <span className="truncate">{s.playerNames?.join(', ') || 'No players'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 text-right">
                          <Clock size={12} />
                          <span>{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(s.shareCode || s.id, e)}
                      disabled={deletingCode === (s.shareCode || s.id)}
                      title="Delete session"
                      className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#2a2f37] transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mode Choice Modal (Prompt at tournament startup to pick Director or Tracker) */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Choose Session Mode</h2>
                <p className="text-xs text-slate-400">Select how you want to run this poker game</p>
              </div>
              <button
                onClick={() => setShowModeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Option 1: Tournament Director Mode */}
              <div
                onClick={handleLaunchDirector}
                className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                    <Trophy size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                        Tournament Director Mode
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Directing Only
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Direct a tournament without tracking hand action. Manage the tournament clock, levels, field count, rebuys, and payout ladders with broadcast TV and spectator clock view.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Action Tracker Mode */}
              <div
                onClick={handleLaunchTracker}
                className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                    <Spade size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                        Action Tracker Mode
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Full Hand Tracking
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Track hands street-by-street with individual hole cards, chip stacks, pots, and actions for cash games or single-table tournaments.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
