import { Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'K'];

/**
 * Bottom-sheet numeric keypad for bet/raise entry on touch screens.
 * "K" appends three zeros so 2 -> 2K becomes 2000 and the value stays numeric.
 */
export default function BetKeypad({ value = '', onChange, onDone, label = 'Bet amount' }) {
  const press = (key) => {
    const next = String(value ?? '');
    if (key === 'K') {
      if (next === '') return onChange('1000');
      if (next.includes('.')) return onChange(next);
      return onChange(`${next}000`);
    }
    if (key === '.') {
      if (next.includes('.')) return onChange(next);
      return onChange(next === '' ? '0.' : `${next}.`);
    }
    onChange(`${next}${key}`);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden bg-[#0f1319] border-t border-slate-700 shadow-2xl p-3 pb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{label}</div>
        <div className="text-lg font-mono font-black text-amber-300">{value || '0'}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="py-3 rounded-xl bg-[#1b2230] active:bg-[#2a3446] border border-slate-700 text-white font-bold text-lg cursor-pointer"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          type="button"
          onClick={() => onChange(String(value ?? '').slice(0, -1))}
          className="py-3 rounded-xl bg-[#1b2230] active:bg-[#2a3446] border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Delete size={16} /> Back
        </button>
        <button
          type="button"
          onClick={onDone}
          className="py-3 rounded-xl bg-emerald-600 active:bg-emerald-500 text-white font-bold cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}
