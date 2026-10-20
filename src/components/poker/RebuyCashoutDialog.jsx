import React, { useState } from 'react';
import { X, ShieldAlert, LogOut, PlusCircle } from 'lucide-react';
import { money } from '@/lib/poker';

export default function RebuyCashoutDialog({ hand, onApply, onClose }) {
  const [sel, setSel] = useState(String(hand.players[0]?.id || 0));
  const [amount, setAmount] = useState('');
  const cur = hand.currency;

  const selectedPlayer = hand.players.find((p) => String(p.id) === String(sel)) || hand.players[0];

  const handleRebuy = () => {
    const v = Number(amount);
    if (!v || v <= 0) return;
    onApply(Number(sel), v);
    setAmount('');
  };

  const handleCashoutFull = () => {
    if (!selectedPlayer || selectedPlayer.stack <= 0) return;
    // To prevent ratholing, player must cash out for the full stack!
    onApply(Number(selectedPlayer.id), -selectedPlayer.stack);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Rebuy / Cash Out</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Select Player</label>
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
            >
              {hand.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Current Stack: {money(p.stack, cur)}
                </option>
              ))}
            </select>
          </div>

          {/* Section 1: Rebuy */}
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3.5 space-y-2">
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <PlusCircle size={14} />
              <span>Add Chips (Rebuy)</span>
            </div>
            <div className="flex items-center gap-2">
              {cur && <span className="text-xs text-slate-400">{cur}</span>}
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount to add"
                className="flex-1 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
              />
              <button
                onClick={handleRebuy}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 cursor-pointer transition-colors shadow"
              >
                Rebuy +
              </button>
            </div>
          </div>

          {/* Section 2: Full Cashout (Ratholing Protection) */}
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <LogOut size={14} />
                <span>Cash Out (Full Amount Only)</span>
              </div>
              <span className="text-[10px] text-amber-300 flex items-center gap-1">
                <ShieldAlert size={12} /> No Ratholing
              </span>
            </div>
            <div className="text-[11px] text-slate-300 leading-relaxed">
              To prevent ratholing, a player who cashes out must cash out for their full stack. Partial cash outs are not permitted.
            </div>
            <button
              onClick={handleCashoutFull}
              disabled={!selectedPlayer || selectedPlayer.stack <= 0}
              className="w-full py-2.5 px-3 rounded-lg bg-rose-900/70 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed border border-rose-700/60 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>Cash Out Entire Stack:</span>
              <span className="text-amber-200 font-mono text-sm">
                {money(selectedPlayer?.stack || 0, cur)}
              </span>
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm py-2.5 cursor-pointer font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
