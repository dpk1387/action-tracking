import { Delete } from 'lucide-react';

const TOP_ROW = ['0', '1', '2', '3', '4', '5', '6', '7'];
const BOTTOM_ROW = ['8', '9', '.', 'K'];

/**
 * Eight-column numbers pad for bet/raise entry on touch screens.
 * Row 1 holds 0-7, row 2 holds 8, 9, the decimal point, the K shortcut and
 * delete. Parents own the value, so each screen keeps its own rules for K
 * and the decimal point.
 */
export default function BetKeypadGrid({ onKey, disabled = false }) {
  const keyClass = 'py-2 rounded-xl bg-[#1f2632] active:bg-[#2c3647] text-white font-black text-base shadow border border-slate-700/80 transition-transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="grid grid-cols-8 gap-1">
      {TOP_ROW.map((key) => (
        <button key={key} type="button" disabled={disabled} onClick={() => onKey(key)} className={keyClass}>
          {key}
        </button>
      ))}
      {BOTTOM_ROW.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onKey(key)}
          className={key === 'K'
            ? 'py-2 rounded-xl bg-emerald-950/70 active:bg-emerald-900 text-emerald-300 font-black text-base shadow border border-emerald-700/60 transition-transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed'
            : keyClass}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        aria-label="Delete last digit"
        onClick={() => onKey('⌫')}
        className="col-span-3 py-2 rounded-xl bg-rose-950/60 active:bg-rose-900 text-rose-300 font-black text-base shadow border border-rose-800/60 flex items-center justify-center transition-transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Delete size={16} />
      </button>
    </div>
  );
}
