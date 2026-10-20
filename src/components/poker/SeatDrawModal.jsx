import React, { useState, useEffect } from 'react';
import { X, Shuffle, Check, Sparkles } from 'lucide-react';

export default function SeatDrawModal({ players, onApply, onClose }) {
  const activePlayers = players.filter((p) => p.occupied !== false && p.name.trim() !== '');
  const candidatePlayers = activePlayers.length >= 2 ? activePlayers : players.filter((p) => p.occupied !== false);

  // Generate randomized seat assignments (seats 1 to candidatePlayers.length)
  const generateDraw = () => {
    const seats = Array.from({ length: candidatePlayers.length }, (_, i) => i + 1);
    // Fisher-Yates shuffle
    for (let i = seats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seats[i], seats[j]] = [seats[j], seats[i]];
    }
    return candidatePlayers.map((p, idx) => ({
      ...p,
      originalSeat: p.seat,
      newSeat: seats[idx],
      revealed: false,
    }));
  };

  const [drawState, setDrawState] = useState(generateDraw);
  const [allRevealed, setAllRevealed] = useState(false);

  const revealOne = (idx) => {
    setDrawState((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], revealed: true };
      if (next.every((item) => item.revealed)) setAllRevealed(true);
      return next;
    });
  };

  const revealAll = () => {
    setDrawState((prev) => prev.map((item) => ({ ...item, revealed: true })));
    setAllRevealed(true);
  };

  const reDraw = () => {
    setDrawState(generateDraw());
    setAllRevealed(false);
  };

  const handleApply = () => {
    // Return updated players mapped to their new seats
    const newPlayersMap = new Map();
    drawState.forEach((item) => {
      newPlayersMap.set(item.id || item.name || `p-${item.originalSeat}`, item.newSeat);
    });

    const updated = players.map((p) => {
      const key = p.id || p.name || `p-${p.seat}`;
      if (newPlayersMap.has(key)) {
        return { ...p, seat: newPlayersMap.get(key) };
      }
      return p;
    });

    // Sort players by seat ascending
    updated.sort((a, b) => (a.seat || 0) - (b.seat || 0));
    onApply(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-[#2a2f37] bg-[#1a1d24] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2f37]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Official Seat Draw</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="text-xs text-slate-300 mb-4">
          Click individual cards or tap <span className="text-amber-300 font-semibold">"Reveal All"</span> to reveal randomized seat positions for all {candidatePlayers.length} players.
        </div>

        {/* Card Draw Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto p-1 mb-5">
          {drawState.map((item, idx) => (
            <div
              key={idx}
              onClick={() => revealOne(idx)}
              className="cursor-pointer group select-none h-28"
            >
              {item.revealed ? (
                /* Revealed card - crisp, forward-facing text */
                <div className="w-full h-full rounded-xl border border-amber-500/50 bg-gradient-to-b from-[#222933] to-[#151920] shadow-[0_0_15px_rgba(245,158,11,0.25)] flex flex-col items-center justify-center p-3 text-center transition-all animate-[fadeIn_300ms_ease-out]">
                  <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Assigned</div>
                  <div className="text-2xl font-black text-white my-0.5 tracking-tight font-mono">
                    Seat {item.newSeat}
                  </div>
                  <div className="text-xs text-slate-200 font-medium truncate w-full px-1">
                    {item.name || `Player ${item.originalSeat}`}
                  </div>
                </div>
              ) : (
                /* Hidden card - unrevealed */
                <div className="w-full h-full rounded-xl border border-[#2f3d56] bg-gradient-to-br from-[#1e2738] via-[#161c28] to-[#0f141d] flex flex-col items-center justify-center p-3 text-center shadow-md hover:scale-[1.02] transition-transform">
                  <div className="w-8 h-8 rounded-full border border-amber-500/30 flex items-center justify-center mb-1 bg-amber-500/10 text-amber-300 font-serif font-bold text-xs">
                    ♠
                  </div>
                  <div className="text-xs font-semibold text-slate-200 truncate w-full px-1">
                    {item.name || `Seat ${item.originalSeat}`}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Tap to reveal</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2a2f37]">
          <div className="flex items-center gap-2">
            <button
              onClick={reDraw}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#252b35] hover:bg-[#313946] text-slate-200 text-xs font-medium cursor-pointer transition-colors"
            >
              <Shuffle size={14} /> Re-shuffle
            </button>
            {!allRevealed && (
              <button
                onClick={revealAll}
                className="px-3 py-2 rounded-lg bg-[#2e3746] hover:bg-[#3a4556] text-amber-300 text-xs font-medium cursor-pointer transition-colors"
              >
                Reveal All
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#252b35] hover:bg-[#313946] text-slate-300 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-emerald-950 transition-colors"
            >
              <Check size={15} /> Apply Seat Draw
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
