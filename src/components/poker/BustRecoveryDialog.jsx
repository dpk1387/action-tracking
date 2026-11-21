import React from 'react';
import { RotateCcw, Ban, UserPlus } from 'lucide-react';
import { money } from '@/lib/poker';
import { buildBustRecovery } from '@/lib/bustRecovery';

// Shown when a hand leaves a single player with chips but the game can continue:
// cash games always allow a buy-back, tournaments follow their re-entry / rebuy setup.
export default function BustRecoveryDialog({ recovery, onReenter, onRebuy, onEnd }) {
  if (!recovery) return null;
  const { winner, busted = [], baseHand } = recovery;
  const plan = recovery.plan || buildBustRecovery(baseHand, busted);
  const isCash = plan.format === 'cash';
  const rule = (v) => (v ? money(v, baseHand?.currency || '$') : '');
  const rebuyPrice = baseHand?.rebuyPrice;
  const reentryFee = baseHand?.buyIn;

  const heading = isCash ? 'Hand paused — player busted' : 'Tournament paused';
  const blurb = isCash
    ? `Only ${winner?.name || 'one player'} has chips left. Buy the busted player back in to keep the game going.`
    : plan.format === 'reentry'
      ? `${winner?.name || 'One player'} holds every chip in play. This is a re-entry tournament, so a busted player can buy back in and keep the game going.`
      : plan.format === 'rebuy'
        ? `${winner?.name || 'One player'} holds every chip in play. Rebuys are allowed, so a busted player can top up and keep the game going.`
        : `${winner?.name || 'One player'} holds every chip in play.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" data-testid="bust-recovery">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#161a22] p-6 shadow-2xl flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">{heading}</h2>
          <p className="text-sm text-slate-400 mt-1">{blurb}</p>
        </div>

        <div className="flex flex-col gap-2">
          {plan.offers.map((offer) => {
            const { elim } = offer;
            const used = Number(elim.reentries) || 0;
            const Icon = offer.kind === 'reentry' ? UserPlus : RotateCcw;
            return (
              <div key={`${elim.name}-${elim.seat}`} className="rounded-xl border border-[#2a2f37] bg-[#11141b] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">{elim.name}</span>
                  <span className="text-[11px] font-mono text-slate-500">Seat {elim.seat}</span>
                </div>

                {offer.allowed && (
                  <button
                    type="button"
                    data-testid={`recovery-${offer.kind}-${elim.seat}`}
                    onClick={() => (offer.kind === 'reentry' ? onReenter(elim) : onRebuy(elim))}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-white text-sm font-bold cursor-pointer transition-colors ${
                      offer.kind === 'reentry' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'
                    }`}
                  >
                    <span className="flex items-center gap-2"><Icon size={15} /> {offer.label}</span>
                    <span className="font-mono text-xs font-semibold">
                      {offer.chips > 0 ? `${offer.chips.toLocaleString('en-US')} chips` : 'Starting stack'}
                      {offer.kind === 'reentry' && reentryFee ? ` · ${rule(reentryFee)}` : ''}
                      {offer.kind === 'rebuy' && rebuyPrice ? ` · ${rule(rebuyPrice)}` : ''}
                    </span>
                  </button>
                )}

                {!offer.allowed && (
                  <p className="text-[11px] text-rose-300 flex items-center gap-1.5" data-testid={`recovery-blocked-${elim.seat}`}>
                    <Ban size={12} /> {offer.label === 'No re-entry' ? offer.blocker : `${offer.label} not available${offer.blocker ? ` — ${offer.blocker}` : ''}`}
                  </p>
                )}

                {offer.allowed && offer.kind === 'reentry' && (
                  <p className="text-[10px] text-slate-500">
                    {plan.maxReEntries === 0 ? 'Unlimited re-entries' : `${used} of ${plan.maxReEntries} re-entries used`}
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
          {isCash ? 'End session' : 'End tournament'} — {winner?.name} wins
        </button>
      </div>
    </div>
  );
}
