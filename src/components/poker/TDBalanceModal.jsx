import React from 'react';
import { X, ArrowRightLeft, Check, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';
import { checkTableBalance, applyBalancingMoves } from '@/lib/mttStore';

export default function TDBalanceModal({
  mtt,
  onApplyBalance,
  onClose,
}) {
  const balanceInfo = checkTableBalance(mtt);

  const handleApply = () => {
    if (!balanceInfo.needsBalance) return;
    const updated = applyBalancingMoves(mtt, balanceInfo.moves);
    onApplyBalance(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-purple-500/30 bg-[#16141d] p-5 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#292338]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Official 4-Step Table Balancing</h3>
              <p className="text-xs text-slate-400">
                Rule-enforced tournament balancing mechanics
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

        {/* Status Alert */}
        {balanceInfo.needsBalance ? (
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300">Action Required: </span>
              {balanceInfo.message}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-emerald-300">Room-Wide Tables Balanced: </span>
              No table has a 2+ player gap (current delta is {balanceInfo.delta}).
            </div>
          </div>
        )}

        {/* 4 Steps Mechanics Breakdown Table */}
        <div className="overflow-y-auto max-h-[50vh] pr-1 space-y-3 mb-4">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-1">
            4-Step Tournament Director Rule Enforcement
          </div>

          {balanceInfo.steps && balanceInfo.steps.length > 0 ? (
            balanceInfo.steps.map((st) => (
              <div
                key={st.step}
                className="p-3.5 rounded-xl border border-[#2e263c] bg-[#1e1a27] space-y-1.5"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                  <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center font-mono text-[11px]">
                    {st.step}
                  </span>
                  <span>Step {st.step}: {st.title}</span>
                </div>
                <div className="text-xs text-slate-300 pl-7 leading-relaxed">
                  {st.detail}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 rounded-xl border border-[#2a2436] bg-[#1c1824] text-xs text-slate-400 space-y-2">
              <div className="font-semibold text-slate-300">Tournament Balancing Standard:</div>
              <ul className="space-y-1 list-disc pl-4 text-slate-400">
                <li><strong className="text-slate-300">Step 1 (Delta):</strong> Triggered when gap between fullest and shortest table ≥ 2 players.</li>
                <li><strong className="text-slate-300">Step 2 (Givers):</strong> Fullest tables locked; next Big Blind player selected as mover.</li>
                <li><strong className="text-slate-300">Step 3 (Receivers):</strong> Shortest tables ranked by number (lowest number receives first).</li>
                <li><strong className="text-slate-300">Step 4 (Worst Seat):</strong> Placed in open seat closest clockwise to BB (skipping SB and Button).</li>
              </ul>
            </div>
          )}

          {/* Planned Moves Preview */}
          {balanceInfo.moves && balanceInfo.moves.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider px-1 mb-2">
                Identified Move{balanceInfo.moves.length > 1 ? 's' : ''} to Apply ({balanceInfo.moves.length})
              </div>
              <div className="space-y-2">
                {balanceInfo.moves.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-[#251f2e]"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">{m.player?.name}</div>
                        <div className="text-[11px] text-amber-200">
                          Next Big Blind at {m.fromTableName} ({m.fromTableCount} players)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-purple-300 font-medium">→ Moves to:</span>
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-200 font-bold border border-purple-500/30">
                        {m.toTableName}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#30263f] text-amber-300 font-mono font-bold">
                        Seat {m.targetSeat}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#292338]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#241e2e] hover:bg-[#322b3e] text-slate-300 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
          {balanceInfo.needsBalance && (
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-bold cursor-pointer transition-all shadow-lg"
            >
              <ArrowRightLeft size={14} />
              Execute 4-Step Balance ({balanceInfo.moves.length} Move{balanceInfo.moves.length !== 1 ? 's' : ''})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
