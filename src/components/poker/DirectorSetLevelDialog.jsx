import React from 'react';
import { X, Layers, Check, Coffee } from 'lucide-react';
import { isBreakLevel, getLevelNumber, parseChipValue } from '@/components/poker/TournamentClockView';

export default function DirectorSetLevelDialog({
  isOpen,
  onClose,
  currentLevel = 0,
  schedule = [],
  onSelectLevel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-emerald-400" />
            <h2 className="text-base font-bold text-white">Set Tournament Level</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          {schedule.map((lvl, idx) => {
            const isCurrent = idx === currentLevel;
            const isBrk = isBreakLevel(lvl);
            const levelNum = getLevelNumber(schedule, idx);
            const sbVal = parseChipValue(lvl.smallBlind);
            const bbVal = parseChipValue(lvl.bigBlind);
            const anteVal = parseChipValue(lvl.ante);
            const breakDur = parseChipValue(lvl.durationMinutes || lvl.minutes) || 10;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectLevel(idx);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    {isBrk ? (
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <Coffee size={14} /> Break
                      </span>
                    ) : (
                      `Level ${levelNum}`
                    )}
                    {isCurrent && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                    {isBrk
                      ? `${breakDur} minutes`
                      : `${sbVal.toLocaleString()} / ${bbVal.toLocaleString()}${
                          anteVal > 0 ? ` (Ante ${anteVal.toLocaleString()})` : ''
                        }`}
                  </div>
                </div>
                {isCurrent && <Check size={18} className="text-emerald-400" />}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
