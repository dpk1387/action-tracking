import React, { useState, useMemo } from 'react';
import { X, Dice5 } from 'lucide-react';
import { money } from '@/lib/poker';

export default function ReentryDialog({ eliminatedPlayers, maxReEntries, tableSize, players, startingStack, currency, onReentry, onClose }) {
  const [selectedName, setSelectedName] = useState('');
  const [seat, setSeat] = useState('');
  const sym = currency || '';
  const occupiedSeats = useMemo(() => new Set(players.map((p) => p.seat)), [players]);
  const emptySeats = useMemo(
    () => Array.from({ length: tableSize }, (_, i) => i + 1).filter((s) => !occupiedSeats.has(s)),
    [tableSize, occupiedSeats]
  );
  const canReenter = (e) => maxReEntries === 0 || (e.reentries || 0) < maxReEntries;
  const eligible = (eliminatedPlayers || []).filter(canReenter);
  const maxed = (eliminatedPlayers || []).filter((e) => !canReenter(e));

  const randomSeat = () => {
    if (!emptySeats.length) return;
    const pick = emptySeats[Math.floor(Math.random() * emptySeats.length)];
    setSeat(String(pick));
  };

  const submit = () => {
    if (!selectedName) return;
    let chosenSeat = seat ? Number(seat) : null;
    if (!chosenSeat && emptySeats.length) {
      chosenSeat = emptySeats[Math.floor(Math.random() * emptySeats.length)];
    }
    if (!chosenSeat) return;
    onReentry(selectedName, chosenSeat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Re-entry</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        {eligible.length === 0 && maxed.length === 0 ? (
          <div className="text-sm text-slate-400 mb-4">No eliminated players available for re-entry.</div>
        ) : (
          <>
            <div className="text-xs text-slate-400 mb-3">
              Re-entry gives the player {money(startingStack, sym)} (original starting stack).
              {maxReEntries > 0 ? ` Max ${maxReEntries} re-entr${maxReEntries === 1 ? 'y' : 'ies'} per player.` : ' Unlimited re-entries.'}
            </div>
            {eligible.length > 0 && (
              <>
                <label className="text-xs text-slate-400 block mb-1">Select eliminated player</label>
                <div className="space-y-1.5 mb-4">
                  {eligible.map((e) => (
                    <button
                      key={e.name}
                      onClick={() => setSelectedName(e.name)}
                      className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                        selectedName === e.name
                          ? 'bg-[#4a5a4a] border-[#5a6a5a] text-white'
                          : 'bg-[#15181d] border-[#2a2f37] text-slate-300 hover:border-[#3a4a3a]'
                      }`}
                    >
                      <span>{e.name}</span>
                      <span className="text-xs text-slate-400">
                        {e.reentries || 0} re-entr{(e.reentries || 0) === 1 ? 'y' : 'ies'}
                        {maxReEntries > 0 ? ` / ${maxReEntries}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {maxed.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-1">Maxed out (cannot re-enter)</div>
                <div className="space-y-1">
                  {maxed.map((e) => (
                    <div key={e.name} className="flex items-center justify-between rounded-lg border border-[#2a2f37] bg-[#15181d]/50 px-3 py-2 text-sm text-slate-500 opacity-60">
                      <span>{e.name}</span>
                      <span className="text-xs">{e.reentries || 0} / {maxReEntries}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedName && (
              <div className="mb-4">
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
            )}
            <button
              onClick={submit}
              disabled={!selectedName || !emptySeats.length}
              className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {emptySeats.length ? 'Re-enter player' : 'No empty seats'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
