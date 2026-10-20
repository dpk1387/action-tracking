import React, { useState } from 'react';
import { X, Shuffle, AlertTriangle, Check, Sparkles, Layers } from 'lucide-react';

export default function TDBreakTableModal({
  mtt,
  onBreakTables,
  onClose,
}) {
  const activeTables = (mtt?.tables || []).filter((t) => t.active);
  const [selectedTableIds, setSelectedTableIds] = useState([]);
  const [breakResult, setBreakResult] = useState(null);

  const toggleTable = (id) => {
    setSelectedTableIds((prev) =>
      prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id]
    );
  };

  const survivingTables = activeTables.filter((t) => !selectedTableIds.includes(t.id));
  const totalPlayersToMove = activeTables
    .filter((t) => selectedTableIds.includes(t.id))
    .reduce((sum, t) => sum + (t.players || []).length, 0);

  const handleExecuteBreak = () => {
    if (selectedTableIds.length === 0) return;
    if (survivingTables.length === 0) {
      alert('Cannot break all tables! At least one surviving table is required.');
      return;
    }
    const updatedMTT = onBreakTables(selectedTableIds);
    if (updatedMTT?.lastBreakDraw) {
      setBreakResult(updatedMTT.lastBreakDraw);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-amber-500/30 bg-[#191714] p-5 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2e271f]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Shuffle size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Break Table(s)</h3>
              <p className="text-xs text-slate-400">
                Random draw to redistribute players into open seats at surviving tables
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

        {breakResult ? (
          /* Reveal of Draw Results */
          <div className="space-y-4 my-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl">
              <Sparkles size={16} />
              Random Seat Draw Complete! Players have been assigned to new tables:
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
              {breakResult.map((res, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#342b20] bg-[#221c15]"
                >
                  <div className="font-semibold text-white text-sm">
                    {res.player.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      → {res.toTableName}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-lg bg-[#2e261d] text-slate-200 font-mono font-bold">
                      Seat {res.seat}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer transition-colors shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Selection of Table(s) to Break */
          <>
            <div className="text-xs text-slate-300 mb-2">
              Select one or multiple tables to break. Surviving tables will receive the players evenly via an unbiased random draw.
            </div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto my-2 pr-1">
              {activeTables.map((t) => {
                const isSelected = selectedTableIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTable(t.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/60 shadow-sm'
                        : 'bg-[#221c16] border-[#342a20] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-amber-500 border-amber-400 text-black'
                            : 'border-slate-600 bg-[#191511]'
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{t.name}</div>
                        <div className="text-xs text-slate-400">
                          {(t.players || []).length} active players · Table #{t.tableNumber || 1}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-[#2d241c] text-slate-300'
                      }`}
                    >
                      {isSelected ? 'To Break' : 'Keep Active'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Impact Summary */}
            {selectedTableIds.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 mt-2 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400" />
                  Break Impact:
                </div>
                <div>
                  • {totalPlayersToMove} player{totalPlayersToMove !== 1 ? 's' : ''} will be moved.
                </div>
                <div>
                  • {survivingTables.length} surviving table{survivingTables.length !== 1 ? 's' : ''}:{' '}
                  {survivingTables.map((s) => s.name).join(', ') || 'None (Invalid)'}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#2e271f] mt-2">
              <span className="text-xs text-slate-400">
                {selectedTableIds.length > 0
                  ? `${selectedTableIds.length} table${selectedTableIds.length > 1 ? 's' : ''} selected to break`
                  : 'Select at least 1 table'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg bg-[#27211a] hover:bg-[#342c23] text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBreak}
                  disabled={selectedTableIds.length === 0 || survivingTables.length === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-bold cursor-pointer transition-colors shadow-md"
                >
                  <Shuffle size={13} />
                  Execute Random Break Draw ({selectedTableIds.length})
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
