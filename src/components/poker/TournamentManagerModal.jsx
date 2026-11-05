import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Plus,
  Play,
  Pause,
  Trash2,
  X,
  CheckCircle2,
  Users,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { mttStore } from '@/lib/mttStore';
import { money } from '@/lib/poker';
import { formatSeconds } from '@/components/poker/TournamentClockView';

export default function TournamentManagerModal({
  isOpen,
  onClose,
  currentTournamentId,
  onSelectTournament,
  onStartNewTournament,
}) {
  const [tournaments, setTournaments] = useState(() => mttStore.getTournaments());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setTournaments(mttStore.getTournaments());
    const unsub = mttStore.subscribe(() => {
      setTournaments(mttStore.getTournaments());
    });
    const interval = setInterval(() => {
      setTournaments(mttStore.getTournaments());
    }, 1000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [isOpen]);

  const refreshList = () => {
    setTournaments(mttStore.getTournaments());
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    mttStore.deleteTournament(id);
    setConfirmDeleteId(null);
    refreshList();
  };

  const handleSwitch = (id) => {
    mttStore.switchTournament(id);
    if (onSelectTournament) onSelectTournament(id);
    onClose();
  };

  const handleNew = () => {
    const newId = mttStore.startNewTournament();
    if (onStartNewTournament) onStartNewTournament(newId);
    onClose();
  };

  const handleToggleTimer = (id, e) => {
    e.stopPropagation();
    mttStore.toggleTimerForTournament(id);
    refreshList();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-[#161c28]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tournament Director – Tournaments</h2>
              <p className="text-xs text-slate-400">
                Switch between concurrent tournaments or launch a new tournament
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNew}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Plus size={15} />
              <span>New Tournament</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tournaments List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {tournaments.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <Trophy size={36} className="text-slate-600" />
              <div className="font-bold text-slate-300 text-sm">No Active Tournaments</div>
              <div>Click "+ New Tournament" to start your first tournament setup.</div>
            </div>
          ) : (
            tournaments.map((t) => {
              const isCurrent = t.id === currentTournamentId;
              const isConfirming = confirmDeleteId === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => !isCurrent && handleSwitch(t.id)}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
                      : 'bg-[#151922] border-slate-800 hover:border-slate-700 cursor-pointer'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-[260px]">{t.name}</span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-black">
                          Active Now
                        </span>
                      )}

                      {/* Live Timer Control Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleTimer(t.id, e)}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                          t.isRunning
                            ? 'bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 hover:bg-emerald-900/80'
                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                        title={t.isRunning ? 'Pause Tournament Timer' : 'Start/Resume Tournament Timer'}
                      >
                        {t.isRunning ? <Pause size={10} className="text-emerald-400" /> : <Play size={10} className="text-amber-400" />}
                        <span>{t.isRunning ? 'Pause' : 'Start'}</span>
                      </button>

                      {/* Live Clock Display */}
                      <div className="flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded bg-black/40 border border-slate-800 text-amber-300">
                        <Clock size={11} className="text-amber-400" />
                        <span>{formatSeconds(t.secondsLeft)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Users size={13} className="text-slate-500" />
                        <span>
                          {t.remainingPlayers} / {t.totalPlayers} Players
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-300">
                          Level {t.levelNumber || (t.level + 1)}
                        </span>
                        {t.blindsText && (
                          <span className="text-slate-400 font-mono">({t.blindsText})</span>
                        )}
                      </div>
                      {t.buyIn > 0 && (
                        <div>Buy-in: {money(t.buyIn, t.currency)}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                    {!isCurrent ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitch(t.id);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Switch</span>
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-amber-400/80 flex items-center gap-1 px-2 py-1">
                        <CheckCircle2 size={14} />
                        <span>Current</span>
                      </span>
                    )}

                    {isConfirming ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleDelete(t.id, e)}
                          className="px-2 py-1 rounded bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(t.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Delete Tournament"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
