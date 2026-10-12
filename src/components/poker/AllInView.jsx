import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  money,
  formatSidePotAmount,
  formatPlayerTagAmount,
  formatBetAmount,
  SUIT_SYMBOL,
  SUIT_RED,
  rankDisplay,
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

function raiseLabelLocal(level) {
  if (!level || level <= 1) return 'Bet';
  if (level === 2) return 'Raise';
  return `${level}-bet`;
}

function OutCard({ card }) {
  if (!card) return null;
  const red = SUIT_RED[card.suit];
  return (
    <div
      className={`inline-flex items-center justify-center gap-0.5 px-1 py-0.5 min-w-[23px] h-[18px] rounded border border-slate-300 bg-white shadow-xs text-[9px] font-bold leading-none select-none shrink-0 ${
        red ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span>{rankDisplay(card.rank)}</span>
      <span className="text-[8px] leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function AllInHoleCard({ card, animate, highlight }) {
  if (!card) return null;
  const red = SUIT_RED[card.suit];
  const isHl = highlight && highlight.has(card.rank + card.suit);
  const ring = isHl ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e2227] shadow-[0_0_8px_rgba(52,211,153,0.8)]' : '';
  return (
    <div
      className={`inline-flex items-center justify-center gap-0.5 px-1 py-0.5 min-w-[28px] h-[20px] rounded bg-white border border-slate-300 shadow-sm select-none shrink-0 ${
        red ? 'text-rose-600' : 'text-slate-900'
      } ${ring} ${animate ? 'hole-card-flip' : ''}`}
    >
      <span className="font-bold text-[10px] leading-none">{rankDisplay(card.rank)}</span>
      <span className="text-[9px] leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function AllInBoardCard({ card, anim, delay, style, highlight }) {
  if (!card || card.hidden) {
    return (
      <div className="w-10 h-14 rounded-lg border-2 border-dashed border-slate-700/80 bg-[#171c23]/60 flex items-center justify-center">
        <span className="text-slate-600 text-xs font-bold">·</span>
      </div>
    );
  }
  const red = SUIT_RED[card.suit];
  const animClass = anim || '';
  const isHl = highlight && highlight.has(card.rank + card.suit);
  const ring = isHl ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e2227] shadow-[0_0_12px_rgba(52,211,153,0.8)]' : '';
  return (
    <div
      className={`w-10 h-14 rounded-lg bg-white border border-slate-300 flex flex-col items-center justify-center font-bold shadow-lg select-none shrink-0 ${
        red ? 'text-rose-600' : 'text-slate-900'
      } ${ring} ${animClass}`}
      style={{ animationDelay: `${delay || 0}s`, ...style }}
    >
      <span className="text-xs leading-none">{rankDisplay(card.rank)}</span>
      <span className="text-sm leading-none mt-0.5">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function formatEquity(v, isSecured = false) {
  if (v == null) return '—';
  if (isSecured || v >= 100) return '100%';
  if (v <= 0) return '0%';
  if (v < 0.5 || v < 1) return '<1%';
  if (v >= 99.5 || v > 99) {
    if (isSecured) return '100%';
    return '>99%';
  }
  return `${Math.round(v)}%`;
}

function getPlayerLastActionText(player, currency) {
  if (!player) return 'Waiting';
  if (player.status === 'folded') return 'Fold';
  const la = player.lastAction;
  if (!la) {
    if (player.status === 'allin') return 'All-in';
    return 'Waiting';
  }
  const amt = la.amount != null ? formatBetAmount(la.amount, currency) : '';
  switch (la.type) {
    case 'fold': return 'Fold';
    case 'check': return 'Check';
    case 'allin': return amt ? `All-in ${amt}` : 'All-in';
    case 'call': return amt ? `Call ${amt}` : 'Call';
    case 'bet':
    case 'raise': {
      const lbl = raiseLabelLocal(la.raiseLevel);
      return amt ? `${lbl} ${amt}` : lbl;
    }
    case 'sb': return amt ? `SB ${amt}` : 'SB';
    case 'bb': return amt ? `BB ${amt}` : 'BB';
    case 'straddle': return amt ? `Straddle ${amt}` : 'Straddle';
    case 'kill': return amt ? `Kill ${amt}` : 'Kill';
    default: return String(la.type || 'Waiting');
  }
}

export default function AllInView({
  hand,
  holeCards = {},
  equity = null,
  sidePots = [],
  pot = 0,
  positions = [],
  highlightKeys = null,
  winningPlayerIds = new Set(),
  onToggleClassic,
  hideAmounts = false,
  stackVisibleIds = null,
  alwaysShow = false,
  showPot = undefined,
  clockSecondsLeft = null,
  clockActive = false,
  clockType = null,
  onUseTimeBank = null,
}) {
  const cur = hand?.currency || '';
  const n = hand?.players?.length || 0;
  const buttonIdx = getButtonIndex(hand);

  const stackShown = (p) => (alwaysShow ? true : (stackVisibleIds ? stackVisibleIds.has(p.id) : !hideAmounts));
  const potShown = showPot !== undefined ? showPot : !hideAmounts;

  // Check if there is an actual all-in situation in progress
  const isAllIn = useMemo(() => {
    if (!hand?.players) return false;
    const nonFolded = hand.players.filter((p) => p.status !== 'folded');
    return nonFolded.some((p) => p.status === 'allin' || p.stack <= 0);
  }, [hand]);

  // List of players to display
  const contestants = useMemo(() => {
    if (!hand?.players) return [];

    // If it's an all-in situation, show non-folded contenders.
    // If it's NOT an all-in situation, show all players in order of position.
    const playersToInclude = isAllIn
      ? hand.players.filter((p) => p.status !== 'folded')
      : hand.players;

    return playersToInclude.map((p) => {
      const idx = hand.players.findIndex((x) => x.id === p.id);
      const posLabel = positions[idx] || positionForSeat(n, buttonIdx, idx) || '';
      const order = POSITION_ORDER[posLabel] ?? 99;
      const isAtRisk = (p.status === 'allin' || p.stack <= 0) &&
        !hand.players.some((o) => o.status !== 'folded' && o.status !== 'allin' && (o.initialStack - o.stack) >= (p.initialStack - p.stack));
      return {
        player: p,
        position: posLabel,
        posOrder: order,
        isAtRisk,
      };
    });
  }, [hand, positions, n, buttonIdx, isAllIn]);

  const sortedContestants = useMemo(() => {
    return [...contestants].sort((a, b) => a.posOrder - b.posOrder);
  }, [contestants]);

  const totalPot = useMemo(() => {
    if (pot > 0) return pot;
    return (hand?.players || []).reduce((s, p) => s + (p.totalBet || 0), 0);
  }, [pot, hand]);

  const computedEquity = useMemo(() => {
    if (!isAllIn) return null;
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
  }, [equity, hand, holeCards, contestants, isAllIn]);

  const allInOuts = useMemo(() => {
    if (!isAllIn) return [];
    return calculateAllInOuts(hand, holeCards);
  }, [hand, holeCards, isAllIn]);

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

  // Dealing animations for board cards
  const seenRef = useRef({});
  const boardLenRef = useRef(-1);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    seenRef.current = {};
    boardLenRef.current = -1;
  }, [hand?.handNumber]);

  useEffect(() => {
    const total = (hand?.communityCards || []).filter((c) => c && !c.hidden).length +
      (hand?.doubleBoard ? (hand?.boardB || []).filter((c) => c && !c.hidden).length : 0);
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
        const offsets = ['-22%', '0%', '22%'];
        return { anim: 'deal-flop-full', delay: 0.3 + i * 0.2, style: { '--flop-offset': offsets[i] } };
      }
      return { anim: 'deal-turn-river-full', delay: 0.3 };
    });
  };

  const boardAnim = animateBoard(hand?.communityCards || []);

  return (
    <div className="relative w-full min-h-[480px] rounded-[2rem] border-2 border-[#364536] bg-gradient-to-b from-[#14181e] via-[#111419] to-[#0c0f13] overflow-hidden p-4 flex flex-col justify-between shadow-2xl select-none">
      <div className="absolute inset-4 rounded-[1.6rem] border border-[#273229]/50 pointer-events-none bg-[#182318]/10" />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-600/80 text-rose-300 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(244,63,94,0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            All-In View
          </span>
          <span className="text-xs font-semibold text-slate-400">
            Street: <span className="text-emerald-400 font-bold">{STREET_LABEL[hand?.street] || 'Preflop'}</span>
          </span>
          {computedEquity && computedEquity.split > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300 ml-1">
              <span>Split:</span>
              <span className="font-mono text-amber-200">{formatEquity(computedEquity.split)}</span>
            </span>
          )}
        </div>
        {onToggleClassic && (
          <button
            type="button"
            onClick={onToggleClassic}
            className="text-xs font-semibold text-slate-300 hover:text-white bg-[#202630] hover:bg-[#2d3644] border border-[#364536] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            Table View
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row gap-4 items-stretch mt-3 min-h-0">
        {/* Left: Player tags with outs positioned immediately to the right */}
        <div className="flex flex-col gap-2.5 flex-1 min-w-0 overflow-y-auto pr-1">
          {sortedContestants.map((item) => {
            const p = item.player;
            const eqVal = computedEquity?.byId?.[p.id];
            const isAtRisk = item.isAtRisk;
            const cards = holeCards[p.id] || [];
            const myOuts = outsByPlayerId[p.id];
            const hasZeroOuts = myOuts && myOuts.length === 0;
            const isFolded = p.status === 'folded';
            const isWinner = Boolean(
              winningPlayerIds?.has?.(p.id) ||
              hand?.winners?.some?.((w) => w.playerId === p.id)
            );
            const lastActionText = getPlayerLastActionText(p, cur);

            // Determine if player has secured the pot (all opponents have <= 0 equity or is confirmed winner)
            const otherContestants = contestants.filter((c) => c.player.status !== 'folded' && c.player.id !== p.id);
            const othersZeroEq = otherContestants.length > 0 && otherContestants.every((o) => {
              const oEq = computedEquity?.byId?.[o.player.id];
              return oEq == null || oEq <= 0.05;
            });
            const isSecured = isWinner || (eqVal != null && eqVal >= 99 && othersZeroEq) || (eqVal != null && eqVal >= 100);

            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2.5 w-full">
                {/* Properly sized Player Tag - ample space, no ellipsis (...) truncation */}
                {/* Properly sized Player Tag - strictly aligned columns: position, names, actions, hole cards, stacks, equity */}
                <div
                  className={`h-9 px-3 rounded-lg border grid grid-cols-[38px_144px_120px_66px_90px_54px] items-center gap-2 shadow-md shrink-0 w-[560px] sm:w-[600px] transition-all ${
                    isWinner
                      ? 'border-emerald-500 bg-[#122e1b] ring-2 ring-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.35)]'
                      : isFolded
                      ? 'border-[#2a2f37] bg-[#15181d]/50 opacity-40'
                      : isAtRisk
                      ? 'border-rose-500/80 bg-[#2d1215]/95 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                      : 'border-[#2f3846] bg-[#161a22]'
                  }`}
                >
                  {/* 1. Position */}
                  <div className="flex items-center justify-center">
                    <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] font-bold text-slate-300 uppercase shrink-0">
                      {item.position || '—'}
                    </span>
                  </div>

                  {/* 2. Names & Badges */}
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="font-bold text-sm text-white truncate" title={p.name}>
                      {p.name}
                    </span>
                    {isWinner && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 border border-emerald-400/70 text-[9px] font-black text-emerald-300 uppercase shrink-0 animate-pulse">
                        WIN
                      </span>
                    )}
                    {isFolded && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-bold text-slate-400 uppercase shrink-0">
                        Fold
                      </span>
                    )}
                    {p.usedBanks > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/50 text-[8px] font-bold text-amber-300 shrink-0">
                        ⏱ Bank {p.usedBanks}
                      </span>
                    )}
                    {hand?.currentPlayer === p.id && clockSecondsLeft != null && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500 text-[8px] font-bold text-emerald-300 font-mono shrink-0 animate-pulse">
                        ⏱ {clockSecondsLeft}s
                      </span>
                    )}
                  </div>

                  {/* 3. Actions */}
                  <div className="flex items-center justify-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide whitespace-nowrap truncate max-w-full text-center ${
                        lastActionText === 'Waiting'
                          ? 'bg-slate-800/60 border border-slate-700/50 text-slate-400 italic'
                          : p.status === 'allin' || lastActionText.startsWith('All-in')
                          ? 'bg-rose-950/80 border border-rose-600/70 text-rose-300 font-bold'
                          : isFolded
                          ? 'bg-slate-800 border border-slate-700 text-slate-400'
                          : 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300'
                      }`}
                    >
                      {lastActionText}
                    </span>
                  </div>

                  {/* 4. Hole cards - fixed width container so stack and equity remain aligned */}
                  <div className="flex items-center justify-center gap-0.5 w-[66px]">
                    {cards.length > 0 ? (
                      cards.map((c, j) => (
                        <AllInHoleCard key={j} card={c} highlight={highlightKeys} animate={isAllIn} />
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-600 font-mono">—</span>
                    )}
                  </div>

                  {/* 5. Stacks */}
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-emerald-400 whitespace-nowrap">
                      {stackShown(p) ? formatPlayerTagAmount(p.stack, cur, hand) : '—'}
                    </span>
                  </div>

                  {/* 6. Equity */}
                  <div className="text-right">
                    {isAllIn ? (
                      <span
                        className={`font-black font-mono text-sm drop-shadow ${
                          isSecured || eqVal >= 100
                            ? 'text-emerald-400 font-extrabold'
                            : 'text-emerald-300'
                        }`}
                      >
                        {formatEquity(eqVal, isSecured)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 font-mono">—</span>
                    )}
                  </div>
                </div>

                {/* Outs immediately to the right of player tag - wraps, no scrollbars, shows ALL outs */}
                {isAllIn && !isFolded && (
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 py-0.5">
                    {boardLen < 3 ? (
                      null
                    ) : boardLen >= 5 ? (
                      null
                    ) : myOuts && myOuts.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] shrink-0 whitespace-nowrap">
                          {myOuts.length} {myOuts.length === 1 ? 'out' : 'outs'}
                        </span>
                        {/* Render ALL outs without truncation or +X */}
                        <div className="flex flex-wrap items-center gap-0.5">
                          {myOuts.map((card) => (
                            <OutCard key={card.rank + card.suit} card={card} />
                          ))}
                        </div>
                      </div>
                    ) : hasZeroOuts ? (
                      eqVal != null && eqVal <= 0 ? (
                        <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/50 text-rose-300 font-semibold text-[10px] shrink-0">
                          Drawing dead
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 font-medium text-[10px] shrink-0">
                          0 outs
                        </span>
                      )
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Board & Pot */}
        <div className="flex flex-col justify-end items-end gap-3 shrink-0">
          <div className="flex flex-col items-end gap-1.5">
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
                  className="burn-card absolute -left-2 top-0 w-10 h-14 rounded-lg bg-[#3a4a3a] border border-[#4a5a4a] flex items-center justify-center pointer-events-none z-20 shadow-md"
                >
                  <span className="text-[#7fae7f] text-xs font-bold">?</span>
                </div>
              )}
              {[0, 1, 2, 3, 4].map((i) => {
                const c = hand?.communityCards?.[i];
                const cardKey = c && !c.hidden ? `${c.rank}${c.suit}-${i}` : `slot-${i}`;
                return (
                  <AllInBoardCard
                    key={cardKey}
                    card={c}
                    highlight={highlightKeys}
                    anim={boardAnim[i]?.anim}
                    delay={boardAnim[i]?.delay}
                    style={boardAnim[i]?.style}
                  />
                );
              })}
            </div>
            {hand?.doubleBoard && (
              <div className="flex gap-1.5 mt-1">
                {[0, 1, 2, 3, 4].map((i) => {
                  const c = (hand?.boardB || [])[i];
                  const cardKey = c && !c.hidden ? `b-${c.rank}${c.suit}-${i}` : `b-slot-${i}`;
                  return (
                    <AllInBoardCard key={cardKey} card={c} highlight={highlightKeys} />
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end rounded-xl border border-[#2a3442] bg-[#161d26]/95 px-4 py-2.5 shadow-xl min-w-[190px]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total Pot</div>
            <div className="text-2xl font-black text-white font-mono drop-shadow">{potShown ? money(totalPot, cur) : '—'}</div>
            {potShown && sidePots.length > 0 && (
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
