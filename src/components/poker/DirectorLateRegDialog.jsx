import React, { useState } from 'react';
import { X, UserPlus, DollarSign, AlertCircle } from 'lucide-react';
import { getLevelNumber } from '@/components/poker/TournamentClockView';

export default function DirectorLateRegDialog({
  isOpen,
  onClose,
  directorState,
  onConfirmLateReg,
}) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const buyIn = directorState?.buyIn || 100;
  const currency = directorState?.currency || '$';
  const startingStack = directorState?.startingStack || 10000;
  const nextPlayerNum = (directorState?.totalPlayers || 0) + 1;
  const sched = directorState?.clock?.blindSchedule || [];
  const currentLevelIdx = directorState?.clock?.level || 0;
  const currentLevel = getLevelNumber(sched, currentLevelIdx);
  const cutoff = directorState?.lateRegLevel || 4;
  const isLateRegOpen = !!directorState?.lateRegEnabled && currentLevel <= cutoff;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!isLateRegOpen) return;
    onConfirmLateReg({ name: name.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Late Registration</h2>
              <div className="text-xs text-slate-400">Register new player into tournament</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {!isLateRegOpen ? (
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="text-sm font-bold text-white">Late Registration is Closed</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Late registration closed after Level {directorState?.lateRegLevel || 4}. Current level is Level {currentLevel}.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Player Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Leave blank for filler (Player ${nextPlayerNum})`}
                className="w-full bg-[#181d26] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <div className="text-[11px] text-slate-500 mt-1">
                If left blank, will automatically be registered as "Player {nextPlayerNum}".
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Buy-In Amount:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {currency}{buyIn.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Starting Chips:</span>
                <span className="text-white font-bold font-mono">
                  {startingStack.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg cursor-pointer"
              >
                Confirm Late Reg
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
