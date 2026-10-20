import React, { useState } from 'react';
import { X, CalendarPlus, Clock } from 'lucide-react';

export default function DirectorPreplanDialog({
  isOpen,
  onClose,
  currentSchedule = [],
  levelDurationMinutes = 15,
  onSaveLevel,
}) {
  if (!isOpen) return null;

  const lastLevel = currentSchedule[currentSchedule.length - 1] || { smallBlind: 1000, bigBlind: 2000, ante: 0 };
  const nextLvlNum = currentSchedule.length + 1;

  // Suggest 1.5x - 2x next blinds
  const suggestedSB = Math.round((lastLevel.smallBlind * 1.5) / 100) * 100 || 1500;
  const suggestedBB = suggestedSB * 2;
  const suggestedAnte = suggestedBB;

  const [smallBlind, setSmallBlind] = useState(suggestedSB);
  const [bigBlind, setBigBlind] = useState(suggestedBB);
  const [ante, setAnte] = useState(suggestedAnte);
  const [durationMinutes, setDurationMinutes] = useState(levelDurationMinutes || 15);
  const [isBreak, setIsBreak] = useState(false);

  const handleSubmit = (e) => {
    e?.preventDefault();
    onSaveLevel({
      level: nextLvlNum,
      smallBlind: isBreak ? 0 : Number(smallBlind) || 0,
      bigBlind: isBreak ? 0 : Number(bigBlind) || 0,
      ante: isBreak ? 0 : Number(ante) || 0,
      durationMinutes: Number(durationMinutes) || 15,
      isBreak,
      name: isBreak ? 'Break' : `Level ${nextLvlNum}`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CalendarPlus size={20} className="text-emerald-400" />
            <h2 className="text-base font-bold text-white">Pre-Plan Next Level ({nextLvlNum})</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-semibold text-white">Is this a Tournament Break?</span>
            <input
              type="checkbox"
              checked={isBreak}
              onChange={(e) => setIsBreak(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
          </div>

          {!isBreak ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Small Blind
                </label>
                <input
                  type="number"
                  step="50"
                  value={smallBlind}
                  onChange={(e) => setSmallBlind(e.target.value)}
                  className="w-full bg-[#181d26] border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Big Blind
                </label>
                <input
                  type="number"
                  step="50"
                  value={bigBlind}
                  onChange={(e) => setBigBlind(e.target.value)}
                  className="w-full bg-[#181d26] border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Ante
                </label>
                <input
                  type="number"
                  step="50"
                  value={ante}
                  onChange={(e) => setAnte(e.target.value)}
                  className="w-full bg-[#181d26] border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-200">
              This will add a scheduled break interval. Blinds will pause during the break.
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Duration (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full bg-[#181d26] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg cursor-pointer"
            >
              Add Level
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
