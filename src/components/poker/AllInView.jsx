import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  money,
  formatSidePotAmount,
  SUIT_SYMBOL,
  SUIT_RED,
  rankDisplay,
  variantMeta,
  calculateAllInOuts,
  positionForSeat,
  getButtonIndex,
  STREET_LABEL,
  calcEquity,
} from '@/lib/poker';

const POSITION_ORDER = {
  'SB': 1,
  'BB': 2,
  'D/SB': 1,
  'UTG': 3,
  'UTG+1': 4,
  'UTG+2': 5,
  'UTG+3': 6,
  'LJ': 7,
  'HJ': 8,
  'CO': 9,
  'BTN': 10,
  'D': 10,
};

function OutCard({ card }) {
  if (!card) return null;
  const red = SUIT_RED[card.suit];
  return (
    <div
      className={`inline-flex items-center justify-center gap-0.5 px-1 py-0.5 min-w-[26px] h-[17px] rounded border border-slate-300 bg-white shadow-sm text-[10px] font-bold leading-none select-none shrink-0 ${
        red ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span>{rankDisplay(card.rank)}</span>
      <span className="text-[9px] leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function AllInHoleCard({ card }) {
  if (!card) return null;
  const red = SUIT_RED[card.suit];
  return (
    <div
      className={`inline-flex items-center justify-center gap-0.5 px-1 py-0.5 min-w-[34px] h-[22px] rounded bg-white border border-slate-300 shadow-sm select-none shrink-0 ${
        red ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span className="font-bold text-[11px] leading-none">{rankDisplay(card.rank)}</span>
      <span className="text-[10px] leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function AllInBoardCard({ card, anim, delay, style }) {
  if (!card || card.hidden) {
    return (
      <div className="w-9 h-12 rounded-lg border-2 border-dashed border-slate-700/80 bg-[#171c23]/60 flex items-center justify-center">
        <span className="text-slate-600 text-[10px] font-bold">·</span>
      </div>
    );
  }
  const red = SUIT_RED[card.suit];
  const animClass = anim || '';
  return (
    <div
      className={`relative w-9 h-12 rounded-lg ${animClass}`}
      style={{ transformStyle: 'preserve-3d', animationDelay: `${delay || 0}s`, ...style }}
    >
      <div
        className="absolute inset-0 rounded-lg bg-[#3a4a3a] border border-[#4a5a4a] flex items-center justify-center"
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
      >
        <span className="text-[#7fae7f] text-[10px]">?</span>
      </div>
      <div
        className={`absolute inset-0 rounded-lg bg-white border border-slate-300 flex flex-col items-center justify-center font-bold shadow-lg select-none shrink-0 ${
          red ? 'text-rose-600' : 'text-slate-900'
        }`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        <span className="text-[11px] leading-none">{rankDisplay(card.rank)}</span>
        <span className="text-xs leading-none mt-0.5">{SUIT_SYMBOL[card.suit]}</span>
      </div>
    </div>
  );
}

function formatEquity(v) {
  if (v == null) return '—';
  if (v <= 0) return '0%';
  if (v < 0.5) return '<1%';
  if (v < 1) return '<1%';
  if (v >= 99.5) return '>99%';
  if (v > 99) return '>99%';
  return `${Math.round(v)}%`;
}

export default function AllInView({
  hand,
  holeCards = {},
  equity = null,
  sidePots = [],
  pot = 0,
  positions = [],
  onToggleClassic,
}) {
  const cur = hand?.currency || '';
  const n = hand?.players?.length || 0;
  const buttonIdx = getButtonIndex(hand);

  const contestants = useMemo(() => {
    if (!hand?.players) return [];
    const nonFolded = hand.players.filter((p) => p.status !== 'folded');

    return nonFolded.map((p) => {
      const idx = hand.players.findIndex((x) => x.id === p.id);
      const posLabel = positions[idx] || positionForSeat(n, buttonIdx, idx) || '';
      const order = POSITION_ORDER[posLabel] ?? 99;
      const isAtRisk = p.status === 'allin' || p.stack <= 0 || p._wasCapped;
      return {
        player: p,
        position: posLabel,
        posOrder: order,
        isAtRisk,
      };
    });
  }, [hand, positions, n, buttonIdx]);

  const sortedContestants = useMemo(() => {
    return [...contestants].sort((a, b) => a.posOrder - b.posOrder);
  }, [contestants]);

  const totalPot = useMemo(() => {
    if (pot > 0) return pot;
    return (hand?.players || []).reduce((s, p) => s + (p.totalBet || 0), 0);
  }, [pot, hand]);

  const computedEquity = useMemo(() => {
    if (equity?.byId) return equity;
    if (!hand || !holeCards) return null;
    const holes = contestants.map((c) => holeCards[c.player.id]);
    if (holes.some((h) => !h || !h.length)) return null;
    const variant = hand.variant || 'nlh';
    const iters = 5000;
    try {
      const res = calcEquity(holes, hand.communityCards || [], iters, variant);
      const byId = {};
      contestants.forEach((c, i) => {
        byId[c.player.id] = res.results[i].win;
      });
      return { byId, split: res.split };
    } catch {
      return null;
    }
  }, [equity, hand, holeCards, contestants]);

  const allInOuts = useMemo(() => {
    return calculateAllInOuts(hand, holeCards);
  }, [hand, holeCards]);

  const boardLen = (hand?.communityCards || []).filter((c) => c && !c.hidden).length;

  const outsByPlayerId = useMemo(() => {
    const map = {};
    if (allInOuts && allInOuts.length) {
      allInOuts.forEach((entry) => {
        map[entry.player.id] = entry.outs;
      });
    }
    return map;
  }, [allInOuts]);

  // Dealing animation for board cards
  const seenRef = useRef({});
  const boardLenRef = useRef(-1);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => { seenRef.current = {}; boardLenRef.current = -1; }, [hand?.handNumber]);

  useEffect(() => {
    const total = (hand?.communityCards || []).filter((c) => c && !c.hidden).length;
    if (boardLenRef.current >= 0 && total > boardLenRef.current) {
      setAnimKey((k) => k + 1);
    }
    boardLenRef.current = total;
  }, [hand?.communityCards, hand?.boardB, hand?.doubleBoard]);

  const animateBoard = (board) => {
    if (!board) return [];
    return board.map((c, i) => {
      const key = c && !c.hidden ? (c.rank + c.suit) : `slot-${i}`;
      if (!key || seenRef.current[key]) return null;
      seenRef.current[key] = true;
      if (i < 3) {
        const offsets = ['-18%', '0%', '18%'];
        return { anim: 'deal-flop-full', delay: 0.3 + i * 0.18, style: { '--flop-offset': offsets[i] } };
      }
      return { anim: 'deal-turn-river-full', delay: 0.3 };
    });
  };

  const boardAnim = animateBoard(hand?.communityCards || []);

  return (
    <div className="relative w-full min-h-[490px] h-[520px] rounded-[2rem] border-2 border-[#364536] bg-gradient-to-b from-[#14181e] via-[#111419] to-[#0c0f13] overflow-hidden p-4 flex flex-col justify-between shadow-2xl select-none">
      <div className="absolute inset-4 rounded-[1.6rem] border border-[#273229]/50 pointer-events-none bg-[#182318]/10" />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-600/80 text-rose-300 font-extrabold text-[11px] uppercase tracking-wider shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            All-In Showdown
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            Street: <span className="text-emerald-400 font-bold">{STREET_LABEL[hand?.street] || 'Preflop'}</span>
          </span>
        </div>
        {onToggleClassic && (
          <button
            type="button"
            onClick={onToggleClassic}
            className="text-[10px] font-semibold text-slate-400 hover:text-white bg-[#202630] border border-[#2d3644] px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          >
            Classic Table
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-row gap-3 items-stretch mt-2 min-h-0">
        {/* Left: Player tags with outs immediately to the right of each tag */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0 overflow-y-auto">
          {sortedContestants.map((item) => {
            const p = item.player;
            const eqVal = computedEquity?.byId?.[p.id];
            const isAtRisk = item.isAtRisk;
            const cards = holeCards[p.id] || [];
            const myOuts = outsByPlayerId[p.id];
            const hasZeroOuts = myOuts && myOuts.length === 0;

            return (
              <div key={p.id} className="flex items-stretch gap-2">
                {/* Compact player tag */}
                <div
                  className={`rounded-lg border-2 overflow-hidden shadow-lg transition-all shrink-0 ${
                    isAtRisk
                      ? 'border-rose-500/80 bg-[#2d1215]/90 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                      : 'border-[#2f3846] bg-[#161a22]'
                  }`}
                >
                  {/* Row 1: name | hole cards | equity */}
                  <div className="grid grid-cols-[1fr_1.5fr_1fr] h-10 divide-x divide-slate-700/50 items-center">
                    <div className="px-2 truncate">
                      <div className="font-bold text-[11px] text-white truncate leading-tight">
                        {p.name}
                      </div>
                    </div>
                    <div className="px-1 flex items-center justify-center gap-1 h-full">
                      {cards.map((c, j) => (
                        <AllInHoleCard key={j} card={c} />
                      ))}
                    </div>
                    <div className="px-1.5 flex items-center justify-end h-full">
                      <span className="font-black font-mono text-base text-emerald-400 drop-shadow">
                        {formatEquity(eqVal)}
                      </span>
                    </div>
                  </div>
                  {/* Row 2: stack | all in | position */}
                  <div className="grid grid-cols-[1fr_1fr_1fr] h-5 divide-x divide-slate-700/50 items-center bg-black/30">
                    <div className="px-2 font-mono text-[10px] text-slate-400 truncate">
                      {p.status === 'allin' || p.stack <= 0 ? '-' : money(p.stack, cur)}
                    </div>
                    <div className="px-1 flex items-center justify-center font-bold text-[9px] uppercase tracking-wider">
                      {p.status === 'allin' ? (
                        <span className="text-rose-400 font-extrabold">All In</span>
                      ) : null}
                    </div>
                    <div className="px-1.5 flex items-center justify-end font-bold text-slate-300 text-[10px] tracking-wider">
                      {item.position || ''}
                    </div>
                  </div>
                </div>

                {/* Outs immediately right of the player tag — hidden when 0 outs */}
                {hasZeroOuts ? null : (
                  <div className="flex-1 min-w-0 rounded-lg border border-slate-700/50 bg-[#161a22]/80 px-2 py-1 flex flex-col justify-center overflow-hidden">
                    {boardLen >= 5 ? (
                      <span className="text-[10px] text-slate-500">River complete</span>
                    ) : !myOuts ? (
                      <span className="text-[10px] text-slate-500">
                        {boardLen < 3 ? 'Waiting for flop' : 'Tied or ahead'}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-0.5 overflow-hidden">
                        <span className="text-[10px] font-bold text-amber-300 mr-1 shrink-0">
                          {myOuts.length}
                        </span>
                        {myOuts.slice(0, 16).map((card) => (
                          <OutCard key={card.rank + card.suit} card={card} />
                        ))}
                        {myOuts.length > 16 && (
                          <span className="text-[10px] text-slate-400">+{myOuts.length - 16}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Board + Pot */}
        <div className="flex flex-col justify-end items-end gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Board</span>
              <span className="text-[11px] font-bold text-emerald-400">
                {STREET_LABEL[hand?.street] || 'Preflop'}
              </span>
            </div>
            <div className="relative flex gap-1.5">
              {animKey > 0 && (
                <div
                  key={`burn-${animKey}`}
                  className="burn-card absolute left-0 top-0 w-9 h-12 rounded-lg bg-[#3a4a3a] border border-[#4a5a4a] flex items-center justify-center pointer-events-none z-10"
                >
                  <span className="text-[#7fae7f] text-[10px]">?</span>
                </div>
              )}
              {[0, 1, 2, 3, 4].map((i) => (
                <AllInBoardCard
                  key={i}
                  card={hand?.communityCards?.[i]}
                  anim={boardAnim[i]?.anim}
                  delay={boardAnim[i]?.delay}
                  style={boardAnim[i]?.style}
                />
              ))}
            </div>
            {hand?.doubleBoard && (
              <div className="flex gap-1.5 mt-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <AllInBoardCard key={`b${i}`} card={(hand?.boardB || [])[i]} />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end rounded-xl border border-[#2a3442] bg-[#161d26]/95 px-4 py-2 shadow-xl min-w-[180px]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total Pot</div>
            <div className="text-2xl font-black text-white font-mono drop-shadow">{money(totalPot, cur)}</div>
            {sidePots.length > 0 && (
              <div className="text-[11px] text-amber-300 font-semibold mt-0.5">
                Side pots: {sidePots.map((sp) => formatSidePotAmount(sp.amount, cur)).join(' / ')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
