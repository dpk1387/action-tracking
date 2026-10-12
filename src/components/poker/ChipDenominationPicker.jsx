import React from 'react';
import { ALL_DENOMINATIONS } from '@/lib/tournamentStructures';

export default function ChipDenominationPicker({ selected, onChange }) {
  const selectedSet = new Set((selected || []).map((d) => Number(d)));

  const toggle = (denom) => {
    const next = new Set(selectedSet);
    if (next.has(denom)) next.delete(denom);
    else next.add(denom);
    onChange([...next].sort((a, b) => a - b));
  };

  const fmt = (d) => {
    if (d >= 1000) return d.toLocaleString();
    if (Number.isInteger(d)) return String(d);
    return d.toFixed(2);
  };

  return (
    <div>
      <div className="text-xs text-slate-400 mb-2">Chip denominations in play – check all that apply</div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {ALL_DENOMINATIONS.map((d) => (
          <label
            key={d}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-2 cursor-pointer select-none transition-colors ${
              selectedSet.has(d)
                ? 'bg-[#4a5a4a] border-[#5a6a5a] text-white'
                : 'bg-[#1e2227] border-[#2a2f37] text-slate-300 hover:border-[#3a4a3a]'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedSet.has(d)}
              onChange={() => toggle(d)}
              className="w-3.5 h-3.5 accent-[#4a5a4a] sr-only"
            />
            <span className="text-sm font-medium">{fmt(d)}</span>
          </label>
        ))}
      </div>
      {selectedSet.size > 0 && (
        <div className="text-[11px] text-slate-500 mt-1.5">
          Lowest denomination: {fmt(Math.min(...selectedSet))} – sets the default blind schedule.
        </div>
      )}
    </div>
  );
}
