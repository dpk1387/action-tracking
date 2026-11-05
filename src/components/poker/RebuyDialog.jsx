import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { money } from '@/lib/poker';

export default function RebuyDialog({
  players = [],
  hand = null,
  currentLevel = 0,
  rebuyRules = null,
  rebuyChips = 10000,
  rebuyPrice = 50,
  allowAddOn = false,
  addOnChips = 15000,
  addOnPrice = 50,
  currency = '',
  onRebuy,
  onAddOn,
  onClose,
}) {
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState('rebuy');
  const sym = currency || '';

  const activeLevelNum = (currentLevel ?? hand?.blindLevel ?? 0) + 1;
  const rules = rebuyRules || hand?.rebuyRules || {};

  const timeLimitEnabled = rules.timeLimitEnabled ?? true;
  const cutoffLevel = Number(rules.timeCutoffLevel) || 4;
  const isTimeExpired = timeLimitEnabled && activeLevelNum > cutoffLevel;

  const stackCapEnabled = rules.stackCapEnabled ?? true;
  const stackCap = stackCapEnabled ? (Number(rules.stackCapAmount) || Number(rebuyChips) || 10000) : Infinity;

  const cappedEnabled = rules.cappedRebuysEnabled ?? false;
  const maxRebuys = cappedEnabled ? (Number(rules.maxRebuys) || 1) : Infinity;

  // Determine eligibility per player
  const playerEligibility = (p) => {
    if (mode === 'addon') {
      return { eligible: true, reason: null };
    }

    if (isTimeExpired) {
      return { eligible: false, reason: `Cutoff passed (Lvl ${cutoffLevel})` };
    }

    const currentStack = Number(p.stack) || 0;
    if (stackCapEnabled && currentStack > stackCap) {
      return { eligible: false, reason: `Stack > ${money(stackCap, sym)}` };
    }

    const rebuysUsed = Number(p.rebuys) || 0;
    if (cappedEnabled && rebuysUsed >= maxRebuys) {
      return { eligible: false, reason: `Max rebuys reached (${rebuysUsed}/${maxRebuys})` };
    }

    return { eligible: true, reason: null };
  };

  const list = players || [];
  const chips = mode === 'rebuy' ? rebuyChips : addOnChips;
  const price = mode === 'rebuy' ? rebuyPrice : addOnPrice;

  const selectedPlayer = list.find((p) => p.id === Number(selectedId));
  const selectedEligible = selectedPlayer ? playerEligibility(selectedPlayer).eligible : false;

  const submit = () => {
    if (!selectedId || !selectedEligible) return;
    if (mode === 'rebuy') {
      if (onRebuy) onRebuy(Number(selectedId), chips, false);
    } else {
      if (onAddOn) onAddOn(Number(selectedId), addOnChips, true);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#161a22] p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Tournament Re-buy / Add-on</h2>
            <div className="text-xs text-slate-400 mt-0.5">
              Current Level: <span className="text-emerald-400 font-bold">{activeLevelNum}</span>
              {timeLimitEnabled && (
                <span className="ml-2">
                  (Cutoff: <span className={isTimeExpired ? 'text-rose-400 font-bold' : 'text-slate-300 font-medium'}>Level {cutoffLevel}</span>)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#252c38] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex rounded-xl border border-[#2a2f37] overflow-hidden bg-[#11141b] p-1">
          <button
            onClick={() => { setMode('rebuy'); setSelectedId(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'rebuy' ? 'bg-[#3b4c3b] text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Re-buy
          </button>
          {allowAddOn && (
            <button
              onClick={() => { setMode('addon'); setSelectedId(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'addon' ? 'bg-[#3b4c3b] text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Add-on
            </button>
          )}
        </div>

        {/* Active Rules Info Banner */}
        {mode === 'rebuy' && (
          <div className="rounded-xl bg-[#12161f] border border-[#242c38] p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium">Chips & Price:</span>
              <span className="font-bold text-amber-300">
                +{money(chips, sym)} chips {price != null ? `for ${money(price, sym)}` : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1 border-t border-[#202734]">
              {timeLimitEnabled && (
                <span>
                  Time: {isTimeExpired ? <span className="text-rose-400 font-bold">Cutoff Expired</span> : `Through Lvl ${cutoffLevel}`}
                </span>
              )}
              {stackCapEnabled && (
                <span>
                  Stack: Must be ≤ <span className="text-slate-200 font-bold">{money(stackCap, sym)}</span>
                </span>
              )}
              {cappedEnabled ? (
                <span>
                  Limit: Max <span className="text-slate-200 font-bold">{maxRebuys}</span> per player
                </span>
              ) : (
                <span>Limit: Unlimited</span>
              )}
            </div>
          </div>
        )}

        {mode === 'addon' && (
          <div className="rounded-xl bg-[#12161f] border border-[#242c38] p-3 text-xs flex items-center justify-between text-slate-300">
            <span className="font-medium">Add-on amount:</span>
            <span className="font-bold text-emerald-400">
              +{money(addOnChips, sym)} chips {addOnPrice != null ? `for ${money(addOnPrice, sym)}` : ''}
            </span>
          </div>
        )}

        {isTimeExpired && mode === 'rebuy' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>Rebuys have ended because the tournament has passed Level {cutoffLevel}.</span>
          </div>
        )}

        {/* Player List */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Select Player
          </label>
          {list.length === 0 ? (
            <div className="text-sm text-slate-500 py-4 text-center">No players at table.</div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {list.map((p) => {
                const { eligible, reason } = playerEligibility(p);
                const isSelected = selectedId === p.id;
                const rebuysUsed = Number(p.rebuys) || 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!eligible}
                    onClick={() => eligible && setSelectedId(p.id)}
                    className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-[#3b4c3b] border-emerald-500 text-white shadow-md ring-1 ring-emerald-400'
                        : eligible
                        ? 'bg-[#1a202c] border-[#2a3444] text-slate-200 hover:border-emerald-600/70 hover:bg-[#202837]'
                        : 'bg-[#141820] border-[#222834] text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold truncate">{p.name}</span>
                      {cappedEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-slate-400 font-mono">
                          {rebuysUsed}/{maxRebuys} rebuys
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold tabular-nums text-slate-300">
                        {money(p.stack, sym)}
                      </span>
                      {eligible ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Eligible
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                          {reason}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={submit}
          disabled={!selectedId || !selectedEligible}
          className="w-full mt-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-extrabold text-sm py-3 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
        >
          {mode === 'rebuy' ? 'Confirm Re-buy' : 'Confirm Add-on'}
        </button>
      </div>
    </div>
  );
}
