import React, { useState, useMemo } from 'react';
import { X, Dice5, UserPlus } from 'lucide-react';
import { money } from '@/lib/poker';

export default function LateEntryDialog({
  tableSize,
  players = [],
  startingStack,
  currency,
  currentLevel,
  lateRegLevel,
  seatingMode = 'seats',
  isCash = false,
  onAdd,
  onClose,
}) {
  const [name, setName] = useState('');
  const [stack, setStack] = useState('');
  const [seatingChoice, setSeatingChoice] = useState(seatingMode === 'players' ? 'left_of' : 'seat_num');
  const [sitsLeftOfPlayerId, setSitsLeftOfPlayerId] = useState(players[0]?.id || '');
  const [seat, setSeat] = useState('');

  const sym = currency || '';
  const occupiedSeats = useMemo(() => new Set(players.map((p) => p.seat)), [players]);
  const emptySeats = useMemo(
    () => Array.from({ length: Math.max(tableSize || 9, players.length + 1) }, (_, i) => i + 1).filter((s) => !occupiedSeats.has(s)),
    [tableSize, players.length, occupiedSeats]
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

    if (seatingChoice === 'left_of' && sitsLeftOfPlayerId) {
      onAdd((name || '').trim() || `Player ${players.length + 1}`, s, null, sitsLeftOfPlayerId);
      return;
    }

    let chosenSeat = seat ? Number(seat) : null;
    if (!chosenSeat && emptySeats.length) {
      chosenSeat = emptySeats[Math.floor(Math.random() * emptySeats.length)];
    }
    if (!chosenSeat) {
      // Fallback: pick last seat + 1
      chosenSeat = players.length + 1;
    }
    onAdd((name || '').trim() || `Player ${chosenSeat}`, s, chosenSeat, null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">{isCash ? 'Add Player' : 'Late Registration'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
        </div>

        {!isCash && !canLateReg ? (
          <div className="text-sm text-rose-400 mb-4">
            Late registration has closed (level {lateRegLevel} has passed).
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-400 mb-3">
              Player joins on the next hand. Currently {players.length} active players.
            </div>
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Player ${players.length + 1}`}
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

              {/* Seating Position Choice */}
              <div className="pt-1">
                <div className="text-xs text-slate-400 mb-2 font-medium">Table Seating Position</div>
                <div className="flex rounded-lg border border-[#2a2f37] p-0.5 bg-[#15181d] mb-2.5">
                  <button
                    type="button"
                    onClick={() => setSeatingChoice('left_of')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      seatingChoice === 'left_of' ? 'bg-[#3b473b] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sit Left of Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatingChoice('seat_num')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      seatingChoice === 'seat_num' ? 'bg-[#3b473b] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Specific Seat #
                  </button>
                </div>

                {seatingChoice === 'left_of' ? (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Sits to the left of (clockwise):</label>
                    <select
                      value={sitsLeftOfPlayerId}
                      onChange={(e) => setSitsLeftOfPlayerId(e.target.value)}
                      className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                    >
                      {players.map((p) => (
                        <option key={p.id || p.seat} value={p.id || p.seat}>
                          {p.name || `Player ${p.seat}`} (Seat {p.seat})
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-slate-500 mt-1">
                      New player will be inserted directly after this player in the seating order.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400">Select Seat Number</label>
                      <button
                        type="button"
                        onClick={randomSeat}
                        disabled={!emptySeats.length}
                        className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-40 cursor-pointer"
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
                )}
              </div>
            </div>

            <button
              onClick={add}
              className="w-full mt-5 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 font-semibold cursor-pointer transition-colors shadow-md"
            >
              Add Player to Game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
