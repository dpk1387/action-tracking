import React, { useState, useEffect, useRef } from 'react';
import { X, UserMinus, ArrowUp, ArrowDown, Trophy, AlertTriangle, Plus, Trash2, ChevronDown, Check, Users } from 'lucide-react';
import { getOrdinalSuffix } from '@/lib/payoutEngine';

/**
 * Searchable Player Combobox:
 * Allows typing to filter, selecting from dropdown, or clicking chevron to show all.
 */
function PlayerCombobox({
  value = '',
  selectedId = '',
  onChange,
  onSelectPlayer,
  activePlayers = [],
  excludedIds = new Set(),
  placeholder = 'Type player name...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedQuery = value.trim().toLowerCase();
  const availablePlayers = activePlayers.filter((p) => !excludedIds.has(String(p.id)));
  const matchingPlayers = trimmedQuery
    ? availablePlayers.filter((p) => p.name && p.name.toLowerCase().includes(trimmedQuery))
    : availablePlayers;

  const handleSelect = (p) => {
    onSelectPlayer(p);
    setIsOpen(false);
  };

  const isMatched = activePlayers.some(
    (p) => String(p.id) === String(selectedId) || (p.name && p.name.trim().toLowerCase() === trimmedQuery)
  );

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full bg-[#10141c] border rounded-lg pl-3 pr-8 py-1.5 text-white text-xs focus:outline-none transition-colors ${
            value && !isMatched
              ? 'border-rose-500/80 focus:border-rose-500 bg-rose-950/10'
              : 'border-slate-700 focus:border-emerald-500'
          }`}
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          tabIndex={-1}
          className="absolute right-1.5 p-1 text-slate-400 hover:text-white cursor-pointer"
        >
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-[#161c26] border border-slate-700 rounded-xl shadow-2xl py-1 text-xs">
          {matchingPlayers.length === 0 ? (
            <div className="px-3 py-2 text-slate-400 text-[11px] text-center">
              No matching active players found
            </div>
          ) : (
            matchingPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-white flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="font-semibold">{p.name}</span>
                {p.stack ? (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Number(p.stack).toLocaleString()} chips
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DirectorBustDialog({
  isOpen,
  onClose,
  remainingPlayers,
  players = [],
  eliminations = [],
  payouts = [],
  splitSimultaneousTies = true,
  onConfirmBust,
  onOpenRoster,
}) {
  // Filter out any players who have already been eliminated!
  const eliminatedNames = new Set((eliminations || []).map((e) => (e.name || '').trim().toLowerCase()));
  const activeRemainingPlayers = (players || []).filter((p) => {
    if (p.status === 'eliminated' || p.status === 'out' || p.eliminated) return false;
    if (p.name && eliminatedNames.has(p.name.trim().toLowerCase())) return false;
    return true;
  });

  const [bustMode, setBustMode] = useState(1); // 1, 2, 3, or '4+'
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [singlePlayerName, setSinglePlayerName] = useState('');
  const [playersList, setPlayersList] = useState([
    { id: '', name: '', stack: 0 },
  ]);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync rows when bustMode changes
  useEffect(() => {
    setErrorMsg('');
    if (bustMode === '4+') {
      const count = Math.max(4, Math.min(remainingPlayers - 1, 4));
      setPlayersList((prev) => {
        const arr = [];
        for (let i = 0; i < count; i++) {
          arr.push(prev[i] || { id: '', name: '', stack: 0 });
        }
        return arr;
      });
    } else {
      const count = Math.max(1, Math.min(remainingPlayers - 1, Number(bustMode) || 1));
      setPlayersList((prev) => {
        const arr = [];
        for (let i = 0; i < count; i++) {
          arr.push(prev[i] || { id: '', name: '', stack: 0 });
        }
        return arr;
      });
    }
  }, [bustMode, remainingPlayers]);

  const movePlayer = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= playersList.length) return;
    const copy = [...playersList];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;
    setPlayersList(copy);
  };

  const selectPlayerForRow = (idx, chosen) => {
    setPlayersList((prev) => {
      const copy = [...prev];
      if (chosen) {
        copy[idx] = {
          id: chosen.id,
          name: chosen.name,
          stack: chosen.stack || 0,
        };
      } else {
        copy[idx] = { id: '', name: '', stack: 0 };
      }
      return copy;
    });
  };

  const updatePlayerName = (idx, name) => {
    setPlayersList((prev) => {
      const copy = [...prev];
      // Check if typed name matches an active player
      const match = activeRemainingPlayers.find(
        (p) => p.name && p.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      copy[idx] = {
        ...copy[idx],
        name,
        id: match ? match.id : '',
        stack: match ? (match.stack || 0) : copy[idx].stack,
      };
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

  // Add row on top (takes the finish rank of the previous top row minus 1)
  const handleAddRowOnTop = () => {
    if (playersList.length >= remainingPlayers - 1) {
      setErrorMsg('Cannot add more busts. Tournament must have at least 1 remaining player.');
      return;
    }
    setErrorMsg('');
    setPlayersList((prev) => [{ id: '', name: '', stack: 0 }, ...prev]);
  };

  const handleRemoveRow = (idxToRemove) => {
    if (playersList.length <= 1) return;
    setErrorMsg('');
    setPlayersList((prev) => prev.filter((_, i) => i !== idxToRemove));
  };

  // Auto-sort by stack descending (higher stack finished higher)
  const sortByStack = () => {
    setPlayersList((prev) =>
      [...prev].sort((a, b) => (Number(b.stack) || 0) - (Number(a.stack) || 0))
    );
  };

  // Determine places occupied
  // If remaining is 10 and 4 bust, startPlace = 10 - 4 + 1 = 7th place.
  // Row 0 is 7th place, Row 1 is 8th, etc.
  const startPlace = remainingPlayers - playersList.length + 1;

  const handleSubmit = (e) => {
    e?.preventDefault();
    setErrorMsg('');

    // If activeRemainingPlayers exists, enforce that all inputs MUST match a valid active player
    if (activeRemainingPlayers.length > 0) {
      if (playersList.length === 1) {
        const typed = (singlePlayerName || playersList[0]?.name || '').trim();
        const found = activeRemainingPlayers.find(
          (p) => String(p.id) === String(selectedPlayerId) || (p.name && p.name.trim().toLowerCase() === typed.toLowerCase())
        );

        if (!found) {
          setErrorMsg(
            typed
              ? `"${typed}" is not a valid active player in the tournament. Please select or type an active player's name.`
              : 'Please enter or select an active player to eliminate.'
          );
          return;
        }

        onConfirmBust({
          bustCount: 1,
          players: [{ id: found.id, name: found.name, stack: found.stack || 0 }],
          stackRankedOrder: [{ id: found.id, name: found.name, stack: found.stack || 0 }],
        });
        onClose();
        return;
      }

      // Multi-player bust validation
      const resolvedList = [];
      const usedIds = new Set();

      for (let i = 0; i < playersList.length; i++) {
        const row = playersList[i];
        const typed = String(row.name || '').trim();
        const found = activeRemainingPlayers.find(
          (p) => String(p.id) === String(row.id) || (p.name && p.name.trim().toLowerCase() === typed.toLowerCase())
        );

        const assignedPlace = startPlace + i;
        const placeLabel = `${assignedPlace}${getOrdinalSuffix(assignedPlace)}`;

        if (!found) {
          setErrorMsg(
            typed
              ? `"${typed}" for ${placeLabel} place is not a valid active player in the tournament. Please select a valid player name.`
              : `Please enter a valid player for ${placeLabel} place.`
          );
          return;
        }

        if (usedIds.has(String(found.id))) {
          setErrorMsg(`Player "${found.name}" is selected more than once. Each elimination row must be a different player.`);
          return;
        }

        usedIds.add(String(found.id));
        resolvedList.push({
          id: found.id,
          name: found.name,
          stack: row.stack || found.stack || 0,
        });
      }

      onConfirmBust({
        bustCount: resolvedList.length,
        players: resolvedList,
        stackRankedOrder: resolvedList,
      });
      onClose();
      return;
    }

    // Fallback if no active player roster was generated
    const finalList = playersList.map((p, idx) => ({
      id: p.id || `bust_${Date.now()}_${idx}`,
      name: p.name || `Player (Place ${startPlace + idx})`,
      stack: p.stack || 0,
    }));

    onConfirmBust({
      bustCount: finalList.length,
      players: finalList,
      stackRankedOrder: finalList,
    });
    onClose();
  };

  if (!isOpen) return null;

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
              <div className="text-xs text-slate-400">Field remaining: {remainingPlayers} players</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Roster Helper Link */}
          {onOpenRoster && (
            <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/60 rounded-xl px-3.5 py-2 text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Users size={14} className="text-emerald-400" />
                Approaching the money?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRoster();
                }}
                className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline text-xs"
              >
                Enter/Update Player Names
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              How many players busted?
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, '4+'].map((num) => {
                const isSelected = bustMode === num;
                const minRemainingReq = typeof num === 'number' ? num + 1 : 5;
                const isDisabled = remainingPlayers < minRemainingReq;

                return (
                  <button
                    key={num}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setBustMode(num)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600 border-rose-500 text-white shadow-md'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {num} {typeof num === 'number' && num === 1 ? 'Player' : 'Players'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1 player busting: Searchable Combobox Text Box */}
          {playersList.length === 1 && (
            <div className="bg-[#171c26] p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Single Elimination:</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {startPlace}{getOrdinalSuffix(startPlace)} Place
                </span>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Type or select player name to eliminate:
                </label>
                <PlayerCombobox
                  value={singlePlayerName}
                  selectedId={selectedPlayerId}
                  onChange={(val) => {
                    setSinglePlayerName(val);
                    setErrorMsg('');
                    const match = activeRemainingPlayers.find(
                      (p) => p.name && p.name.trim().toLowerCase() === val.trim().toLowerCase()
                    );
                    setSelectedPlayerId(match ? match.id : '');
                  }}
                  onSelectPlayer={(p) => {
                    setSinglePlayerName(p.name);
                    setSelectedPlayerId(p.id);
                    setErrorMsg('');
                  }}
                  activePlayers={activeRemainingPlayers}
                  placeholder="Type player name..."
                />
              </div>
            </div>
          )}

          {/* Multiple players busting: Searchable Comboboxes per row */}
          {playersList.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs font-bold text-white">Simultaneous Eliminations</div>
                  <div className="text-[11px] text-slate-400">
                    {splitSimultaneousTies
                      ? 'Payout rule: Pooled cash divided equally among tied places (T-rank).'
                      : 'Payout rule: Higher entering chip stacks finish higher.'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {bustMode === '4+' && (
                    <button
                      type="button"
                      onClick={handleAddRowOnTop}
                      disabled={playersList.length >= remainingPlayers - 1}
                      className="text-xs px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40"
                      title="Add a player row on top (takes the finish rank of the previous top row minus 1)"
                    >
                      <Plus size={13} /> Add Row (on top)
                    </button>
                  )}

                  {!splitSimultaneousTies && (
                    <button
                      type="button"
                      onClick={sortByStack}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 cursor-pointer"
                    >
                      Sort by Chip Stack
                    </button>
                  )}
                </div>
              </div>

              {/* Order List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {playersList.map((player, idx) => {
                  const assignedPlace = startPlace + idx;
                  const payoutItem = payouts.find((p) => p.place === assignedPlace);

                  // Players selected in other rows to prevent selecting same player twice
                  const selectedInOtherRows = new Set(
                    playersList
                      .filter((_, i) => i !== idx)
                      .map((p) => String(p.id))
                      .filter(Boolean)
                  );

                  return (
                    <div
                      key={`bust_row_${idx}`}
                      className="flex items-center gap-2 bg-[#171c26] p-2.5 rounded-xl border border-slate-800 text-xs"
                    >
                      <div className="w-16 font-bold text-emerald-400 font-mono shrink-0">
                        {assignedPlace}{getOrdinalSuffix(assignedPlace)}
                      </div>

                      {/* Searchable Text Combobox */}
                      <PlayerCombobox
                        value={player.name || ''}
                        selectedId={player.id || ''}
                        onChange={(val) => {
                          updatePlayerName(idx, val);
                          setErrorMsg('');
                        }}
                        onSelectPlayer={(p) => {
                          selectPlayerForRow(idx, p);
                          setErrorMsg('');
                        }}
                        activePlayers={activeRemainingPlayers}
                        excludedIds={selectedInOtherRows}
                        placeholder={`Player for ${assignedPlace}${getOrdinalSuffix(assignedPlace)} Place...`}
                      />

                      {!splitSimultaneousTies && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400">Stack:</span>
                          <input
                            type="number"
                            value={player.stack}
                            onChange={(e) => updatePlayerStack(idx, e.target.value)}
                            placeholder="Chips"
                            className="w-18 bg-[#10141c] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono text-right"
                          />
                        </div>
                      )}

                      {/* Manual Up/Down ordering buttons */}
                      {!splitSimultaneousTies && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => movePlayer(idx, -1)}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move Higher Finish (Higher Rank)"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === playersList.length - 1}
                            onClick={() => movePlayer(idx, 1)}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move Lower Finish"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      )}

                      {/* Remove row button if 4+ mode has added rows */}
                      {bustMode === '4+' && playersList.length > 4 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                          title="Remove this bust row"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}

                      {payoutItem && payoutItem.amount > 0 && (
                        <span className="text-amber-400 font-mono font-bold shrink-0 ml-1">
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
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg cursor-pointer transition-all active:scale-95"
            >
              Confirm Bust ({playersList.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
