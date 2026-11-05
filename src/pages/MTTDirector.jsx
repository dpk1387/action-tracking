import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Clock,
  Tv,
  Eye,
  ArrowLeft,
  Sliders,
  HelpCircle,
  Play,
  RotateCcw,
  X,
  LogOut,
  Save,
  Trash2,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { useMTT, mttStore } from '@/lib/mttStore';
import { saveNow, ensureSaveCode, loadSavedSession, getShareCode, setShareCode } from '@/lib/liveSync';
import TournamentClockView from '@/components/poker/TournamentClockView';
import DirectorControlDock from '@/components/poker/DirectorControlDock';
import DirectorStructureDialog from '@/components/poker/DirectorStructureDialog';
import DirectorBustDialog from '@/components/poker/DirectorBustDialog';
import DirectorPreplanDialog from '@/components/poker/DirectorPreplanDialog';
import DirectorSetLevelDialog from '@/components/poker/DirectorSetLevelDialog';
import DirectorLateRegDialog from '@/components/poker/DirectorLateRegDialog';
import DirectorReEntryDialog from '@/components/poker/DirectorReEntryDialog';
import DirectorRebuyDialog from '@/components/poker/DirectorRebuyDialog';
import DirectorTournamentEndDialog from '@/components/poker/DirectorTournamentEndDialog';
import DirectorRosterModal from '@/components/poker/DirectorRosterModal';
import TournamentManagerModal from '@/components/poker/TournamentManagerModal';

