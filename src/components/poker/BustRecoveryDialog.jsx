import React from 'react';
import { RotateCcw, Ban, UserPlus } from 'lucide-react';
import { money, rebuyBlocker } from '@/lib/poker';

// Shown when a tournament hand leaves a single player with chips but the structure
// still allows re-entries (or rebuys), so the session does not have to end.
export default function BustRecoveryDialog({ recovery, onReenter, onRebuy, onEnd }) {
  if (!recovery) return null;
  const { winner, busted = [], baseHand } = recovery;
  const format = baseHand?.tournamentFormat;
  const maxReEntries = Number(baseHand?.maxReEntries) || 0;
  const startingStack = Number(baseHand?.startingStack) || 0;
  const rebuyChips = Number(baseHand?.rebuyChips) || 0;
  const rule = (v) => (v ? money(v, baseHand?.currency || '$') : '');
  const rebuyPrice = baseHand?.rebuyPrice;
  const reentryFee = baseHand?.buyIn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#161a22] p-6 shadow-2xl flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Tournament paused</h2>
          <p className="text-sm text-slate-400 mt-1">
            <span className="text-amber-300 font-semibold">{winner?.name}</span> holds every chip in play.
            {format === 'reentry'
              ? ' This is a re-entry tournament, so a busted player can buy back in and keep the game going.'
              : ' Rebuys are allowed, so a busted player can top up and keep the game going.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {busted.map((elim) => {
            const used = Number(elim.reentries) || 0;
            const canReenter = format === 'reentry' && (maxReEntries === 0 || used < maxReEntries);
            const blocker = format === 'rebuy' ? rebuyBlocker(baseHand, elim, baseHand?.blindLevel) : null;
            const canRebuy = format === 'rebuy' && !blocker && rebuyChips > 0;
            return (
              <div key={`${elim.name}-${elim.seat}`} className="rounded-xl border border-[#2a2f37] bg-[#11141b] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">{elim.name}</span>
                  <span className="text-[11px] font-mono text-slate-500">Seat {elim.seat}</span>
                </div>

                {canReenter && (
                  <button
                    type="button"
                    onClick={() => onReenter(elim)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2"><UserPlus size={15} /> Re-enter</span>
                    <span className="font-mono text-xs font-semibold">
                      {startingStack > 0 ? `${startingStack.toLocaleString('en-US')} chips` : 'Starting stack'}
                      {reentryFee ? ` · ${rule(reentryFee)}` : ''}
                    </span>
                  </button>
                )}

                {canRebuy && (
                  <button
                    type="button"
                    onClick={() => onRebuy(elim)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2"><RotateCcw size={15} /> Rebuy</span>
                    <span className="font-mono text-xs font-semibold">
                      {rebuyChips.toLocaleString('en-US')} chips
                      {rebuyPrice ? ` · ${rule(rebuyPrice)}` : ''}
                    </span>
                  </button>
                )}

                {format === 'reentry' && !canReenter && (
                  <p className="text-[11px] text-rose-300 flex items-center gap-1.5">
                    <Ban size={12} /> All {maxReEntries} re-entries used
                  </p>
                )}
                {format === 'rebuy' && (blocker || rebuyChips <= 0) && (
                  <p className="text-[11px] text-rose-300 flex items-center gap-1.5">
                    <Ban size={12} /> Rebuy not available{blocker ? ` — ${blocker}` : ''}
                  </p>
                )}

                {canReenter && (
                  <p className="text-[10px] text-slate-500">
                    {maxReEntries === 0 ? 'Unlimited re-entries' : `${used} of ${maxReEntries} re-entries used`}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onEnd}
          className="w-full px-3 py-2 rounded-lg bg-[#242a33] hover:bg-[#2f3742] text-slate-300 text-sm font-semibold cursor-pointer transition-colors"
        >
          End tournament — {winner?.name} wins
        </button>
      </div>
    </div>
  );
}
