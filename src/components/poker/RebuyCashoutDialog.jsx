import React, { useState } from 'react';
import { X } from 'lucide-react';
import { money } from '@/lib/poker';

export default function RebuyCashoutDialog({ hand, onApply, onClose }) {
  const [sel, setSel] = useState(String(hand.players[0]?.id || 0));
  const [amount, setAmount] = useState('');
  const cur = hand.currency;

  const apply = (sign) => {
    const v = Number(amount);
    if (!v || v <= 0) return;
    onApply(Number(sel), sign * v);
    setAmount('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Rebuy / Cash out</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="text-xs text-slate-400 mb-3">Adjusts the player's stack on the next hand.</div>
        <div className="space-y-3">
          <select value={sel} onChange={(e) => setSel(e.target.value)} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm">
            {hand.players.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {money(p.stack, cur)}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            {cur && <span className="text-xs text-slate-400">{cur}</span>}
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="flex-1 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            <button onClick={() => apply(1)} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-2">Rebuy +</button>
            <button onClick={() => apply(-1)} className="rounded-lg bg-[#c94c4c] hover:bg-[#d95959] text-white text-sm px-3 py-2">Cash out –</button>
          </div>
        </div>
        <button onClick={onClose} className="w-full mt-5 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm py-2.5">Done</button>
      </div>
    </div>
  );
}
