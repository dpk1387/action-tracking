import React, { useState } from 'react';
import { X, RefreshCw, CheckSquare, Square, AlertCircle, DollarSign } from 'lucide-react';

export default function DirectorRebuyDialog({
  isOpen,
  onClose,
  directorState,
  onConfirmRebuy,
}) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const buyIn = directorState?.buyIn || 100;
  const currency = directorState?.currency || '$';
  const startingStack = directorState?.startingStack || 10000;
  const rebuyCost = directorState?.rebuyCost ?? buyIn;
  const rebuyChips = directorState?.rebuyChips ?? startingStack;
  const currentLevel = (directorState?.clock?.level || 0) + 1;
  const rebuyRules = directorState?.rebuyRules || {};

  // Interactive Checklist states for TD to verify
  const [timeCapVerified, setTimeCapVerified] = useState(
    !rebuyRules.timeCapEnabled || currentLevel <= (rebuyRules.timeCapLevel || 4)
  );
  const [maxRebuysVerified, setMaxRebuysVerified] = useState(true);
  const [stackCapVerified, setStackCapVerified] = useState(true);

  const canConfirm =
    (!rebuyRules.timeCapEnabled || timeCapVerified) &&
    (!rebuyRules.maxRebuysEnabled || maxRebuysVerified) &&
    (!rebuyRules.stackCapEnabled || stackCapVerified);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!canConfirm) return;
    onConfirmRebuy({
      name: name.trim(),
      cost: rebuyCost,
      chips: rebuyChips,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <RefreshCw size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Player Rebuy</h2>
              <div className="text-xs text-slate-400">Add rebuy chips to active player</div>
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
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Player Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Player 3 or leave blank"
              className="w-full bg-[#181d26] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
              autoFocus
            />
          </div>

          {/* Rebuy Eligibility TD Checklist */}
          {(rebuyRules.timeCapEnabled || rebuyRules.maxRebuysEnabled || rebuyRules.stackCapEnabled) && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
              <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                TD Rebuy Eligibility Checklist
              </div>

              {rebuyRules.timeCapEnabled && (
                <button
                  type="button"
                  onClick={() => setTimeCapVerified(!timeCapVerified)}
                  className="flex items-start gap-2.5 w-full text-left cursor-pointer"
                >
                  {timeCapVerified ? (
                    <CheckSquare size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square size={16} className="text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="text-slate-200 font-medium">Time Cap Rule:</span>
                    <span className="text-slate-400 block text-[11px]">
                      Current Level {currentLevel} ≤ Cutoff Level {rebuyRules.timeCapLevel || 4}
                      {currentLevel > (rebuyRules.timeCapLevel || 4) && (
                        <span className="text-rose-400 font-bold block"> (Level expired)</span>
                      )}
                    </span>
                  </div>
                </button>
              )}

              {rebuyRules.maxRebuysEnabled && (
                <button
                  type="button"
                  onClick={() => setMaxRebuysVerified(!maxRebuysVerified)}
                  className="flex items-start gap-2.5 w-full text-left cursor-pointer"
                >
                  {maxRebuysVerified ? (
                    <CheckSquare size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square size={16} className="text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="text-slate-200 font-medium">Max Rebuys Limit:</span>
                    <span className="text-slate-400 block text-[11px]">
                      Player is within the {rebuyRules.maxRebuys || 'unlimited'} rebuy limit
                    </span>
                  </div>
                </button>
              )}

              {rebuyRules.stackCapEnabled && (
                <button
                  type="button"
                  onClick={() => setStackCapVerified(!stackCapVerified)}
                  className="flex items-start gap-2.5 w-full text-left cursor-pointer"
                >
                  {stackCapVerified ? (
                    <CheckSquare size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square size={16} className="text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="text-slate-200 font-medium">Stack Size Cap:</span>
                    <span className="text-slate-400 block text-[11px]">
                      Player stack is ≤ baseline ({rebuyRules.stackCapValue} {rebuyRules.stackCapUnit || 'chips'})
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Pricing Overview */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Rebuy Cost:</span>
              <span className="text-emerald-400 font-bold font-mono">
                {currency}{rebuyCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Chips Received:</span>
              <span className="text-white font-bold font-mono">
                +{rebuyChips.toLocaleString()} chips
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
              disabled={!canConfirm}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-bold text-white shadow-lg cursor-pointer"
            >
              Confirm Rebuy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
