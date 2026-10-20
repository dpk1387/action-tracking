import React, { useState } from 'react';
import { X, RefreshCw, Trophy, DollarSign } from 'lucide-react';

export default function DirectorReEntryDialog({
  isOpen,
  onClose,
  directorState,
  onConfirmReEntry,
}) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const buyIn = directorState?.buyIn || 100;
  const currency = directorState?.currency || '$';
  const startingStack = directorState?.startingStack || 10000;
  const maxReEntries = directorState?.maxReEntries || 0;
  const eliminatedPlayers = directorState?.eliminations || [];
  const isFreezeout = directorState?.tournamentType === 'freezeout' || directorState?.tournamentType === 'shootout';

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isFreezeout) return;
    onConfirmReEntry({ name: name.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <RefreshCw size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Player Re-Entry</h2>
              <div className="text-xs text-slate-400">
                {maxReEntries > 0 ? `Max ${maxReEntries} re-entries per player` : 'Unlimited re-entries'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isFreezeout && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs font-medium">
              This tournament is configured as a Freezeout. Re-entries and rebuys are not permitted.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Player Name
            </label>
            <input
              type="text"
              disabled={isFreezeout}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter player name"
              className="w-full bg-[#181d26] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
              autoFocus={!isFreezeout}
            />

            {/* Quick-pick from recent eliminated players */}
            {!isFreezeout && eliminatedPlayers.length > 0 && (
              <div className="mt-2">
                <span className="text-[11px] text-slate-400">Pick recently eliminated player:</span>
                <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
                  {eliminatedPlayers.slice(0, 6).map((el, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setName(el.name)}
                      className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      {el.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cost:</span>
              <span className="text-emerald-400 font-bold font-mono">
                {currency}{buyIn.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Stack Given:</span>
              <span className="text-white font-bold font-mono">
                {startingStack.toLocaleString()} chips
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
              disabled={isFreezeout}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-lg cursor-pointer"
            >
              Confirm Re-Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
