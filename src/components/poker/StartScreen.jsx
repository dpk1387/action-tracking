import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Play, Clock, Users, Spade, Trash2, Trophy, FolderOpen, Calendar, Eye, Zap, Flame, ChevronRight, Smartphone, History, Bot, Layers } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { money, VARIANTS, formatSessionName } from '@/lib/poker';
import { discardSavedSession, discardAllSavedSessions } from '@/lib/liveSync';
import { db } from '@/api/base44Client';
import { mttStore } from '@/lib/mttStore';
import {
  getCompletedSessions,
  deleteCompletedSession,
  subscribeCompletedSessions,
} from '@/lib/completedSessionsStore';
import {
  getHandHistories,
  deleteHandHistory,
  clearAllHandHistories,
  subscribeHandHistories,
} from '@/lib/handHistoriesStore';
import TournamentManagerModal from '@/components/poker/TournamentManagerModal';
import CompletedSessionModal from '@/components/poker/CompletedSessionModal';
import BotsSessionModal from '@/components/poker/BotsSessionModal';
import { getBotsSessions, deleteBotsSession, subscribeBotsSessions } from '@/lib/botsSessionsStore';

export default function StartScreen({ onNewSession, onResumeSession, savedGuestSession, savedGuestUpdatedAt, onDismissGuest }) {
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [listError, setListError] = useState('');
  const [deletingCode, setDeletingCode] = useState(null);
  const [showModeModal, setShowModeModal] = useState(false);
  const [showDegenSubmenu, setShowDegenSubmenu] = useState(false);
  const [showGoVariants, setShowGoVariants] = useState(false);
  const [degenCategory, setDegenCategory] = useState(null);
  const [showDirectorTournamentsModal, setShowDirectorTournamentsModal] = useState(false);
  const [activeTournaments, setActiveTournaments] = useState(() => mttStore.getTournaments().filter((t) => t.active));

  // Tabs for Saved Sessions section: 'in_progress' | 'completed' | 'hand_histories'
  const [sessionTab, setSessionTab] = useState('in_progress');
  const [completedList, setCompletedList] = useState(() => getCompletedSessions());
  const [viewingCompleted, setViewingCompleted] = useState(null);
  const [handHistoriesList, setHandHistoriesList] = useState(() => getHandHistories());
  const [botsSessions, setBotsSessions] = useState(() => getBotsSessions());
  const [viewingBotsSession, setViewingBotsSession] = useState(null);
  const [viewingHandHistory, setViewingHandHistory] = useState(null);
  // One shared in-app confirmation for destructive actions (window.confirm is blocked in some shells)
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const degenVariants = [
    { key: 'second_best', title: '2nd Best', desc: '2nd best hand AT SHOWDOWN wins the pot.' },
    { key: 'three_two_one', title: '3-2-1', desc: '3 flop cards, 2 turn cards, 1 river card.' },
    { key: 'ocean', title: 'Ocean', desc: 'After river betting, 6th street (Ocean) is dealt with one more betting round.' },
    { key: 'red_river', title: 'Red River', desc: 'If river card is red (♦/♥), deal another river card after betting until a black card (♠/♣) lands.' },
    { key: 'win_button', title: 'Win the Button', desc: 'The winner of each hand takes the Button position for the next hand.' },
    { key: 'deuces_wild', title: 'Deuces Wild', desc: 'All 2s are wild! Dealt 22 forces instant reveal, redeal, and collects blinds/antes.' },
  ];

  // Variants that share a theme live behind one card with its own submenu.
  const degenCategories = [
    {
      key: 'extra_info',
      title: 'Extra Information',
      desc: "Games that put cards on the table you would not normally see.",
      variants: [
        { key: 'showtime', title: "Naked Hold 'Em", desc: 'All folded cards are shown face up and factored into equity.' },
        { key: 'pirate_poker', title: 'Pirate Poker', desc: 'When you are dealt your hole cards you must expose one of them to the table.' },
      ],
    },
    {
      key: 'mandatory_action',
      title: 'Mandatory Action',
      desc: 'Calling and limping are banned until enough aggression has happened.',
      variants: [
        { key: 'mandatory_3bet', title: 'Mandatory 3-Bet', desc: 'Preflop flat calling/limping is prohibited until a 3-bet occurs.' },
        { key: 'mandatory_raise', title: 'Mandatory Raise', desc: 'On every street you must raise rather than call or limp until a raise has occurred.' },
        { key: 'mandatory_4bet', title: 'Mandatory 4-Bet', desc: 'Calling and limping are prohibited until a 4-bet occurs.' },
      ],
    },
  ];
  const degenVariantCount = degenVariants.length + degenCategories.reduce((n, c) => n + c.variants.length, 0);

  useEffect(() => {
    setActiveTournaments(mttStore.getTournaments().filter((t) => t.active));
    const unsub = mttStore.subscribe(() => {
      setActiveTournaments(mttStore.getTournaments().filter((t) => t.active));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setCompletedList(getCompletedSessions());
    const unsub = subscribeCompletedSessions(() => {
      setCompletedList(getCompletedSessions());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setHandHistoriesList(getHandHistories());
    const unsub = subscribeHandHistories(() => {
      setHandHistoriesList(getHandHistories());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setBotsSessions(getBotsSessions());
    const unsub = subscribeBotsSessions(() => {
      setBotsSessions(getBotsSessions());
    });
    return () => unsub();
  }, []);

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

  const handleDeleteSaved = async (shareCode, e) => {
    e.stopPropagation();
    if (deletingCode) return;
    setDeletingCode(shareCode);
    try {
      await discardSavedSession(shareCode);
      setSessions((prev) => prev.filter((s) => s.shareCode !== shareCode && s.id !== shareCode));
    } catch {
      setListError('Could not delete session.');
    } finally {
      setDeletingCode(null);
    }
  };

  const handleDeleteCompleted = (id, e) => {
    if (e) e.stopPropagation();
    const target = completedList.find((cs) => cs.id === id);
    setPendingConfirm({
      title: 'Delete completed session?',
      message: `"${target?.sessionName || 'This session'}" and its hand history will be permanently deleted.`,
      confirmLabel: 'Delete session',
      onConfirm: () => deleteCompletedSession(id),
    });
  };

  const handleDeleteHandHistory = (id, e) => {
    if (e) e.stopPropagation();
    deleteHandHistory(id);
  };

  const handleClearAllHandHistories = () => {
    setPendingConfirm({
      title: 'Clear all hand histories?',
      message: `All ${handHistoriesList.length} saved hand histor${handHistoriesList.length === 1 ? 'y' : 'ies'} will be permanently deleted.`,
      confirmLabel: 'Clear all',
      onConfirm: () => clearAllHandHistories(),
    });
  };

  const handleClearAllActive = () => {
    setPendingConfirm({
      title: 'Clear all in-progress sessions?',
      message: `All ${sessions.length + botsInProgress.length} in-progress saved session${sessions.length + botsInProgress.length === 1 ? '' : 's'} will be deleted. Completed sessions and hand histories are untouched.`,
      confirmLabel: 'Clear all',
      onConfirm: async () => {
        setLoadingSessions(true);
        try {
          await discardAllSavedSessions();
          setSessions([]);
          botsInProgress.forEach((b) => deleteBotsSession(b.id));
          setBotsSessions(getBotsSessions());
        } catch {
          setListError('Could not clear active sessions.');
        } finally {
          setLoadingSessions(false);
        }
      },
    });
  };

  const login = () => { db.auth.redirectToLogin(window.location.href); };

  const handleLaunchDirector = () => {
    setShowModeModal(false);
    setShowDegenSubmenu(false);
    navigate('/director');
  };

  const handleLaunchTracker = () => {
    setShowModeModal(false);
    setShowDegenSubmenu(false);
    onNewSession();
  };

  // Every variant the GO engine can deal (see goModeSupported in poker.js).
  const goVariants = [
    { key: 'nlh', title: 'No-Limit Hold\u2019em', gameType: 'nl', desc: 'The standard game. 2 hole cards.' },
    { key: 'plo', title: 'Pot-Limit Omaha (4)', gameType: 'pl', desc: '4 hole cards, must use exactly 2.' },
    { key: 'plo5', title: 'Pot-Limit Omaha (5)', gameType: 'pl', desc: '5 hole cards. More draws, more action.' },
    { key: 'plo6', title: 'Pot-Limit Omaha (6)', gameType: 'pl', desc: '6 hole cards. Maximum wrap chaos.' },
    { key: 'plo8', title: 'Omaha Hi/Lo (8-or-better)', gameType: 'pl', desc: 'Pot split between the best high and the best qualifying low.' },
    { key: 'short_deck', title: 'Short Deck (6+)', gameType: 'nl', desc: '36-card deck, 2s\u20135s removed. Low straight beats trips.' },
    { key: 'pineapple', title: 'Pineapple', gameType: 'nl', desc: '3 hole cards, discard 1 before the flop.' },
    { key: 'crazy_pineapple', title: 'Crazy Pineapple', gameType: 'nl', desc: '3 hole cards, discard 1 after the flop betting round.' },
    { key: 'lazy_pineapple', title: 'Lazy Pineapple', gameType: 'nl', desc: '3 hole cards, discard 1 on the river.' },
    { key: 'super_holdem', title: "Super Hold\u2019em", gameType: 'nl', desc: '3 hole cards; may use any two, one or all three.' },
  ];

  const handleLaunchGoMode = () => {
    setShowDegenSubmenu(false);
    setShowGoVariants(true);
  };

  const handleLaunchGoVariant = (v) => {
    setShowModeModal(false);
    setShowGoVariants(false);
    onNewSession({ isGoMode: true, variant: v.key, gameType: v.gameType });
  };

  const handleLaunchDegen = (variantKey) => {
    setShowModeModal(false);
    setShowDegenSubmenu(false);
    onNewSession({ variant: variantKey });
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-[#2a2f37] border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  const hasGuestSaved = Boolean(savedGuestSession?.hand);
  const botsInProgress = botsSessions.filter((s) => s.status === 'in_progress');
  const botsCompleted = botsSessions.filter((s) => s.status === 'complete');
  const totalInProgressCount = (isAuthenticated ? sessions.length : 0) + activeTournaments.length + (hasGuestSaved ? 1 : 0) + botsInProgress.length;

  return (
    <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6 relative">
      <div className="w-full max-w-2xl">
        {/* Header with Title and Sign Out button */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Spade size={24} className="text-emerald-400 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isAuthenticated ? 'Welcome back, Poker Player' : 'Poker Action Tracker & Tournament Director'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAuthenticated ? 'Manage in-progress sessions or review completed hand histories.' : 'Run a full hand action tracker or direct a tournament with broadcast clock and payouts.'}
              </p>
            </div>
          </div>

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => logout()}
              className="px-3.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow"
              title="Sign out of your account"
            >
              <LogOut size={14} /> Sign out
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => { setShowModeModal(true); setShowDegenSubmenu(false); }}
            className="rounded-xl bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white py-3.5 px-3 flex items-center justify-center gap-2 font-semibold cursor-pointer shadow-lg transition-colors text-sm"
          >
            <Play size={18} /> Start Poker
          </button>

          <button
            type="button"
            onClick={() => {
              const list = mttStore.getTournaments().filter((t) => t.active);
              if (list.length > 0) {
                setShowDirectorTournamentsModal(true);
              } else {
                navigate('/director');
              }
            }}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3.5 px-3 flex items-center justify-center gap-2 font-semibold cursor-pointer transition-colors text-sm"
          >
            <Trophy size={18} className="text-amber-400 shrink-0" /> Tournament Director
          </button>
        </div>

        {!isAuthenticated && (
          <button
            onClick={login}
            className="w-full mb-6 rounded-xl bg-[#2a2f37] hover:bg-[#363c45] text-white py-3 flex items-center justify-center gap-2 font-medium cursor-pointer"
          >
            <LogIn size={18} /> Sign in to access cloud saved sessions
          </button>
        )}

        {/* Saved Sessions Section with Tabs */}
        <div className="rounded-xl border border-[#2a2f37] bg-[#1a1d22] p-4 shadow-xl">
          {/* Segmented Control Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#2a2f37]">
            <div className="flex flex-wrap items-center gap-1 bg-[#121417] p-1 rounded-lg border border-[#2a2f37]">
              <button
                type="button"
                onClick={() => setSessionTab('in_progress')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  sessionTab === 'in_progress'
                    ? 'bg-[#2a2f37] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock size={13} /> In Progress {totalInProgressCount > 0 ? `(${totalInProgressCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setSessionTab('completed')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  sessionTab === 'completed'
                    ? 'bg-[#2a2f37] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderOpen size={13} /> Complete Sessions {completedList.length + botsCompleted.length > 0 ? `(${completedList.length + botsCompleted.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setSessionTab('hand_histories')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  sessionTab === 'hand_histories'
                    ? 'bg-[#2a2f37] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History size={13} /> Hand Histories {handHistoriesList.length > 0 ? `(${handHistoriesList.length})` : ''}
              </button>
            </div>

            {sessionTab === 'in_progress' && (sessions.length > 0 || botsInProgress.length > 0) && (
              <button
                type="button"
                onClick={handleClearAllActive}
                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                title="Delete all in-progress saved sessions"
              >
                <Trash2 size={12} /> Clear all
              </button>
            )}

            {sessionTab === 'hand_histories' && handHistoriesList.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllHandHistories}
                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                title="Clear all saved hand histories"
              >
                <Trash2 size={12} /> Clear all
              </button>
            )}
          </div>

          {/* TAB 1: IN PROGRESS SESSIONS */}
          {sessionTab === 'in_progress' && (
            <div className="space-y-2.5">
              {/* Saved Play Bots sessions */}
              {botsInProgress.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-sky-500/40 bg-[#1e2227] hover:bg-[#242a30] p-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/bots?s=${encodeURIComponent(b.id)}`)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Bot size={15} className="text-sky-400 shrink-0" />
                      <span className="text-sm font-bold text-white truncate">
                        Play Bots — {b.setup?.seats || '—'}-max {b.setup?.difficulty ? b.setup.difficulty[0].toUpperCase() + b.setup.difficulty.slice(1) : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 border border-sky-500/40 text-sky-300 uppercase">
                        Play Bots
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                      <span>Hand #{b.handNumber || 1}</span>
                      <span>{b.levelLabel ? `Blinds ${b.levelLabel}` : ''}</span>
                      <span>{b.handCount || 0} hands played</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/bots?s=${encodeURIComponent(b.id)}`)}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingConfirm({
                          title: 'Delete bots session',
                          message: 'This saved Play Bots session and its recorded hands will be permanently deleted.',
                          confirmLabel: 'Delete',
                          onConfirm: () => {
                            deleteBotsSession(b.id);
                            setBotsSessions(getBotsSessions());
                          },
                        });
                      }}
                      title="Delete session"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {/* Active Tournament Director Sessions listed cleanly down here */}
              {activeTournaments.map((t) => (
                <div
                  key={`mtt_${t.id}`}
                  className="rounded-lg border border-amber-500/40 bg-[#1e2227] hover:bg-[#242a30] p-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Trophy size={15} className="text-amber-400 shrink-0" />
                      <span className="text-sm font-bold text-white truncate">{t.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-500/40 text-amber-300 uppercase">
                        Tournament Director
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                      <span>{t.remainingPlayers} / {t.totalPlayers} Players</span>
                      <span>Level {t.levelNumber || (t.level + 1)} {t.blindsText ? `(${t.blindsText})` : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        mttStore.switchTournament(t.id);
                        navigate('/director');
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        mttStore.deleteTournament(t.id);
                        setActiveTournaments(mttStore.getTournaments().filter((item) => item.active));
                      }}
                      title="Delete tournament session"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Local Saved Guest / In-Progress Tracker Session */}
              {hasGuestSaved && (
                <div className="rounded-lg border border-emerald-500/40 bg-[#1e2227] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Spade size={15} className="text-emerald-400 shrink-0" />
                      <span className="text-sm font-bold text-white truncate">
                        {formatSessionName(savedGuestSession.hand)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 uppercase">
                        {savedGuestSession.hand?.mode === 'tournament' ? 'Tournament Tracker' : 'Cash Tracker'}
                      </span>
                    </div>
                    {savedGuestUpdatedAt && (
                      <div className="text-xs text-slate-400">
                        Last saved: {new Date(savedGuestUpdatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onResumeSession(null)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={onDismissGuest}
                      title="Discard session"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Authenticated Cloud Saved Sessions */}
              {loadingSessions ? (
                <div className="text-sm text-slate-400 py-6 text-center">Loading sessions...</div>
              ) : listError ? (
                <div className="text-sm text-rose-400 py-4">{listError}</div>
              ) : (isAuthenticated && sessions.length === 0 && !hasGuestSaved && activeTournaments.length === 0 && botsInProgress.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No in-progress sessions saved.
                </div>
              ) : (!isAuthenticated && !hasGuestSaved && activeTournaments.length === 0 && botsInProgress.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No local in-progress sessions. Sign in to sync cloud sessions across devices.
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.shareCode || s.id}
                    className="group relative rounded-lg border border-[#2a2f37] bg-[#1e2227] hover:bg-[#242a30] hover:border-[#4a5a4a] p-3.5 transition-colors"
                  >
                    <button
                      onClick={() => {
                        if (s.isDirector) {
                          navigate(`/director?code=${encodeURIComponent(s.shareCode || s.id)}`);
                        } else {
                          onResumeSession(s.shareCode);
                        }
                      }}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 pr-8">
                          <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5 mb-0.5">
                            {s.isDirector ? <Trophy size={14} className="text-amber-400 shrink-0" /> : <Spade size={14} className="text-emerald-400 shrink-0" />}
                            <span>{s.isDirector ? (s.tournamentName || 'Tournament Director') : (s.bombPot ? `${s.variant === 'plo6' ? 'PLO6' : (VARIANTS[s.variant]?.label || "Hold'em")} Bomb Pot - Hand #${s.handNumber}` : `${VARIANTS[s.variant]?.label || "Hold'em"} - Hand #${s.handNumber}`)}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {s.isDirector
                              ? `Tournament Director – Level ${s.currentLevel || 1} (${s.remainingPlayers ?? 0} / ${s.totalPlayers ?? 0} players)`
                              : `${s.mode === 'cash' ? 'Cash' : 'Tournament'} – Blinds ${s.mode === 'tournament' ? `${s.smallBlind} / ${s.bigBlind}` : `${money(s.smallBlind, s.currency)} / ${money(s.bigBlind, s.currency)}`}`}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                            <Users size={12} />
                            <span className="truncate">{s.isDirector ? ((s.playerNames?.length > 10 || s.totalPlayers > 10) ? `${s.playerNames?.length || s.totalPlayers} players` : (s.playerNames?.join(', ') || `${s.totalPlayers || 0} players`)) : (s.playerNames?.join(', ') || 'No players')}</span>
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
                      onClick={(e) => handleDeleteSaved(s.shareCode || s.id, e)}
                      disabled={deletingCode === (s.shareCode || s.id)}
                      title="Delete session"
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#2a2f37] transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: COMPLETE SESSIONS */}
          {sessionTab === 'completed' && (
            <div className="space-y-2.5">
              {botsCompleted.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setViewingBotsSession(b)}
                  className="group relative rounded-lg border border-[#2a2f37] bg-[#1e2227] hover:bg-[#242a30] hover:border-sky-500/50 p-3.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 pr-10">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-950 border border-sky-500/40 text-sky-300 uppercase">Play Bots</span>
                        <span className="truncate">
                          {b.setup?.seats || '—'}-max {b.setup?.difficulty ? b.setup.difficulty[0].toUpperCase() + b.setup.difficulty.slice(1) : ''} — {b.outcome === 'win' ? 'You won' : b.outcome === 'bust' ? 'You busted' : 'Ended early'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-slate-300 font-semibold">
                          <FolderOpen size={12} className="text-sky-400" />
                          {b.handCount || b.handRecords?.length || 0} Hands Recorded
                        </span>
                        {b.updatedAt && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Calendar size={12} /> {new Date(b.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingBotsSession(b);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/50 text-sky-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Eye size={13} /> View Stats
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingConfirm({
                        title: 'Delete bots session',
                        message: 'This completed Play Bots session, its stats and its hand history will be permanently deleted.',
                        confirmLabel: 'Delete',
                        onConfirm: () => {
                          deleteBotsSession(b.id);
                          setBotsSessions(getBotsSessions());
                        },
                      });
                    }}
                    title="Delete bots session"
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#2a2f37] transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {completedList.length === 0 && botsCompleted.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No completed sessions saved yet. When you end a session, save it to view its complete hand history here.
                </div>
              ) : (
                completedList.map((cs) => (
                  <div
                    key={cs.id}
                    onClick={() => setViewingCompleted(cs)}
                    className="group relative rounded-lg border border-[#2a2f37] bg-[#1e2227] hover:bg-[#242a30] hover:border-emerald-500/50 p-3.5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 pr-10">
                        <div className="text-sm font-bold text-white truncate flex items-center gap-2 mb-1">
                          {cs.mode === 'tournament' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-500/40 text-amber-300 uppercase">
                              Tournament
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 uppercase">
                              Cash
                            </span>
                          )}
                          <span className="truncate">{cs.sessionName || 'Completed Session'}</span>
                        </div>

                        <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-300 font-semibold">
                            <FolderOpen size={12} className="text-emerald-400" />
                            {cs.hands?.length || cs.handCount || 0} Hands Recorded
                          </span>
                          {cs.completedAt && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar size={12} /> {new Date(cs.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {cs.playerNames && cs.playerNames.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 truncate">
                            <Users size={12} className="shrink-0" />
                            <span className="truncate">{cs.playerNames.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingCompleted(cs);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye size={13} /> View History
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteCompleted(cs.id, e)}
                      title="Delete completed session"
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#2a2f37] transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: HAND HISTORIES */}
          {sessionTab === 'hand_histories' && (
            <div className="space-y-2.5">
              {handHistoriesList.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No saved hand histories yet. Whenever you save an in-progress or completed session, all played hands are automatically archived here.
                </div>
              ) : (
                handHistoriesList.map((hh) => (
                  <div
                    key={hh.id}
                    onClick={() => setViewingHandHistory(hh)}
                    className="group relative rounded-lg border border-[#2a2f37] bg-[#1e2227] hover:bg-[#242a30] hover:border-emerald-500/50 p-3.5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 pr-10">
                        <div className="text-sm font-bold text-white truncate flex items-center gap-2 mb-1">
                          {hh.mode === 'tournament' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-500/40 text-amber-300 uppercase">
                              Tournament
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 uppercase">
                              Cash
                            </span>
                          )}
                          <span className="truncate">{hh.sessionName || 'Hand History'}</span>
                        </div>

                        <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-300 font-semibold">
                            <History size={12} className="text-emerald-400" />
                            {hh.hands?.length || hh.handCount || 0} Hands Recorded
                          </span>
                          {(hh.lastSavedAt || hh.completedAt || hh.createdAt) && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar size={12} /> {new Date(hh.lastSavedAt || hh.completedAt || hh.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {hh.playerNames && hh.playerNames.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 truncate">
                            <Users size={12} className="shrink-0" />
                            <span className="truncate">{hh.playerNames.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingHandHistory(hh);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye size={13} /> View Hands
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteHandHistory(hh.id, e)}
                      title="Delete hand history"
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#2a2f37] transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode Choice Modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 text-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {showGoVariants ? 'Select GO Variant' : showDegenSubmenu ? 'Select Degen Variant' : 'Choose Session Mode'}
                </h2>
                <p className="text-xs text-slate-400">
                  {showGoVariants
                    ? 'Play any of these games on one shared device'
                    : showDegenSubmenu
                    ? 'Pick a No-Limit Hold\'em variant rule'
                    : 'Select how you want to run this poker game'}
                </p>
              </div>
              <button
                onClick={() => { setShowModeModal(false); setShowDegenSubmenu(false); setShowGoVariants(false); }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {showGoVariants ? (
              <div className="space-y-2.5" data-testid="go-variant-list">
                <button
                  type="button"
                  onClick={() => setShowGoVariants(false)}
                  className="text-xs text-amber-400 hover:text-amber-300 mb-2 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  ← Back to Modes
                </button>
                {goVariants.map((v) => (
                  <div
                    key={v.key}
                    data-testid={`go-variant-${v.key}`}
                    onClick={() => handleLaunchGoVariant(v)}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white group-hover:text-amber-300 flex items-center gap-2">
                        <Smartphone size={14} className="text-amber-400" />
                        {v.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300 uppercase">
                        GO
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            ) : !showDegenSubmenu ? (
              <div className="space-y-3">
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
                        Track hands street-by-street with individual hole cards, chip stacks, pots, and actions.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={handleLaunchGoMode}
                  className="p-4 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer group shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform shrink-0">
                      <Smartphone size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-amber-200 group-hover:text-amber-100 transition-colors">
                          GO Mode (Deckless Pass & Play)
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          1 Device
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                        Play home games on 1 phone without a physical deck — auto-dealt hole cards, pot tracking, and privacy protection.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setShowDegenSubmenu(true)}
                  className="p-4 rounded-xl bg-amber-950/30 hover:bg-amber-900/40 border border-amber-600/40 hover:border-amber-400 transition-all cursor-pointer group shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform shrink-0">
                      <Flame size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-amber-200 group-hover:text-amber-100 transition-colors flex items-center gap-1.5">
                          Degen Variants (NLH)
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          {degenVariantCount} Variants <ChevronRight size={12} />
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                        Play wild NLH variants: 2nd Best, 3-2-1, Ocean, Red River, Win the Button, Deuces Wild, plus Extra Information and Mandatory Action games!
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => navigate('/bots')}
                  className="p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 border border-slate-600/50 hover:border-emerald-500/60 transition-all cursor-pointer group shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform shrink-0">
                      <Bot size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors">
                          Play Bots
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          Solo <ChevronRight size={12} />
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Practice heads-up to 10-max against bots — pick a difficulty, a playstyle, a starting stack and a blind speed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (degenCategory) { setDegenCategory(null); return; }
                    setShowDegenSubmenu(false);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 mb-2 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  ← {degenCategory ? 'Back to Degen Variants' : 'Back to Modes'}
                </button>
                {degenCategory ? (
                  degenCategories.filter((c) => c.key === degenCategory).map((cat) => cat.variants.map((v) => (
                    <div
                      key={v.key}
                      onClick={() => handleLaunchDegen(v.key)}
                      className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white group-hover:text-amber-300 flex items-center gap-2">
                          <Zap size={14} className="text-amber-400" />
                          {v.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300 uppercase">
                          {cat.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{v.desc}</p>
                    </div>
                  )))
                ) : (
                  <>
                    {degenVariants.map((v) => (
                      <div
                        key={v.key}
                        onClick={() => handleLaunchDegen(v.key)}
                        className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white group-hover:text-amber-300 flex items-center gap-2">
                            <Zap size={14} className="text-amber-400" />
                            {v.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300 uppercase">
                            NLH Variant
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {v.desc}
                        </p>
                      </div>
                    ))}
                    {degenCategories.map((cat) => (
                      <div
                        key={cat.key}
                        data-testid={`degen-cat-${cat.key}`}
                        onClick={() => setDegenCategory(cat.key)}
                        className="p-3.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-600/50 hover:border-amber-400 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-amber-200 group-hover:text-amber-100 flex items-center gap-2">
                            <Layers size={14} className="text-amber-300" />
                            {cat.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 uppercase flex items-center gap-1">
                            {cat.variants.length} Games <ChevronRight size={10} />
                          </span>
                        </div>
                        <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">{cat.desc}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowModeModal(false); setShowDegenSubmenu(false); }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament Director Multi-Tournament Manager Modal */}
      <TournamentManagerModal
        isOpen={showDirectorTournamentsModal}
        onClose={() => setShowDirectorTournamentsModal(false)}
        onSelectTournament={() => navigate('/director')}
        onStartNewTournament={() => navigate('/director?new=true')}
      />

      {/* Completed Session View Modal */}
      {viewingCompleted && (
        <CompletedSessionModal
          session={viewingCompleted}
          onClose={() => setViewingCompleted(null)}
          onDelete={(id) => {
            setPendingConfirm({
              title: 'Delete completed session?',
              message: `"${viewingCompleted?.sessionName || 'This session'}" and its hand history will be permanently deleted.`,
              confirmLabel: 'Delete session',
              onConfirm: () => deleteCompletedSession(id),
            });
            setViewingCompleted(null);
          }}
        />
      )}

      {/* Hand History View Modal */}
      {viewingHandHistory && (
        <CompletedSessionModal
          session={viewingHandHistory}
          onClose={() => setViewingHandHistory(null)}
          onDelete={(id) => {
            deleteHandHistory(id);
            setViewingHandHistory(null);
          }}
        />
      )}

      {viewingBotsSession && (
        <BotsSessionModal session={viewingBotsSession} onClose={() => setViewingBotsSession(null)} />
      )}

      {/* Shared confirmation for destructive actions */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1d22] border border-[#2a2f37] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 size={16} className="text-rose-400" />
              {pendingConfirm.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{pendingConfirm.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-3 py-1.5 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingConfirm.onConfirm;
                  setPendingConfirm(null);
                  action?.();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                {pendingConfirm.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
