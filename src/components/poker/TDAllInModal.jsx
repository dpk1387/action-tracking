import React, { useState, useEffect } from 'react';
import { X, Tv, ArrowUp, ArrowDown, Users, Sparkles, Check, AlertCircle } from 'lucide-react';
import { formatKM } from '@/lib/poker';

export default function TDAllInModal({
  isOpen,
  onClose,
  mtt = null,
  activeHand = null,
  onStartAllInView,
  onBroadcastAllIn,
  currentBroadcast = null,
}) {
  if (!isOpen) return null;

  const launchCallback = onStartAllInView || onBroadcastAllIn;

  // 1. Available Tables
  const tables = mtt ? mtt.tables.filter((t) => t.active) : [];
  const [selectedTableId, setSelectedTableId] = useState(() => {
    if (currentBroadcast?.tableId) return currentBroadcast.tableId;
    if (mtt?.activeTableId) return mtt.activeTableId;
    return tables[0]?.id || 'table-1';
  });

  const currentTable = mtt ? tables.find((t) => t.id === selectedTableId) : null;
  const tablePlayers = currentTable ? currentTable.players : (activeHand?.players || []);

  // 2. Selected Players for All-In (ordered by chip stack going into the hand)
  const [orderedPlayerIds, setOrderedPlayerIds] = useState(() => {
    if (currentBroadcast?.playerIds?.length) {
      return currentBroadcast.playerIds;
    }
    if (currentBroadcast?.rankedPlayers?.length) {
      return currentBroadcast.rankedPlayers.map((p) => p.id);
    }
    // Default: Sort table players by current stack descending, take top 2
    const sorted = [...tablePlayers].sort((a, b) => (b.stack || 0) - (a.stack || 0));
    return sorted.slice(0, 2).map((p) => p.id);
  });

  const [error, setError] = useState('');

  // Switch table resets players if table changes
  const handleSelectTable = (tblId) => {
    setSelectedTableId(tblId);
    const tbl = tables.find((t) => t.id === tblId);
    if (tbl) {
      const sorted = [...tbl.players].sort((a, b) => (b.stack || 0) - (a.stack || 0));
      setOrderedPlayerIds(sorted.slice(0, 2).map((p) => p.id));
    }
    setError('');
  };

  const togglePlayerSelection = (pid) => {
    setOrderedPlayerIds((prev) => {
      if (prev.includes(pid)) {
        if (prev.length <= 2) {
          setError('At least 2 players are required for an all-in.');
          return prev;
        }
        setError('');
        return prev.filter((id) => id !== pid);
      } else {
        setError('');
        // Add at the end of the ranking
        return [...prev, pid];
      }
    });
  };

  // Reordering functions for chip stack hierarchy
  const movePlayerRank = (index, delta) => {
    setOrderedPlayerIds((prev) => {
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleLaunchAllInView = () => {
    if (orderedPlayerIds.length < 2) {
      setError('Please select at least 2 players involved in the all-in.');
      return;
    }

    const rankedPlayers = orderedPlayerIds.map((pid, idx) => {
      const playerObj = tablePlayers.find((p) => p.id === pid) || { id: pid, name: `Player ${idx + 1}`, stack: 0 };
      return {
        ...playerObj,
        chipRank: idx + 1,
        chipRankLabel: idx === 0 ? '1st (Most Chips / Covering)' : `${idx + 1}${idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Most Chips`,
      };
    });

    if (launchCallback) {
      launchCallback({
        tableId: selectedTableId,
        tableName: currentTable?.name || 'Main Table',
        playerIds: orderedPlayerIds,
        rankedPlayers,
        tablePlayers,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-emerald-500/40 bg-[#12161f] p-6 shadow-2xl relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#242c38] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Tv size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Show All-In Setup
              </h2>
              <p className="text-xs text-slate-400">
                Select who is all-in and rank chip stacks. Enter cards directly in the All-In View.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step 1: Select Table (if MTT) */}
        {tables.length > 1 && (
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              1. Select Table
            </label>
            <div className="flex flex-wrap gap-2">
              {tables.map((t) => {
                const isSel = t.id === selectedTableId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTable(t.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                      isSel
                        ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                        : 'bg-[#181d26] border-[#293240] text-slate-300 hover:bg-[#202734]'
                    }`}
                  >
                    {t.name} ({t.players.length} players)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Select Who is All-In */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Select Who is All-In (Min 2 Players)
            </label>
            <span className="text-[11px] text-slate-400">
              {orderedPlayerIds.length} players selected
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {tablePlayers.map((p) => {
              const isSelected = orderedPlayerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayerSelection(p.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-rose-950/70 border-rose-500 text-white ring-1 ring-rose-500/50 shadow-sm'
                      : 'bg-[#171b24] border-[#262f3d] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="truncate max-w-[100px] font-semibold">{p.name}</span>
                  {isSelected ? (
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                      ALL-IN
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">{formatKM(p.stack)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Select Out of All-In Players: Who Had Most Chips, 2nd Most, etc. */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              3. Chip Stack Order Going Into Hand
            </label>
            <span className="text-[11px] text-amber-300/80 font-medium">
              Rank 1 = covering stack / most chips
            </span>
          </div>

          <div className="space-y-2 bg-[#161a24] rounded-xl border border-[#273142] p-3">
            {orderedPlayerIds.map((pid, idx) => {
              const player = tablePlayers.find((p) => p.id === pid);
              const isFirst = idx === 0;
              const isLast = idx === orderedPlayerIds.length - 1;

              return (
                <div
                  key={pid}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#1a202d] border border-[#2b3648]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black font-mono ${
                      idx === 0
                        ? 'bg-amber-500 text-black shadow-md'
                        : idx === 1
                        ? 'bg-slate-300 text-black'
                        : 'bg-amber-800 text-amber-200'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-sm font-bold text-white mr-2">
                        {player?.name || 'Player'}
                      </span>
                      <span className="text-xs text-amber-300/90 font-mono">
                        ({formatKM(player?.stack)})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#252f40] text-slate-300">
                      {idx === 0 ? '🥇 Most Chips (Covering)' : `${idx + 1}${idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Most`}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => movePlayerRank(idx, -1)}
                        disabled={isFirst}
                        className="p-1 rounded bg-[#283244] hover:bg-[#344158] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Up in chip rank"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePlayerRank(idx, 1)}
                        disabled={isLast}
                        className="p-1 rounded bg-[#283244] hover:bg-[#344158] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Down in chip rank"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-500 text-rose-300 text-xs">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#242c38]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#202633] hover:bg-[#2b3445] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLaunchAllInView}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold cursor-pointer transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
          >
            <Tv size={15} />
            <span>Open All-In View</span>
          </button>
        </div>
      </div>
    </div>
  );
}
