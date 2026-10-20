import React from 'react';
import {
  Play,
  Pause,
  FastForward,
  Rewind,
  Layers,
  AlertTriangle,
  UserMinus,
  UserPlus,
  Plus,
  Minus,
  CalendarPlus,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { getLevelNumber } from '@/components/poker/TournamentClockView';

export default function DirectorControlDock({
  directorState,
  onToggleTimer,
  onAdjustMinutes,
  onNextLevel,
  onOpenSetLevel,
  onOpenPreplanLevel,
  onToggleHandForHand,
  onOpenRecordBust,
  onOpenLateReg,
  onOpenReEntry,
  onOpenRebuy,
  onAdjustPlayerCount,
  onOpenStructureSetup,
}) {
  const clock = directorState?.clock || {};
  const isRunning = clock.isRunning;
  const isHandForHand = !!directorState?.isHandForHand;
  const tournamentType = directorState?.tournamentType || 'reentry';
  const lateRegEnabled = !!directorState?.lateRegEnabled;
  const currentLevelIdx = clock.level || 0;
  const schedule = clock.blindSchedule || [];
  const hasSchedule = Array.isArray(schedule) && schedule.length > 0;
  const isLastLevelReached = hasSchedule && currentLevelIdx >= schedule.length - 1;
  const remainingPlayers = directorState?.remainingPlayers ?? directorState?.totalPlayers ?? 2;

  // Late reg is open only if enabled and current level number <= cutoff level
  const currentLevelNum = getLevelNumber(schedule, currentLevelIdx);
  const isLateRegOpen = lateRegEnabled && currentLevelNum <= (directorState?.lateRegLevel || 4);

  return (
    <div className="w-full bg-[#131720] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl mt-6 space-y-4">
      {/* Top Header of Control Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Tournament Control Menu
          </span>
        </div>

        {/* Small button to enable/disable hand for hand & Structure Setup */}
        <div className="flex items-center gap-2">
          {/* Small button to enable/disable hand for hand */}
          <button
            type="button"
            onClick={onToggleHandForHand}
            title="Toggle Hand for Hand play"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isHandForHand
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <AlertTriangle size={13} className={isHandForHand ? 'animate-bounce' : ''} />
            Hand for Hand {isHandForHand ? 'ON' : 'OFF'}
          </button>

          {/* Structure Setup Button */}
          <button
            type="button"
            onClick={onOpenStructureSetup}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders size={13} className="text-emerald-400" />
            Structure Setup
          </button>
        </div>
      </div>

      {/* Control Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Pause / Resume Timer */}
        <button
          type="button"
          onClick={onToggleTimer}
          className={`py-3 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer ${
            isRunning
              ? 'bg-amber-950/40 border-amber-800/50 hover:bg-amber-900/50 text-amber-200'
              : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white shadow-lg'
          }`}
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
          <span>{isRunning ? 'Pause Timer' : 'Resume Timer'}</span>
        </button>

        {/* 2. Rewind / Forward 1 Min (Rewind adds 1 min, Forward subtracts 1 min) */}
        <div className="flex rounded-xl bg-slate-800/50 border border-slate-700/60 p-1 gap-1">
          <button
            type="button"
            onClick={() => onAdjustMinutes(1)} // Rewind adds 1 min (+60s)
            title="Rewind 1 min (adds 1 min to clock)"
            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer"
          >
            <Rewind size={14} />
            <span>Rewind 1m</span>
          </button>
          <button
            type="button"
            onClick={() => onAdjustMinutes(-1)} // Forward subtracts 1 min (-60s)
            title="Forward 1 min (subtracts 1 min from clock)"
            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer"
          >
            <FastForward size={14} />
            <span>Forward 1m</span>
          </button>
        </div>

        {/* 3. Level Jump: Set Level & [Next Level OR Pre-Plan Level when last level reached] */}
        <div className="flex rounded-xl bg-slate-800/50 border border-slate-700/60 p-1 gap-1">
          <button
            type="button"
            onClick={onOpenSetLevel}
            title="Jump directly to any level"
            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer"
          >
            <Layers size={14} className="text-cyan-400" />
            <span>Set Level</span>
          </button>

          {isLastLevelReached ? (
            /* When last planned level is reached, pre-plan replaces next level! */
            <button
              type="button"
              onClick={onOpenPreplanLevel}
              title="Last planned level reached - plan upcoming level"
              className="flex-1 py-1.5 rounded-lg bg-purple-950/70 border border-purple-700/70 hover:bg-purple-900/70 text-purple-200 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer"
            >
              <CalendarPlus size={14} className="text-purple-300" />
              <span>Pre-Plan Lvl</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNextLevel}
              title="Advance immediately to next level"
              className="flex-1 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/60 text-emerald-300 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer"
            >
              <FastForward size={14} />
              <span>Next Level</span>
            </button>
          )}
        </div>

        {/* 4. Late Reg Button (Disabled if late reg is closed!) */}
        <button
          type="button"
          disabled={!isLateRegOpen}
          onClick={isLateRegOpen ? onOpenLateReg : undefined}
          title={isLateRegOpen ? 'Register late player' : 'Late registration is closed'}
          className={`py-3 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border transition-all ${
            isLateRegOpen
              ? 'bg-emerald-950/40 border-emerald-700/50 hover:bg-emerald-900/50 text-emerald-200 cursor-pointer'
              : 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-30 cursor-not-allowed pointer-events-none'
          }`}
        >
          <UserPlus size={18} className={isLateRegOpen ? 'text-emerald-400' : 'text-slate-600'} />
          <div className="text-center">
            <span>Late Reg</span>
            <span className="block text-[10px] font-normal text-slate-400">
              {isLateRegOpen ? 'Open' : 'Closed'}
            </span>
          </div>
        </button>

        {/* 5. Re-Entry / Re-Buy Button */}
        {tournamentType === 'rebuy' ? (
          <button
            type="button"
            onClick={onOpenRebuy}
            className="py-3 px-3 rounded-xl font-bold text-xs bg-purple-950/40 border border-purple-800/50 hover:bg-purple-900/50 text-purple-200 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <RefreshCw size={17} className="text-purple-400" />
            <span>Rebuy</span>
          </button>
        ) : tournamentType === 'freezeout' || tournamentType === 'shootout' ? (
          <button
            type="button"
            disabled
            title="Freezeout: Re-entry is not permitted"
            className="py-3 px-3 rounded-xl font-bold text-xs bg-slate-900/30 border border-slate-800/40 text-slate-500 flex flex-col items-center justify-center gap-1 cursor-not-allowed opacity-40 select-none pointer-events-none"
          >
            <RefreshCw size={17} className="text-slate-600" />
            <span>No Re-Entry</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenReEntry}
            className="py-3 px-3 rounded-xl font-bold text-xs bg-blue-950/40 border border-blue-800/50 hover:bg-blue-900/50 text-blue-200 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <RefreshCw size={17} className="text-blue-400" />
            <span>Re-Entry</span>
          </button>
        )}

        {/* 6. Record Bust & Manual Stepper */}
        <div className="flex gap-2">
          {/* Record Bust */}
          <button
            type="button"
            onClick={onOpenRecordBust}
            className="flex-1 py-3 px-2 rounded-xl font-bold text-xs bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/50 text-rose-200 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <UserMinus size={17} className="text-rose-400" />
            <span>Record Bust</span>
          </button>

          {/* Field Stepper: Disabled - button when remaining <= 2 so it's not accidentally pressed! */}
          <div className="flex flex-col bg-slate-800/50 border border-slate-700/60 rounded-xl p-1 justify-between w-20">
            <span className="text-[9px] text-center font-bold text-slate-400 uppercase">Field</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={remainingPlayers <= 2}
                onClick={() => onAdjustPlayerCount(-1)}
                title={
                  remainingPlayers <= 2
                    ? '2 players left (heads-up). Record bust to end tournament.'
                    : 'Manually decrease field count (-1)'
                }
                className={`flex-1 py-1.5 rounded bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 flex items-center justify-center font-bold text-xs transition-colors ${
                  remainingPlayers <= 2 ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                }`}
              >
                <Minus size={12} />
              </button>
              <button
                type="button"
                onClick={() => onAdjustPlayerCount(1)}
                title="Manually increase field count (+1)"
                className="flex-1 py-1.5 rounded bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
