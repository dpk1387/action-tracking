import React, { useState, useEffect } from 'react';
import { money, parseCards, evaluateWinners, variantRanks, effectiveHoleSize, holeCardsComplete } from '@/lib/poker';

export default function EndHandDialog({ hand, pots, holeCards, onHoleChange, onAward, onClose }) {
  const variant = hand.variant || 'nlh';
  const holeSize = effectiveHoleSize(hand);
  const nonFolded = hand.players.filter((p) => p.status !== 'folded');
  const doubleBoard = !!hand.doubleBoard;
  const boardB = hand.boardB || [];
  const [text, setText] = useState(() => {
    const init = {};
    nonFolded.forEach((p) => {
      if (holeCards[p.id]) init[p.id] = holeCards[p.id].map((c) => c.rank + c.suit).join(' ');
    });
    return init;
  });
  const [winnersA, setWinnersA] = useState({});
  const [winnersB, setWinnersB] = useState({});

  useEffect(() => {
    setWinnersA((prev) => {
      const next = {};
      pots.forEach((pot, i) => {
        if (pot.eligible.length === 1) { next[i] = [pot.eligible[0]]; return; }
        const auto = evaluateWinners(pot.eligible, holeCards, hand.communityCards, variant, holeSize);
        if (auto) next[i] = auto;
        else if (prev[i] && prev[i].length) next[i] = prev[i];
      });
      return next;
    });
    if (doubleBoard) {
      setWinnersB((prev) => {
        const next = {};
        pots.forEach((pot, i) => {
          if (pot.eligible.length === 1) { next[i] = [pot.eligible[0]]; return; }
          const auto = evaluateWinners(pot.eligible, holeCards, boardB, variant, holeSize);
          if (auto) next[i] = auto;
          else if (prev[i] && prev[i].length) next[i] = prev[i];
        });
        return next;
      });
    }
  }, [pots, holeCards, hand.communityCards, boardB, variant, doubleBoard, holeSize]);

  const onText = (pid, val) => {
    setText((prev) => ({ ...prev, [pid]: val }));
    const parsed = parseCards(val, variantRanks(variant));
    if (!parsed.error && holeCardsComplete(hand, parsed.cards)) onHoleChange(pid, parsed.cards);
    else onHoleChange(pid, null);
  };

  const canAward = pots.every((_, i) => (winnersA[i] && winnersA[i].length > 0) && (!doubleBoard || (winnersB[i] && winnersB[i].length > 0)));

  const toggle = (which, i, pid) => {
    const set = which === 'a' ? setWinnersA : setWinnersB;
    set((prev) => {
      const cur = prev[i] || [];
      const arr = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid];
      return { ...prev, [i]: arr };
    });
  };

  const placeholder = 'e.g. ' + ['As', 'Kd', 'Qh', '2c', '3s', '4d'].slice(0, Math.max(2, holeSize)).join(' ');

  const renderEligible = (pot, i, which, board) => {
    const auto = pot.eligible.length > 1 && evaluateWinners(pot.eligible, holeCards, board, variant, holeSize);
    const sel = (which === 'a' ? winnersA : winnersB)[i] || [];
    return (
      <div>
        {doubleBoard && <div className="text-xs text-slate-500 mb-1">{which === 'a' ? 'Board A' : 'Board B'}{auto ? ' – auto' : ''}</div>}
        <div className="flex flex-wrap gap-2">
          {pot.eligible.map((pid) => {
            const p = hand.players.find((pl) => pl.id === pid);
            const selected = sel.includes(pid);
            return (
              <button key={pid} onClick={() => !auto && toggle(which, i, pid)} disabled={!!auto}
                className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${selected ? 'bg-[#4a5a4a] border-[#7fae7f] text-white' : 'bg-[#1e2227] border-[#2a2f37] text-slate-300 hover:border-[#4a5a4a]'} ${auto ? 'cursor-default' : ''}`}>
                {p?.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-1">Award pots – Hand #{hand.handNumber}</h2>
        <div className="text-xs text-slate-400 mb-4">Enter hole cards to auto-determine winners, then verify and award. (Use T for ten.)</div>
        <div className="space-y-2 mb-4">
          {nonFolded.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="w-24 text-sm text-slate-200 truncate">{p.name}</div>
              <input value={text[p.id] || ''} onChange={(e) => onText(p.id, e.target.value)} placeholder={placeholder} className="flex-1 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#4a5a4a]" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {pots.map((pot, i) => (
            <div key={i} className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-300">{i === 0 ? 'Main pot' : `Side pot ${i}`}{doubleBoard ? ' (split across boards)' : ''}</span>
                <span className="text-sm font-semibold text-white">{money(pot.amount, hand.currency)}</span>
              </div>
              <div className={doubleBoard ? 'space-y-2' : ''}>
                {renderEligible(pot, i, 'a', hand.communityCards)}
                {doubleBoard && renderEligible(pot, i, 'b', boardB)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm py-2.5">Cancel</button>
          <button onClick={() => canAward && onAward(winnersA, { winnersB: doubleBoard ? winnersB : undefined, holeCards })} disabled={!canAward} className="flex-1 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-30">Award pots</button>
        </div>
      </div>
    </div>
  );
}
