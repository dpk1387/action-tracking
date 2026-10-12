import React, { useState, useMemo } from 'react';
import { X, Dice5 } from 'lucide-react';
import { money } from '@/lib/poker';

export default function LateEntryDialog({ tableSize, players, startingStack, currency, currentLevel, lateRegLevel, onAdd, onClose }) {
  const [name, setName] = useState('');
  const [stack, setStack] = useState('');
  const [seat, setSeat] = useState('');
  const sym = currency || '';
  const occupiedSeats = useMemo(() => new Set(players.map((p) => p.seat)), [players]);
  const emptySeats = useMemo(
    () => Array.from({ length: tableSize }, (_, i) => i + 1).filter((s) => !occupiedSeats.has(s)),
    [tableSize, occupiedSeats]
  );
  const canLateReg = !lateRegLevel || (currentLevel || 0) + 1 <= Number(lateRegLevel);

  const randomSeat = () => {
    if (!emptySeats.length) return;
    const pick = emptySeats[Math.floor(Math.random() * emptySeats.length)];
    setSeat(String(pick));
  };

  const add = () => {
    let s = Number(stack);
    if (!s || s <= 0) s = startingStack || 100;
    let chosenSeat = seat ? Number(seat) : null;
    if (!chosenSeat && emptySeats.length) {
      chosenSeat = emptySeats[Math.floor(Math.random() * emptySeats.length)];
    }
    if (!chosenSeat) return;
    onAdd((name || '').trim() || `Player ${chosenSeat}`, s, chosenSeat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Late registration</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        {!canLateReg ? (
          <div className="text-sm text-rose-400 mb-4">
            Late registration has closed (level {lateRegLevel} has passed).
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-400 mb-3">
              Player joins on the next hand. {emptySeats.length} empty seat{emptySeats.length !== 1 ? 's' : ''} available.
            </div>
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (blank = Player N)"
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Stack</span>
                {sym && <span className="text-xs text-slate-400">{sym}</span>}
                <input
                  type="number"
                  value={stack}
                  onChange={(e) => setStack(e.target.value)}
                  placeholder={String(startingStack || '100')}
                  className="flex-1 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">Seat (blank = random)</label>
                  <button
                    onClick={randomSeat}
                    disabled={!emptySeats.length}
                    className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
                  >
                    <Dice5 size={13} /> Random
                  </button>
                </div>
                <select
                  value={seat}
                  onChange={(e) => setSeat(e.target.value)}
                  className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                >
                  <option value="">– Random –</option>
                  {emptySeats.map((s) => (
                    <option key={s} value={String(s)}>Seat {s}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={add}
              disabled={!emptySeats.length}
              className="w-full mt-5 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {emptySeats.length ? 'Add player' : 'No empty seats'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
