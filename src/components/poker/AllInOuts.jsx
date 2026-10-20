import React from 'react';
import { calcOuts, SUIT_SYMBOL, SUIT_RED, rankDisplay } from '@/lib/poker';

export default function AllInOuts({ hand, nonFolded, holeCards }) {
  if (!hand || !nonFolded || nonFolded.length < 2) return null;

  const playersWithHoles = nonFolded
    .filter((p) => holeCards && holeCards[p.id] && holeCards[p.id].length > 0)
    .map((p) => ({ ...p, hole: holeCards[p.id] }));

  if (playersWithHoles.length < 2) return null;

  const boards = [];
  if (hand.communityCards && hand.communityCards.length) {
    boards.push({ id: 'a', name: 'Board A', cards: hand.communityCards });
  }
  if ((hand.doubleBoard || (hand.runTimes && hand.runTimes >= 2)) && hand.boardB && hand.boardB.length) {
    boards.push({ id: 'b', name: 'Board B', cards: hand.boardB });
  }
  if (hand.boardC && hand.boardC.length) {
    boards.push({ id: 'c', name: 'Board C', cards: hand.boardC });
  }

  if (boards.length === 0) {
    boards.push({ id: 'a', name: 'Board A', cards: hand.communityCards || [] });
  }

  const boardResults = boards.map((b) => {
    const outs = calcOuts(playersWithHoles, b.cards, hand.variant);
    return { ...b, results: outs };
  }).filter((b) => b.results && b.results.length > 0);

  if (!boardResults.length) return null;

  const isMultiBoard = boards.length > 1;

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-3.5 space-y-3">
      <div className="flex items-center justify-between border-b border-[#2a2f37] pb-1.5">
        <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
          <span>All-in Outs</span>
          <span className="text-[10px] text-slate-400 font-normal">
            (Cards to take the lead on the next street across all active boards)
          </span>
        </span>
      </div>

      <div className="space-y-3">
        {boardResults.map((board) => (
          <div key={board.id} className="space-y-1.5">
            {isMultiBoard && (
              <div className="text-xs font-bold text-amber-400/90 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50">
                  {board.name}
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  ({board.cards.filter((c) => !c.hidden).length}/5 cards dealt)
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              {board.results.map(({ player: p, outs, count }) => (
                <div
                  key={p.id}
                  className="rounded-lg bg-[#15181d] border border-[#2a2f37] p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-white">{p.name}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        count > 0
                          ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                          : 'bg-rose-950 border border-rose-500/60 text-rose-300'
                      }`}
                    >
                      {count > 0 ? `${count} ${count === 1 ? 'out' : 'outs'}` : '0 outs'}
                    </span>
                  </div>

                  {count > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
                      {outs.map((c, i) => {
                        const isRed = SUIT_RED[c.suit];
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center justify-center gap-0.5 px-2 py-0.5 rounded bg-white text-slate-900 border border-slate-300 font-bold text-xs shadow-xs min-w-[34px] select-none"
                          >
                            <span className="font-mono text-xs">{rankDisplay(c.rank)}</span>
                            <span className={`text-xs ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
                              {SUIT_SYMBOL[c.suit]}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