export default function MTTDirector() {
  const mtt = useMTT();
  const navigate = useNavigate();

  // Modals state - show setup modal if tournament is not yet active
  const [showStructureModal, setShowStructureModal] = useState(!mtt.active);
  const [showTournamentsModal, setShowTournamentsModal] = useState(false);
  const [showBustModal, setShowBustModal] = useState(false);
  const [showSetLevelModal, setShowSetLevelModal] = useState(false);
  const [showPreplanModal, setShowPreplanModal] = useState(false);
  const [showLateRegModal, setShowLateRegModal] = useState(false);
  const [showReEntryModal, setShowReEntryModal] = useState(false);
  const [showRebuyModal, setShowRebuyModal] = useState(false);
  const [showEndTournamentModal, setShowEndTournamentModal] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);

  const remainingPlayers = mtt.remainingPlayers ?? mtt.totalPlayers ?? 0;

  // Resume / Load saved session from code or handle ?new=true
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isNew = urlParams.get('new') === 'true';
    if (isNew) {
      mttStore.startNewTournament();
      setShowStructureModal(true);
      return;
    }

    const code = urlParams.get('code') || urlParams.get('resume');
    if (code) {
      if (code !== getShareCode()) setShareCode(code);
      loadSavedSession(code).then((res) => {
        if (res?.saved?.director) {
          mttStore.loadTournament(res.saved.director);
          setShowStructureModal(false);
        }
      });
    } else if (mtt.active) {
      setShowStructureModal(false);
    }
  }, []);

  // Automatically trigger tournament end dialog when 1 player remains
  useEffect(() => {
    if (mtt.active && remainingPlayers === 1) {
      setShowEndTournamentModal(true);
    }
  }, [mtt.active, remainingPlayers]);



  const handleSaveStructure = (data) => {
    if (!mtt.active) {
      mttStore.createDirectorTournament(data);
    } else {
      mttStore.updateStructure(data);
    }
    setShowStructureModal(false);
  };

  const handleResetTournament = () => {
    if (window.confirm('Reset this tournament? All clock and elimination history will be cleared.')) {
      mttStore.resetTournament();
      setShowStructureModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d12] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#0f131a] px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Tournament Director
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Directing Mode
              </span>
            </div>

            {/* Tournament Selector / Switcher */}
            <button
              type="button"
              onClick={() => setShowTournamentsModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-600/50 cursor-pointer shadow-sm transition-colors"
              title="Switch tournament or manage tournaments"
            >
              <Trophy size={14} className="text-amber-400" />
              <span className="max-w-[140px] truncate">{mtt.name || 'Tournament'}</span>
              <ChevronDown size={13} className="text-amber-400/80" />
            </button>

            {/* New Tournament Shortcut */}
            <button
              type="button"
              onClick={() => {
                mttStore.startNewTournament();
                setShowStructureModal(true);
              }}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="Start a new tournament"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">New Tournament</span>
            </button>

            {/* Enter Remaining Player Names Shortcut - only shown if nameEntryMode is 'itm' */}
            {mtt.nameEntryMode === 'itm' && (
              <button
                type="button"
                onClick={() => setShowRosterModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                title="Enter or update player names for the remaining field approaching the money"
              >
                <Users size={13} className="text-emerald-400" />
                <span className="hidden sm:inline">Enter Names</span>
                <span className="text-[11px] text-slate-400">({remainingPlayers})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/tv"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Tv size={14} className="text-purple-400" />
              <span>TV View</span>
            </Link>

            <Link
              to="/spectator"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Eye size={14} className="text-cyan-400" />
              <span>Spectator View</span>
            </Link>

            <button
              onClick={() => setShowStructureModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              <Sliders size={14} className="text-emerald-400" />
              <span>Structure</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEndSessionModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>End Session</span>
            </button>

            <button
              onClick={handleResetTournament}
              title="Reset tournament"
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Director Screen Content */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col justify-between">
        {/* 1. CLOCK VIEW (Top half: Middle level/time/break, Left field/chips, Right blinds/payouts/next) */}
        <TournamentClockView directorState={mtt} />

        {/* 2. CONTROL MENU (Docked below the clock view in the normal display) */}
        <DirectorControlDock
          directorState={mtt}
          onToggleTimer={() => mttStore.toggleTimer()}
          onAdjustMinutes={(mins) => mttStore.adjustSeconds(mins * 60)}
          onNextLevel={() => mttStore.nextLevel()}
          onOpenSetLevel={() => setShowSetLevelModal(true)}
          onOpenPreplanLevel={() => setShowPreplanModal(true)}
          onToggleHandForHand={() => mttStore.toggleHandForHand()}
          onOpenRecordBust={() => setShowBustModal(true)}
          onOpenLateReg={() => setShowLateRegModal(true)}
          onOpenReEntry={() => setShowReEntryModal(true)}
          onOpenRebuy={() => setShowRebuyModal(true)}
          onAdjustPlayerCount={(delta) => mttStore.manualAdjustRemainingPlayers(delta)}
          onOpenStructureSetup={() => setShowStructureModal(true)}
          onOpenRoster={() => setShowRosterModal(true)}
        />
      </main>

      {/* Modals */}
      <DirectorStructureDialog
        isOpen={showStructureModal}
        initialData={mtt}
        onSave={handleSaveStructure}
        onClose={() => {
          if (!mtt.active) {
            navigate('/');
          } else {
            setShowStructureModal(false);
          }
        }}
      />

      <DirectorBustDialog
        isOpen={showBustModal}
        remainingPlayers={mtt.remainingPlayers ?? mtt.totalPlayers}
        players={mtt.players || []}
        eliminations={mtt.eliminations || []}
        payouts={mtt.payouts || []}
        splitSimultaneousTies={mtt.splitSimultaneousTies}
        onConfirmBust={(bustData) => mttStore.recordBust(bustData)}
        onOpenRoster={() => {
          setShowBustModal(false);
          setShowRosterModal(true);
        }}
        onClose={() => setShowBustModal(false)}
      />

      <DirectorRosterModal
        isOpen={showRosterModal}
        remainingPlayers={mtt.remainingPlayers ?? mtt.totalPlayers}
        players={mtt.players || []}
        onSaveNames={(names) => mttStore.updateRosterNames(names)}
        onClose={() => setShowRosterModal(false)}
      />

      <DirectorSetLevelDialog
        isOpen={showSetLevelModal}
        currentLevel={mtt.clock?.level || 0}
        schedule={mtt.clock?.blindSchedule || []}
        onSelectLevel={(idx) => mttStore.setLevel(idx)}
        onClose={() => setShowSetLevelModal(false)}
      />

      <DirectorPreplanDialog
        isOpen={showPreplanModal}
        currentSchedule={mtt.clock?.blindSchedule || []}
        levelDurationMinutes={mtt.clock?.levelDurationMinutes || 15}
        onSaveLevel={(newLevel) => mttStore.preplanLevel(newLevel)}
        onClose={() => setShowPreplanModal(false)}
      />

      <DirectorLateRegDialog
        isOpen={showLateRegModal}
        directorState={mtt}
        onConfirmLateReg={(data) => mttStore.lateRegPlayer(data)}
        onClose={() => setShowLateRegModal(false)}
      />

      <DirectorReEntryDialog
        isOpen={showReEntryModal}
        directorState={mtt}
        onConfirmReEntry={(data) => mttStore.reEntryPlayer(data)}
        onClose={() => setShowReEntryModal(false)}
      />

      <DirectorRebuyDialog
        isOpen={showRebuyModal}
        directorState={mtt}
        onConfirmRebuy={(data) => mttStore.rebuyPlayer(data)}
        onClose={() => setShowRebuyModal(false)}
      />

      {/* Final Results & Standings Dialog */}
      <DirectorTournamentEndDialog
        isOpen={showEndTournamentModal}
        directorState={mtt}
        onClose={() => setShowEndTournamentModal(false)}
        onContinueHome={async () => {
          try {
            ensureSaveCode();
            await saveNow({ director: mttStore.get() });
          } catch (e) {}
          setShowEndTournamentModal(false);
          navigate('/');
        }}
        onResetTournament={() => {
          mttStore.resetTournament();
          setShowEndTournamentModal(false);
          setShowStructureModal(true);
        }}
      />

      {/* End Session Dialog */}
      {showEndSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <LogOut size={18} />
                <span>End Tournament Session</span>
              </div>
              <button
                type="button"
                onClick={() => setShowEndSessionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-slate-300 mb-5 leading-relaxed">
              Choose what you would like to do with this tournament session:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    ensureSaveCode();
                    await saveNow({ director: mttStore.get() });
                  } catch (e) {}
                  setShowEndSessionModal(false);
                  navigate('/');
                }}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow"
              >
                <Save size={16} /> Save Session & Return to Home
              </button>

              <button
                type="button"
                onClick={() => {
                  mttStore.resetTournament();
                  setShowEndSessionModal(false);
                  navigate('/');
                }}
                className="w-full py-3 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-200 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Trash2 size={16} /> Discard Session & Reset
              </button>

              <button
                type="button"
                onClick={() => setShowEndSessionModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center cursor-pointer transition-colors"
              >
                Go Back to Tournament Clock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournaments Manager Modal */}
      <TournamentManagerModal
        isOpen={showTournamentsModal}
        onClose={() => setShowTournamentsModal(false)}
        currentTournamentId={mtt.id}
        onSelectTournament={(id) => {
          setShowTournamentsModal(false);
          setShowStructureModal(false);
        }}
        onStartNewTournament={(newId) => {
          setShowTournamentsModal(false);
          setShowStructureModal(true);
        }}
      />
    </div>
  );
}
