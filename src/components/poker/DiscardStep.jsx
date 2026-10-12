import React from 'react';
import { SUIT_SYMBOL, SUIT_RED, rankDisplay } from '@/lib/poker';

export default function DiscardStep({ players, holeCards, discards, onPick, onConfirm }) {
  const allPicked = players.every((p) => discards[p.id] != null);

  return (
    <div className="rounded-xl border border-[#6b4a2a] bg-[#1e2227] p-4">
      <div className="text-sm font-semibold text-amber-300 mb-1">Crazy Pineapple – discard one card per player</div>
      <div className="text-xs text-slate-400 mb-3">Pick the card each player throws away after the flop. The remaining two cards are used at showdown.</div>
      <div className="space-y-3">
        {players.map((p) => {
          const cards = holeCards[p.id] || [];
          return (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-24 text-sm text-slate-200 truncate">{p.name}</div>
              <div className="flex gap-2">
                {cards.map((c, idx) => {
                  const picked = discards[p.id] === idx;
                  const red = SUIT_RED[c.suit];
                  return (
                    <button
                      key={idx}
                      onClick={() => onPick(p.id, idx)}
                      className={`w-12 h-16 rounded-md flex flex-col items-center justify-center text-sm font-bold transition-all ${
                        picked
                          ? 'bg-rose-600/30 border-2 border-rose-500 opacity-70'
                          : 'bg-slate-100 border-2 border-transparent hover:border-amber-400'
                      }`}
                    >
                      <span className={`${red ? 'text-rose-600' : 'text-slate-900'}`}>{rankDisplay(c.rank)}{SUIT_SYMBOL[c.suit]}</span>
                      {picked && <span className="text-[9px] text-rose-300 mt-0.5">discard</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={onConfirm}
        disabled={!allPicked}
        className="mt-4 w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Confirm discards
      </button>
    </div>
  );
}
