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
} from 'lucide-react';
import { useMTT, mttStore } from '@/lib/mttStore';
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

export default function MTTDirector() {
  const mtt = useMTT();
  const navigate = useNavigate();

  // Modals state - always show setup screen on enter as requested
  const [showStructureModal, setShowStructureModal] = useState(true);
  const [showBustModal, setShowBustModal] = useState(false);
  const [showSetLevelModal, setShowSetLevelModal] = useState(false);
  const [showPreplanModal, setShowPreplanModal] = useState(false);
  const [showLateRegModal, setShowLateRegModal] = useState(false);
  const [showReEntryModal, setShowReEntryModal] = useState(false);
  const [showRebuyModal, setShowRebuyModal] = useState(false);
  const [showEndTournamentModal, setShowEndTournamentModal] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);

  const remainingPlayers = mtt.remainingPlayers ?? mtt.totalPlayers ?? 0;

  // Automatically trigger tournament end dialog when 1 player remains
  useEffect(() => {
    if (mtt.active && remainingPlayers === 1) {
      setShowEndTournamentModal(true);
    }
  }, [mtt.active, remainingPlayers]);

  // Tournament Clock Interval
  useEffect(() => {
    if (!mtt.clock?.isRunning) return;

    const interval = setInterval(() => {
      const cur = mttStore.get().clock;
      if (!cur?.isRunning) return;

      if (cur.secondsLeft > 1) {
        mttStore.updateClock({ secondsLeft: cur.secondsLeft - 1 });
      } else {
        // Advance to next level automatically
        mttStore.nextLevel();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mtt.clock?.isRunning]);

  const handleSaveStructure = (data) => {
    if (!mtt.active) {
      mttStore.createDirectorTournament(data);
    } else {
      mttStore.updateStructure(data);
    }
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
        />
      </main>

      {/* Modals */}
      <DirectorStructureDialog
        isOpen={showStructureModal}
        initialData={mtt}
        onSave={handleSaveStructure}
        onClose={() => setShowStructureModal(false)}
      />

      <DirectorBustDialog
        isOpen={showBustModal}
        remainingPlayers={mtt.remainingPlayers ?? mtt.totalPlayers}
        payouts={mtt.payouts || []}
        splitSimultaneousTies={mtt.splitSimultaneousTies}
        onConfirmBust={(bustData) => mttStore.recordBust(bustData)}
        onClose={() => setShowBustModal(false)}
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
        onContinueHome={() => {
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
                onClick={() => {
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
    </div>
  );
}
