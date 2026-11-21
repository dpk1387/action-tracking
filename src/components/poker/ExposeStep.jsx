import React, { useMemo, useState } from 'react';
import { parseCards, rankDisplay, SUIT_RED, SUIT_SYMBOL } from '@/lib/poker';

/**
 * Pirate Poker: everyone's hole cards go in, then each player taps one of their
 * two cards to expose it. The exposed card stays public for the rest of the hand.
 */
export default function ExposeStep({ players, holeCards, exposed, onCards, onPick, onConfirm }) {
  const [text, setText] = useState(() => {
    const init = {};
    players.forEach((p) => {
      const cards = holeCards[p.id] || [];
      init[p.id] = cards.map((c) => c.rank + c.suit).join(' ');
    });
    return init;
  });
  const [error, setError] = useState('');

  const ready = useMemo(
    () => players.length >= 2 && players.every((p) => {
      const cards = holeCards[p.id] || [];
      return cards.length >= 2 && exposed[p.id] != null;
    }),
    [players, holeCards, exposed],
  );

  const handleText = (pid, value) => {
    setText((prev) => ({ ...prev, [pid]: value }));
    const { cards, error: perr } = parseCards(value);
    if (perr) { setError(perr); return; }
    setError('');
    onCards(pid, cards && cards.length ? cards : null);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-3">
      <div className="w-full max-w-md rounded-xl border border-amber-600/60 bg-[#1e2227] p-4 shadow-2xl" data-testid="expose-step">
        <div className="text-sm font-semibold text-amber-300 mb-1">Pirate Poker – expose one card per player</div>
        <div className="text-xs text-slate-400 mb-3">Enter each player's hole cards, then tap the card they turn face up. It stays public for the whole hand.</div>
        <div className="space-y-3 max-h-[55vh] overflow-y-auto">
          {players.map((p) => {
            const cards = holeCards[p.id] || [];
            return (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-20 shrink-0 text-sm text-slate-200 truncate">{p.name}</div>
                <input
                  value={text[p.id] ?? ''}
                  onChange={(e) => handleText(p.id, e.target.value)}
                  placeholder="Ah Kd"
                  className="w-24 rounded-md bg-[#12161c] border border-slate-700 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-500 outline-none"
                  data-testid={`expose-input-${p.id}`}
                />
                <div className="flex gap-1.5">
                  {cards.slice(0, 2).map((c, idx) => {
                    const picked = exposed[p.id] === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onPick(p.id, idx)}
                        data-testid={`expose-card-${p.id}-${idx}`}
                        className={`w-11 h-14 rounded-md flex flex-col items-center justify-center text-sm font-bold transition-all cursor-pointer ${
                          picked ? 'bg-amber-500/30 border-2 border-amber-400 ring-1 ring-amber-400/60' : 'bg-slate-100 border-2 border-transparent hover:border-amber-400'
                        }`}
                      >
                        <span className={SUIT_RED[c.suit] ? 'text-rose-600' : 'text-slate-900'}>
                          {rankDisplay(c.rank)}{SUIT_SYMBOL[c.suit]}
                        </span>
                        {picked && <span className="text-[9px] text-amber-200">exposed</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready}
          data-testid="expose-confirm"
          className="mt-4 w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Confirm exposes
        </button>
      </div>
    </div>
  );
}
