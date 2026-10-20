import React, { useState } from 'react';
import { Gift, Award, X, Sparkles, Users } from 'lucide-react';
import { money } from '@/lib/poker';

export default function MysteryBountyDialog({
  item,
  currency = '$',
  onAward,
  onDismiss,
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  if (!item) return null;

  const hunterNames = item.hunterNames || [];
  const huntersCount = hunterNames.length || 1;
  const isTie = huntersCount > 1;

  const handleConfirm = () => {
    const val = Number(amount);
    if (!val || val <= 0) {
      setError('Please enter a valid positive bounty amount.');
      return;
    }
    setError('');
    onAward(val);
  };

  const handleQuickSet = (val) => {
    setAmount(String(val));
    setError('');
  };

  const sharePerWinner = Number(amount) > 0 ? (Number(amount) / huntersCount) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-[#1c1813] to-[#121417] p-6 shadow-2xl text-white">
        {/* Glow accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Gift size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-amber-300 flex items-center gap-1.5">
                Mystery Bounty Draw
                <Sparkles size={16} className="text-amber-400 animate-pulse" />
              </h2>
              <p className="text-xs text-slate-400">Tournament Elimination Bounty</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="my-5 space-y-4">
          <div className="rounded-xl border border-[#2e261f] bg-[#181512] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Eliminated Player:</span>
              <span className="font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50">
                {item.victimName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Bounty Hunter{isTie ? 's (Tied)' : ''}:</span>
              <span className="font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 flex items-center gap-1">
                {isTie && <Users size={12} />}
                {hunterNames.join(' & ')}
              </span>
            </div>
            {isTie && (
              <div className="text-[11px] text-amber-300/90 pt-1 border-t border-amber-500/20">
                Two or more players with superior stacks tied for the winning pot. The cash value of the mystery bounty is split equally ({huntersCount} ways).
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Enter Drawn Envelope Amount ({currency})
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-400 font-bold">
                {currency}
              </div>
              <input
                type="number"
                min="1"
                step="any"
                autoFocus
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                placeholder="e.g. 100, 250, 1000..."
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#15181d] border-2 border-amber-500/50 focus:border-amber-400 focus:outline-none text-white text-lg font-mono font-bold placeholder:text-slate-600"
              />
            </div>
            {error && <div className="text-xs text-rose-400 mt-1">{error}</div>}

            {isTie && sharePerWinner > 0 && (
              <div className="text-xs text-emerald-400 font-mono mt-1.5 font-semibold">
                Each hunter receives: {money(sharePerWinner, currency)}
              </div>
            )}
          </div>

          {/* Quick preset chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
            {[25, 50, 100, 250, 500, 1000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleQuickSet(preset)}
                className="px-2.5 py-1 rounded-lg bg-[#241f18] hover:bg-[#332b21] border border-amber-500/30 text-amber-300 font-mono text-xs cursor-pointer transition-colors"
              >
                +{preset}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-xl bg-[#20252d] hover:bg-[#2b323c] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Award size={15} />
            Award Bounty
          </button>
        </div>
      </div>
    </div>
  );
}
