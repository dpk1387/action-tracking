import React from 'react';
import { LOWEST_DENOMINATIONS, defaultDenomsFor } from '@/lib/tournamentStructures';

export default function ChipDenominationPicker({ selected = [], onChange }) {
  const currentLowest = (() => {
    const valid = (selected || []).map(Number).filter((d) => d > 0);
    return valid.length > 0 ? Math.min(...valid) : 25;
  })();

  const handleSelectLowest = (lowest) => {
    const denoms = defaultDenomsFor(lowest);
    onChange(denoms);
  };

  const fmt = (d) => {
    if (d >= 1000) return d.toLocaleString();
    if (Number.isInteger(d)) return String(d);
    return d.toFixed(2);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Lowest Chip Denomination
        </label>
        <span className="text-[11px] text-slate-400">
          Sets default schedule & chip denominations
        </span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {LOWEST_DENOMINATIONS.map((d) => {
          const isSelected = currentLowest === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => handleSelectLowest(d)}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-105'
                  : 'bg-[#151922] border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-sm">{fmt(d)}</span>
              <span className="text-[9px] uppercase tracking-wider opacity-75 font-normal">chip</span>
            </button>
          );
        })}
      </div>

      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Chips in play:</span>
        <span className="font-mono text-emerald-300 font-bold">
          {defaultDenomsFor(currentLowest).map(fmt).join(' · ')}
        </span>
      </div>
    </div>
  );
}
