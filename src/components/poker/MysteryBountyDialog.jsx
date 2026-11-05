import React, { useState } from 'react';
import { Gift, Sparkles, X, Trophy } from 'lucide-react';
import { money } from '@/lib/poker';

export default function MysteryBountyDialog({ item, currency = '$', onAward, onDismiss }) {
  const [customAmount, setCustomAmount] = useState('');
  const hunterNames = item?.hunterNames?.join(' & ') || 'Winner';
  const victimName = item?.victimName || 'Player';

  const quickAmounts = [25, 50, 100, 250, 500, 1000];

  const handleConfirm = () => {
    const val = Number(customAmount);
    if (!isNaN(val) && val > 0) {
      onAward(val);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141820] border border-amber-500/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_200ms_ease-out]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-[#141820] px-5 py-4 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow">
              <Gift size={22} className="animate-bounce" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={12} />
                <span>Mystery Bounty Pull</span>
              </div>
              <h2 className="text-base font-extrabold text-white">Award Mystery Bounty</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-[#1b222d] border border-slate-800 flex items-center gap-3">
            <Trophy size={20} className="text-amber-400 shrink-0" />
            <div className="text-xs text-slate-300">
              <span className="font-extrabold text-white">{hunterNames}</span> eliminated{' '}
              <span className="font-extrabold text-rose-300">{victimName}</span>! Reveal envelope or enter bounty amount won below:
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Bounty Envelope Amount ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">
                {currency}
              </span>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                autoFocus
                className="w-full rounded-xl bg-[#0e1117] border border-amber-500/50 pl-8 pr-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Quick Picks:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => onAward(amt)}
                  className="py-2 px-3 rounded-xl bg-[#1d2432] hover:bg-amber-600/30 border border-slate-700 hover:border-amber-500/60 text-slate-200 hover:text-amber-300 font-mono font-bold text-xs transition-colors cursor-pointer"
                >
                  {money(amt, currency)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0f131a] border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
          >
            Skip for now
          </button>
          <button
            type="button"
            disabled={!customAmount || Number(customAmount) <= 0}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold text-xs shadow-lg transition-all cursor-pointer"
          >
            Award Bounty
          </button>
        </div>
      </div>
    </div>
  );
}
