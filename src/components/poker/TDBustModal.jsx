import React, { useState } from 'react';
import { X, Flame, Check, AlertTriangle, Users } from 'lucide-react';

export default function TDBustModal({
  players = [],
  tables = [],
  isMTT = false,
  onBust,
  onClose,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterTableId, setFilterTableId] = useState('all');
  const [eliminatorId, setEliminatorId] = useState('');

  const togglePlayer = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const filteredPlayers = players.filter((p) => {
    if (filterTableId === 'all') return true;
    return p.tableId === filterTableId;
  });

  const handleConfirm = () => {
    const toBust = selectedIds.length > 0
      ? selectedIds
      : (filteredPlayers.length > 0 ? [filteredPlayers[0].id] : (players.length > 0 ? [players[0].id] : []));
    if (toBust.length === 0) return;
    const eliminator = players.find((p) => p.id === eliminatorId);
    onBust(toBust, eliminator?.name || null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-[#171317] p-5 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2e232e]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Flame size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Record Player Bust</h3>
              <p className="text-xs text-slate-400">
                Select one or multiple players eliminated in this hand
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Table Filter Tabs (if MTT) */}
        {isMTT && tables.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 border-b border-[#251e25]">
            <button
              onClick={() => setFilterTableId('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                filterTableId === 'all'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-[#221c22] text-slate-400 hover:text-white'
              }`}
            >
              All Tables ({players.length})
            </button>
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterTableId(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  filterTableId === t.id
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-[#221c22] text-slate-400 hover:text-white'
                }`}
              >
                {t.name} ({(t.players || []).length})
              </button>
            ))}
          </div>
        )}

        {/* Player List with Checkboxes */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 my-2 max-h-[46vh]">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">
              No active players found at this table.
            </div>
          ) : (
            filteredPlayers.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'bg-rose-500/20 border-rose-500/60 shadow-sm'
                      : 'bg-[#1e1820] border-[#2c222c] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'border-slate-600 bg-[#161218]'
                      }`}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.tableName ? `${p.tableName} · ` : ''}Seat {p.seat} · Stack:{' '}
                        <span className="font-mono text-amber-300 font-semibold">
                          {Number(p.stack || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[11px] font-bold text-rose-300 px-2 py-0.5 rounded bg-rose-500/20">
                      Busting
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Optional Eliminator */}
        <div className="pt-2 border-t border-[#2e232e] mb-3">
          <label className="text-xs text-slate-400 block mb-1">
            Eliminated By / Chips Awarded To (Optional)
          </label>
          <select
            value={eliminatorId}
            onChange={(e) => setEliminatorId(e.target.value)}
            className="w-full rounded-lg bg-[#110e13] border border-[#2e232e] px-3 py-1.5 text-xs text-white"
          >
            <option value="">-- Unknown / Split Pot --</option>
            {players
              .filter((p) => !selectedIds.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tableName ? `${p.tableName} - ` : ''}Seat {p.seat})
                </option>
              ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-400">
            {selectedIds.length > 0 ? (
              <span className="text-rose-300 font-bold">
                {selectedIds.length} player{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            ) : (
              <span className="text-slate-400">
                1 player bust (quick) or select specific player(s) above
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[#271f28] hover:bg-[#342a35] text-slate-300 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={players.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition-colors shadow-md"
            >
              <Flame size={13} />
              Confirm Bust ({selectedIds.length > 0 ? selectedIds.length : '1 Player'})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
