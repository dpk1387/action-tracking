import React, { useState, useEffect } from 'react';
import { parseCards, variantRanks, effectiveHoleSize, holeCardsComplete } from '@/lib/poker';

export default function AllInEquity({ hand, nonFolded, holeCards, onHoleChange }) {
  const variant = hand.variant || 'nlh';
  const holeSize = effectiveHoleSize(hand);
  const [text, setText] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    const init = {};
    nonFolded.forEach((p) => {
      if (holeCards[p.id]) init[p.id] = holeCards[p.id].map((c) => c.rank + c.suit).join(' ');
    });
    setText(init);
    setError('');
  }, [nonFolded.map((p) => p.id).join(',')]);

  const onText = (pid, val) => {
    setText((prev) => ({ ...prev, [pid]: val }));
    const { cards, error: perr } = parseCards(val, variantRanks(variant));
    if (perr) { setError(perr); return; }
    setError('');
    onHoleChange(pid, holeCardsComplete(hand, cards) ? cards : null);
  };

  const placeholder = 'e.g. ' + ['As', 'Kd', 'Qh', '2c', '3s', '4d'].slice(0, Math.max(2, holeSize)).join(' ');

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">Showdown – enter hole cards ({holeSize} each)</div>
        <div className="text-xs text-slate-400">{hand.communityCards.filter((c) => !c.hidden).length}/5 board – winners auto-determined</div>
      </div>
      <div className="space-y-2">
        {nonFolded.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className={`w-28 text-sm truncate ${p.status === 'allin' ? 'text-rose-300' : 'text-slate-200'}`}>{p.name}</div>
            <input
              value={text[p.id] || ''}
              onChange={(e) => onText(p.id, e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#4a5a4a]"
            />
          </div>
        ))}
      </div>
      {error && <div className="text-sm text-rose-400 mt-2">{error}</div>}
    </div>
  );
}
