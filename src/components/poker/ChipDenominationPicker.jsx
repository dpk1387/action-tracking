import React from 'react';
import { LOWEST_DENOMINATIONS, defaultDenomsFor } from '@/lib/tournamentStructures';

const STANDARD_PRESETS = [25, 100];

const CHIP_COLOR_STYLES = {
  1: {
    dot: 'bg-white border-slate-300',
    active: 'bg-slate-100 border-white text-slate-950 shadow-[0_0_12px_rgba(255,255,255,0.4)]',
    inactive: 'bg-slate-100/10 border-slate-300/45 text-slate-100 hover:bg-slate-100/20 hover:border-white/70',
    subActive: 'text-slate-600',
    badgeActive: 'bg-slate-900/15 text-slate-900 border border-slate-900/20',
    badgeInactive: 'bg-white/15 text-slate-200 border border-white/25',
  },
  5: {
    dot: 'bg-red-500 border-red-200',
    active: 'bg-red-600 border-red-300 text-white shadow-[0_0_12px_rgba(220,38,38,0.45)]',
    inactive: 'bg-red-950/45 border-red-500/45 text-red-200 hover:bg-red-900/55 hover:border-red-400/75',
    subActive: 'text-red-100',
    badgeActive: 'bg-black/25 text-white border border-white/30',
    badgeInactive: 'bg-red-500/20 text-red-200 border border-red-500/35',
  },
  25: {
    dot: 'bg-emerald-500 border-emerald-200',
    active: 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_14px_rgba(16,185,129,0.45)]',
    inactive: 'bg-emerald-950/40 border-emerald-500/45 text-emerald-200 hover:bg-emerald-900/50 hover:border-emerald-400/75',
    subActive: 'text-emerald-100',
    badgeActive: 'bg-black/25 text-white border border-white/30',
    badgeInactive: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  },
  100: {
    dot: 'bg-zinc-900 border-zinc-400',
    active: 'bg-zinc-950 border-zinc-300 text-white ring-1 ring-white/40 shadow-[0_0_14px_rgba(255,255,255,0.2)]',
    inactive: 'bg-zinc-900/85 border-zinc-600 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400',
    subActive: 'text-zinc-300',
    badgeActive: 'bg-white/15 text-white border border-white/30',
    badgeInactive: 'bg-zinc-800 text-zinc-300 border border-zinc-600',
  },
  500: {
    dot: 'bg-purple-500 border-purple-200',
    active: 'bg-purple-600 border-purple-300 text-white shadow-[0_0_12px_rgba(147,51,234,0.45)]',
    inactive: 'bg-purple-950/45 border-purple-500/45 text-purple-200 hover:bg-purple-900/55 hover:border-purple-400/75',
    subActive: 'text-purple-100',
    badgeActive: 'bg-black/25 text-white border border-white/30',
    badgeInactive: 'bg-purple-500/20 text-purple-200 border border-purple-500/35',
  },
};

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

  const standardDenoms = LOWEST_DENOMINATIONS.filter((d) => STANDARD_PRESETS.includes(d));
  const otherDenoms = LOWEST_DENOMINATIONS.filter((d) => !STANDARD_PRESETS.includes(d));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Base Chip
        </label>
        <span className="text-[11px] text-slate-400">
          Sets default schedule & chip denominations
        </span>
      </div>

      {/* Standout Standard Presets: 25 (Green) & 100 (Black) */}
      <div className="grid grid-cols-2 gap-2.5">
        {standardDenoms.map((d) => {
          const isSelected = currentLowest === d;
          const style = CHIP_COLOR_STYLES[d] || CHIP_COLOR_STYLES[25];
          return (
            <button
              key={d}
              type="button"
              onClick={() => handleSelectLowest(d)}
              className={`py-3 px-3 rounded-xl font-bold transition-all border flex items-center justify-between cursor-pointer ${
                isSelected ? style.active : style.inactive
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full border-2 border-dashed shrink-0 ${style.dot}`} />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-extrabold">{fmt(d)}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-medium ${isSelected ? style.subActive : 'opacity-75'}`}>
                    base
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isSelected ? style.badgeActive : style.badgeInactive
                }`}
              >
                Standard
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary Base Chips: 1 (White), 5 (Red), 500 (Purple) */}
      <div className="grid grid-cols-3 gap-2">
        {otherDenoms.map((d) => {
          const isSelected = currentLowest === d;
          const style = CHIP_COLOR_STYLES[d] || CHIP_COLOR_STYLES[25];
          return (
            <button
              key={d}
              type="button"
              onClick={() => handleSelectLowest(d)}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                isSelected ? style.active : style.inactive
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full border border-dashed shrink-0 ${style.dot}`} />
              <span>{fmt(d)}</span>
              <span className={`text-[10px] font-normal ${isSelected ? style.subActive : 'opacity-75'}`}>base</span>
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
