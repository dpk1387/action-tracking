import React, { useState, useEffect } from 'react';
import { X, UserMinus, ArrowUp, ArrowDown, Trophy, AlertTriangle, Check } from 'lucide-react';

export default function DirectorBustDialog({
  isOpen,
  onClose,
  remainingPlayers,
  players = [],
  eliminations = [],
  payouts = [],
  splitSimultaneousTies = true,
  onConfirmBust,
}) {
  if (!isOpen) return null;

  // Filter out any players who have already been eliminated!
  const eliminatedNames = new Set((eliminations || []).map((e) => (e.name || '').trim().toLowerCase()));
  const activeRemainingPlayers = (players || []).filter((p) => {
    if (p.status === 'eliminated' || p.status === 'out' || p.eliminated) return false;
    if (p.name && eliminatedNames.has(p.name.trim().toLowerCase())) return false;
    return true;
  });

  const [bustCount, setBustCount] = useState(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [playersList, setPlayersList] = useState([
    { id: '1', name: '', stack: 5000 },
  ]);

  useEffect(() => {
    const count = Math.max(1, Math.min(remainingPlayers - 1, Number(bustCount) || 1));
    setPlayersList((prev) => {
      const arr = [];
      for (let i = 0; i < count; i++) {
        if (prev[i]) {
          arr.push(prev[i]);
        } else {
          arr.push({
            id: String(i + 1),
            name: `Player ${i + 1}`,
            stack: Math.max(1000, 10000 - i * 2000),
          });
        }
      }
      return arr;
    });
  }, [bustCount, remainingPlayers]);

  const movePlayer = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= playersList.length) return;
    const copy = [...playersList];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;
    setPlayersList(copy);
  };

  const updatePlayerName = (idx, name) => {
    setPlayersList((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], name };
      return copy;
    });
  };

  const updatePlayerStack = (idx, stack) => {
    setPlayersList((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], stack: Number(stack) || 0 };
      return copy;
    });
  };

  // Auto-sort by stack descending (higher stack finished higher)
  const sortByStack = () => {
    setPlayersList((prev) =>
      [...prev].sort((a, b) => (Number(b.stack) || 0) - (Number(a.stack) || 0))
    );
  };

  // Determine places occupied
  // If remaining is 6 and 2 bust, the 2 players take 5th and 6th place.
  // The first player in list (higher finish) takes 5th place, the next takes 6th place.
  const startPlace = remainingPlayers - playersList.length + 1; // e.g. 5

  const handleSubmit = (e) => {
    e?.preventDefault();
    let finalList = [...playersList];
    if (playersList.length === 1) {
      const chosen = activeRemainingPlayers.find((p) => String(p.id) === String(selectedPlayerId)) ||
                     activeRemainingPlayers.find((p) => p.name && p.name.trim().toLowerCase() === (playersList[0]?.name || '').trim().toLowerCase());
      finalList = [
        {
          id: chosen ? chosen.id : (selectedPlayerId || `player_bust_${Date.now()}`),
          name: chosen?.name || playersList[0]?.name || `Player (Place ${startPlace})`,
          stack: chosen?.stack || playersList[0]?.stack || 0,
        },
      ];
    } else {
      // For multiple, match any names with activeRemainingPlayers where possible
      finalList = finalList.map((p) => {
        const found = activeRemainingPlayers.find(
          (ap) => String(ap.id) === String(p.id) || (ap.name && ap.name.trim().toLowerCase() === (p.name || '').trim().toLowerCase())
        );
        return {
          id: found ? found.id : p.id,
          name: found?.name || p.name || 'Player',
          stack: p.stack ?? found?.stack ?? 0,
        };
      });
    }
    onConfirmBust({
      bustCount: finalList.length,
      players: finalList,
      stackRankedOrder: finalList,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <UserMinus size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Player Bust</h2>
              <div className="text-xs text-slate-400">Field remaining: {remainingPlayers}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              How many players busted?
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={remainingPlayers <= num}
                  onClick={() => setBustCount(num)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                    bustCount === num
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                  } disabled:opacity-30`}
                >
                  {num} {num === 1 ? 'Player' : 'Players'}
                </button>
              ))}
            </div>
          </div>

          {/* If 1 player is busting: Allow quick bust or optional player selection */}
          {playersList.length === 1 && (
            <div className="bg-[#171c26] p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Single Elimination:</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">{startPlace}th Place</span>
              </div>
              {activeRemainingPlayers && activeRemainingPlayers.length > 0 ? (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Select player to eliminate:
                  </label>
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPlayerId(id);
                      const chosen = activeRemainingPlayers.find((p) => String(p.id) === String(id));
                      if (chosen) {
                        updatePlayerName(0, chosen.name);
                        updatePlayerStack(0, chosen.stack || 0);
                      }
                    }}
                    className="w-full bg-[#10141c] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="">— Select Remaining Active Player ({activeRemainingPlayers.length} left) —</option>
                    {activeRemainingPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.stack ? `(${p.stack.toLocaleString()} chips)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Click Confirm below to record 1 player elimination.
                </div>
              )}
            </div>
          )}

          {/* If multiple players are busting */}
          {playersList.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Simultaneous Eliminations</div>
                  <div className="text-[11px] text-slate-400">
                    {splitSimultaneousTies
                      ? 'Payout rule: Pooled cash will be divided equally among tied players.'
                      : 'Payout rule: Ranks depend on entering chip stack sizes. Order who finished where below.'}
                  </div>
                </div>
                {!splitSimultaneousTies && (
                  <button
                    type="button"
                    onClick={sortByStack}
                    className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700"
                  >
                    Sort by Chip Stack
                  </button>
                )}
              </div>

              {/* Order List */}
              <div className="space-y-2">
                {playersList.map((player, idx) => {
                  const assignedPlace = startPlace + idx;
                  const payoutItem = payouts.find((p) => p.place === assignedPlace);

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 bg-[#171c26] p-2.5 rounded-xl border border-slate-800 text-xs"
                    >
                      <div className="w-16 font-bold text-emerald-400 font-mono">
                        {assignedPlace}th Place
                      </div>
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) => updatePlayerName(idx, e.target.value)}
                        placeholder="Player Name"
                        className="flex-1 bg-[#10141c] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      />
                      {!splitSimultaneousTies && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Stack:</span>
                          <input
                            type="number"
                            value={player.stack}
                            onChange={(e) => updatePlayerStack(idx, e.target.value)}
                            placeholder="Chips"
                            className="w-20 bg-[#10141c] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono text-right"
                          />
                        </div>
                      )}

                      {/* Up/Down ordering buttons for manual finishing order */}
                      {!splitSimultaneousTies && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => movePlayer(idx, -1)}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                            title="Move Higher Finish"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === playersList.length - 1}
                            onClick={() => movePlayer(idx, 1)}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                            title="Move Lower Finish"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      )}

                      {payoutItem && payoutItem.amount > 0 && (
                        <span className="text-amber-400 font-mono font-bold shrink-0">
                          ${payoutItem.amount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg cursor-pointer"
            >
              Confirm Bust ({playersList.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
