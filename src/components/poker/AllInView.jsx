import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Clock } from 'lucide-react';
import {
  money,
  formatSidePotAmount,
  formatPlayerTagAmount,
  formatBetAmount,
  SUIT_SYMBOL,
  SUIT_RED,
  rankDisplay,
  calculateAllInOuts,
  hasSoleDeepestStack,
  positionForSeat,
  calcEquity,
  STREET_LABEL,
  sortHoleCards,
  bettingFrozen,
} from '@/lib/poker';

const POSITION_ORDER = {
  SB: 1,
  BB: 2,
  UTG: 3,
  'UTG+1': 4,
  '+1': 4,
  'UTG+2': 5,
  '+2': 5,
  'UTG+3': 6,
  '+3': 6,
  LJ: 7,
  HJ: 8,
  CO: 9,
  BTN: 10,
};

function formatPosition(pos) {
  if (!pos) return '—';
  if (pos === 'UTG+1') return '+1';
  if (pos === 'UTG+2') return '+2';
  if (pos === 'UTG+3') return '+3';
  return pos;
}

function getButtonIndex(hand) {
  if (!hand || !hand.players) return -1;
  return hand.players.findIndex((p) => p.seat === hand.buttonSeat);
}

function raiseLabelLocal(level) {
  if (!level || level <= 1) return 'Bet';
  if (level === 2) return 'Raise';
  return `${level}-bet`;
}

function AllInHoleCard({ card, highlight = null, animate = true }) {
  if (!card || card.hidden) {
    return (
      <div className="w-8 h-6 rounded border border-[#2a2f37] bg-[#1e2227] flex items-center justify-center text-slate-500 font-bold text-xs select-none shadow-sm">
        ?
      </div>
    );
  }
  const isRed = SUIT_RED[card.suit];
  const suitSym = SUIT_SYMBOL[card.suit] || card.suit;
  const isHl = highlight && highlight.has(`${card.rank}${card.suit}`);

  return (
    <div
      className={`relative px-1.5 h-6 min-w-[30px] rounded border flex flex-row items-center justify-center gap-0.5 select-none transition-all shadow-md ${
        isHl
          ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 -translate-y-0.5 z-10 scale-105'
          : 'bg-white border-slate-300'
      } ${animate ? 'animate-[fadeInDown_350ms_ease-out]' : ''}`}
    >
      <span className={`text-[12px] font-black leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {rankDisplay(card.rank)}
      </span>
      <span className={`text-[11px] font-bold leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {suitSym}
      </span>
    </div>
  );
}

function AllInBoardCard({ card, highlight = null, anim = null, delay = 0, style = {} }) {
  if (!card || card.hidden) {
    return (
      <div className="w-10 h-14 rounded-lg border-2 border-dashed border-[#2a2f37] bg-[#161a22]/50 flex items-center justify-center text-slate-600 text-xs font-mono">
        —
      </div>
    );
  }
  const isRed = SUIT_RED[card.suit];
  const suitSym = SUIT_SYMBOL[card.suit] || card.suit;
  const isHl = highlight && highlight.has(`${card.rank}${card.suit}`);

  return (
    <div
      style={{ ...style, animationDelay: `${delay}s` }}
      className={`relative w-10 h-14 rounded-lg border flex flex-col items-center justify-between py-1 select-none shadow-lg transition-transform ${
        anim || ''
      } ${
        isHl
          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400 scale-105 z-10'
          : 'bg-white border-slate-300'
      }`}
    >
      <span className={`text-xs font-black leading-none self-center ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {rankDisplay(card.rank)}
      </span>
      <span className={`text-base leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {suitSym}
      </span>
    </div>
  );
}

function formatEquity(val, isSecured = false) {
  if (isSecured) return '100%';
  if (val == null) return '—';
  if (val <= 0.05 && val > 0) return '<1%';
  if (val >= 99.95 && val < 100) return '>99%';
  return `${Math.round(val)}%`;
}

function getPlayerLastActionText(player, currency, hand) {
  if (!player) return 'Waiting';
  if (player.status === 'folded') return 'Fold';
  const isAllInPlayer = player.status === 'allin' || player.stack <= 0;
  const isSoleDeepest = hand ? hasSoleDeepestStack(hand, player.id) : false;
  const isCapped = player._wasCapped || player._allInCapped;
  const frozen = hand ? bettingFrozen(hand) : false;
  if (isCapped) return 'All-in';
  const la = player.lastAction;
  if (!la) {
    if (isAllInPlayer || (frozen && isSoleDeepest)) return 'All-in';
    if (frozen) return 'All-in';
    return 'Waiting';
  }
  const amt = la.amount != null ? formatBetAmount(la.amount, currency) : '';
  switch (la.type) {
    case 'fold': return 'Fold';
    case 'check': return 'Check';
    case 'allin': return amt ? `All-in ${amt}` : 'All-in';
    case 'call': return (isAllInPlayer && !isSoleDeepest) ? (amt ? `All-in ${amt}` : 'All-in') : (amt ? `Call ${amt}` : 'Call');
    case 'bet':
    case 'raise': {
      if ((isAllInPlayer && !isSoleDeepest) || (isCapped && frozen)) {
        return amt ? `All-in ${amt}` : 'All-in';
      }
      const lbl = raiseLabelLocal(la.raiseLevel);
      return amt ? `${lbl} ${amt}` : lbl;
    }
    case 'sb': return amt ? `SB ${amt}` : 'SB';
    case 'bb': return amt ? `BB ${amt}` : 'BB';
    case 'straddle': return amt ? `Straddle ${amt}` : 'Straddle';
    default: return 'Active';
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
  const isTournament = hand?.mode === 'tournament';
  const cur = isTournament ? '' : (hand?.currency || '');
  const n = hand?.players?.length || 0;
  const buttonIdx = getButtonIndex(hand);
  const isPreflop = hand?.street === 'preflop';

  const stackShown = (p) => (alwaysShow ? true : (stackVisibleIds ? stackVisibleIds.has(p.id) : !hideAmounts));
  const potShown = showPot !== undefined ? showPot : !hideAmounts;

  // Ordered list of player IDs who have acted or are acting
  const [preflopActorOrder, setPreflopActorOrder] = useState([]);
  const [fadingFoldIds, setFadingFoldIds] = useState(new Set());
  const [collapsingFoldIds, setCollapsingFoldIds] = useState(new Set());
  const [dismissedFoldIds, setDismissedFoldIds] = useState(new Set());
  const [newlyEnteredIds, setNewlyEnteredIds] = useState(new Set());

  const handNumRef = useRef(hand?.handNumber);
  const tagDomRefs = useRef({});
  const prevTopsRef = useRef({});
  const prevStreetRef = useRef(hand?.street);

  // Reset state on new hand
  useEffect(() => {
    if (hand?.handNumber !== handNumRef.current) {
      handNumRef.current = hand?.handNumber;
      setPreflopActorOrder([]);
      setFadingFoldIds(new Set());
      setCollapsingFoldIds(new Set());
      setDismissedFoldIds(new Set());
      setNewlyEnteredIds(new Set());
      tagDomRefs.current = {};
      prevTopsRef.current = {};
    }
  }, [hand?.handNumber]);

  // Snapshot tag positions before street changes for FLIP animation
  useEffect(() => {
    const tops = {};
    const activeIds = new Set(
      (hand?.players || []).filter((p) => p.status !== 'folded').map((p) => String(p.id))
    );
    Object.keys(tagDomRefs.current).forEach((id) => {
      if (!activeIds.has(String(id))) return;
      const el = tagDomRefs.current[id];
      if (el) {
        tops[id] = el.getBoundingClientRect().top;
      }
    });
    prevTopsRef.current = tops;
  }, [hand?.street, hand?.players, preflopActorOrder]);

  // FLIP animate re-ordering when street changes
  useLayoutEffect(() => {
    const prevStreet = prevStreetRef.current;
    const currentStreet = hand?.street;

    if (prevStreet && currentStreet && prevStreet !== currentStreet) {
      setFadingFoldIds(new Set());
      setCollapsingFoldIds(new Set());

      // Re-ordering after betting ends: animate each active player's tag smoothly to its new position
      const activeIds = new Set(
        (hand.players || []).filter((p) => p.status !== 'folded').map((p) => String(p.id))
      );
      Object.keys(tagDomRefs.current).forEach((id) => {
        if (!activeIds.has(String(id))) return;
        const el = tagDomRefs.current[id];
        const prevTop = prevTopsRef.current[id];
        if (el && prevTop != null) {
          const currentTop = el.getBoundingClientRect().top;
          const deltaY = prevTop - currentTop;
          if (Math.abs(deltaY) > 1) {
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.transition = 'none';
            requestAnimationFrame(() => {
              el.style.transition = 'transform 800ms cubic-bezier(0.25, 1, 0.5, 1)';
              el.style.transform = '';
            });
          }
        }
      });
      prevTopsRef.current = {};
    }
    prevStreetRef.current = hand?.street;
  }, [hand?.street]);

  // Actor updates and smooth fold collapse (both preflop and postflop)
  useEffect(() => {
    if (!hand?.players) return;

    const currId = hand.currentPlayer >= 0 ? hand.players[hand.currentPlayer]?.id : null;

    // Detect players who folded
    hand.players.forEach((p) => {
      const inPreflop = isPreflop && preflopActorOrder.includes(p.id);
      const inPostflop = !isPreflop && !dismissedFoldIds.has(p.id);
      const shouldAnimateFold = p.status === 'folded' && (inPreflop || inPostflop) && !fadingFoldIds.has(p.id) && !dismissedFoldIds.has(p.id);

      if (shouldAnimateFold) {
        // Step 1: Show "Fold" badge immediately
        setFadingFoldIds((prev) => new Set([...prev, p.id]));

        // Step 2: After 400ms, start smoothly collapsing height/margin to 0
        setTimeout(() => {
          setCollapsingFoldIds((prev) => new Set([...prev, p.id]));
        }, 400);

        // Step 3: After collapse finishes (900ms total), remove completely
        setTimeout(() => {
          setDismissedFoldIds((prev) => new Set([...prev, p.id]));
          if (isPreflop) {
            setPreflopActorOrder((prev) => prev.filter((id) => id !== p.id));
          }
          setFadingFoldIds((prev) => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
          setCollapsingFoldIds((prev) => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
        }, 900);
      }
    });

    if (currId != null) {
      // Trigger incoming / action animation for the active player
      if (!newlyEnteredIds.has(currId)) {
        setNewlyEnteredIds((n) => new Set([...n, currId]));
        setTimeout(() => {
          setNewlyEnteredIds((n) => {
            const next = new Set(n);
            next.delete(currId);
            return next;
          });
        }, 600);
      }

      if (isPreflop) {
        setPreflopActorOrder((prev) => {
          if (prev.length === 0) {
            const actedNames = new Set(
              (hand.actionHistory || [])
                .filter((a) => a.street === 'preflop' && !a.action?.toLowerCase().includes('fold'))
                .map((a) => a.player)
            );
            const pastActed = hand.players
              .filter((p) => p.status !== 'folded' && p.id !== currId && actedNames.has(p.name))
              .map((p) => p.id);

            return [currId, ...pastActed];
          }

          // DO NOT move player tags up and down around until preflop ends!
          if (prev.includes(currId)) {
            return prev;
          }

          // Add new acting player right above existing tags (on top)
          return [currId, ...prev];
        });
      }
    }
  }, [hand?.street, hand?.currentPlayer, hand?.players, isPreflop, preflopActorOrder, fadingFoldIds, dismissedFoldIds, newlyEnteredIds]);

  // Check if there is an actual all-in situation in progress
  const isAllIn = useMemo(() => {
    if (!hand?.players) return false;
    const nonFolded = hand.players.filter((p) => p.status !== 'folded');
    return nonFolded.some((p) => p.status === 'allin' || p.stack <= 0);
  }, [hand]);

  // List of players to display
  const contestants = useMemo(() => {
    if (!hand?.players) return [];

    let playersToInclude = [];
    if (isPreflop) {
      // Preflop: only show those who have acted or are currently acting
      let order = preflopActorOrder;
      if (order.length === 0 && hand.currentPlayer >= 0) {
        order = [hand.players[hand.currentPlayer].id];
      }
      if (order.length === 0) {
        order = hand.players.filter((p) => p.status !== 'folded').map((p) => p.id);
      }
      playersToInclude = order.map((id) => hand.players.find((p) => p.id === id)).filter(Boolean);
    } else {
      // Postflop: ONLY non-folded contenders still in the hand
      playersToInclude = hand.players.filter((p) => p.status !== 'folded');
    }

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
  }, [hand, positions, n, buttonIdx, isAllIn, isPreflop, preflopActorOrder, fadingFoldIds, collapsingFoldIds]);

  const sortedContestants = useMemo(() => {
    // If contestants have chipRank assigned by TD (e.g. 1st most chips, 2nd most chips):
    const hasChipRank = contestants.some((c) => c.player?.chipRank != null);
    if (hasChipRank) {
      return [...contestants].sort((a, b) => (a.player?.chipRank || 99) - (b.player?.chipRank || 99));
    }
    if (isPreflop) {
      // Preflop: keep the active actor order (newest acting on top, earlier acted below - no jumping)
      return contestants;
    }
    // Postflop: reordered with FLIP animation so blinds (SB, BB) are on top, and late positions (CO, BTN) on bottom
    return [...contestants].sort((a, b) => a.posOrder - b.posOrder);
  }, [contestants, isPreflop]);

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
          {isAllIn && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-600/80 text-rose-300 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(244,63,94,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              ALL-IN
            </span>
          )}
          <span className="text-xs font-bold text-slate-300 px-3 py-1 rounded-full bg-[#1e242d] border border-[#2e3745]">
            List View
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
        <div className="flex flex-col gap-2.5 flex-1 min-w-0 overflow-y-auto overflow-x-hidden pr-1">
          {sortedContestants.map((item) => {
            const p = item.player;
            const eqVal = computedEquity?.byId?.[p.id];
            const isAtRisk = item.isAtRisk;
            const cards = sortHoleCards(holeCards[p.id] || []);
            const myOuts = outsByPlayerId[p.id];
            const hasZeroOuts = myOuts && myOuts.length === 0;
            const isFolded = p.status === 'folded';
            const isFadingFold = fadingFoldIds.has(p.id);
            const isCollapsing = collapsingFoldIds.has(p.id);
            const isNewlyEntered = newlyEnteredIds.has(p.id);
            const isCurrentActor = hand?.currentPlayer >= 0 && hand?.players[hand.currentPlayer]?.id === p.id;
            const isWinner = Boolean(
              winningPlayerIds?.has?.(p.id) ||
              hand?.winners?.some?.((w) => w.playerId === p.id)
            );
            const lastActionText = isFadingFold ? 'Fold' : getPlayerLastActionText(p, cur, hand);

            // Determine if player has secured the pot (all opponents have <= 0 equity or is confirmed winner)
            const otherContestants = contestants.filter((c) => c.player.status !== 'folded' && c.player.id !== p.id);
            const othersZeroEq = otherContestants.length > 0 && otherContestants.every((o) => {
              const oEq = computedEquity?.byId?.[o.player.id];
              return oEq == null || oEq <= 0.05;
            });
            const isSecured = isWinner || (eqVal != null && eqVal >= 99 && othersZeroEq) || (eqVal != null && eqVal >= 100);

            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) tagDomRefs.current[p.id] = el;
                  else delete tagDomRefs.current[p.id];
                }}
                style={{
                  maxHeight: isCollapsing ? '0px' : '90px',
                  opacity: isCollapsing ? 0 : 1,
                  transform: isCollapsing ? 'scaleY(0)' : 'none',
                  transformOrigin: 'top center',
                  overflow: isCollapsing ? 'hidden' : 'visible',
                  transition: 'max-height 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease, transform 500ms ease, margin 500ms ease',
                  marginBottom: isCollapsing ? '0px' : undefined,
                  pointerEvents: isCollapsing ? 'none' : undefined,
                }}
                className={`w-full ${isNewlyEntered ? 'animate-[slideInDown_400ms_cubic-bezier(0.16,1,0.3,1)]' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-2.5 w-full">
                  {/* Strictly aligned columns: if isAllIn: [position, names, actions, hole cards, stacks, equity]; if !isAllIn: [position, names, actions, stacks] */}
                  <div
                    className={`h-9 px-2.5 sm:px-3 rounded-lg border grid items-center gap-1.5 sm:gap-2 shadow-md w-full max-w-[580px] transition-all duration-300 ease-in-out ${
                      isAllIn
                        ? 'grid-cols-[34px_minmax(105px,1.2fr)_minmax(85px,1fr)_66px_minmax(75px,0.9fr)_50px]'
                        : 'grid-cols-[34px_minmax(120px,1.4fr)_minmax(100px,1.2fr)_minmax(75px,1fr)]'
                    } ${
                      isFadingFold
                        ? 'border-rose-800 bg-rose-950/60 opacity-60 scale-98'
                        : isWinner
                        ? 'border-emerald-500 bg-[#122e1b] ring-2 ring-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.35)]'
                        : isCurrentActor
                        ? 'border-emerald-400 bg-[#1a2e22] ring-2 ring-emerald-400/90 shadow-[0_0_16px_rgba(52,211,153,0.35)] animate-pulse'
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
                        {formatPosition(item.position)}
                      </span>
                    </div>

                    {/* 2. Names & Badges */}
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-bold text-sm text-white truncate" title={p.name}>
                        {p.name}
                      </span>
                      {p.chipRank != null && (
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase shrink-0 border ${
                          p.chipRank === 1
                            ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                            : p.chipRank === 2
                            ? 'bg-slate-300/25 border-slate-300 text-slate-200'
                            : 'bg-amber-800/25 border-amber-700 text-amber-200'
                        }`}>
                          {p.chipRank === 1 ? '🥇 1st Most Chips' : `${p.chipRank}${p.chipRank === 2 ? 'nd' : p.chipRank === 3 ? 'rd' : 'th'} Most`}
                        </span>
                      )}
                      {isWinner && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 border border-emerald-400/70 text-[9px] font-black text-emerald-300 uppercase shrink-0 animate-pulse">
                          WIN
                        </span>
                      )}
                      {p.usedBanks > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/50 text-[8px] font-bold text-amber-300 shrink-0">
                          TIME{p.usedBanks > 1 ? ` ×${p.usedBanks}` : ''}
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
                            : isFolded || isFadingFold
                            ? 'bg-slate-800 border border-slate-700 text-slate-400'
                            : 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300'
                        }`}
                      >
                        {lastActionText}
                      </span>
                    </div>

                    {/* 4. Hole cards - only when isAllIn */}
                    {isAllIn && (
                      <div className="flex items-center justify-center gap-0.5 w-[66px]">
                        {cards.length > 0 ? (
                          cards.map((c, j) => (
                            <AllInHoleCard key={j} card={c} highlight={highlightKeys} animate={isAllIn} />
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">—</span>
                        )}
                      </div>
                    )}

                    {/* 5. Stacks */}
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-emerald-400 whitespace-nowrap">
                        {stackShown(p) ? formatPlayerTagAmount(p.stack, cur, hand) : '—'}
                      </span>
                    </div>

                    {/* 6. Equity - only when isAllIn */}
                    {isAllIn && (
                      <div className="text-right">
                        <span
                          className={`font-black font-mono text-sm drop-shadow ${
                            isSecured || eqVal >= 100
                              ? 'text-emerald-400 font-extrabold'
                              : 'text-emerald-300'
                          }`}
                        >
                          {formatEquity(eqVal, isSecured)}
                        </span>
                      </div>
                    )}
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
                          <span className="text-[11px] font-bold text-slate-300 font-mono">
                            {myOuts.length} out{myOuts.length > 1 ? 's' : ''}:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {myOuts.map((outCard, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-black shadow-sm border ${
                                  SUIT_RED[outCard.suit]
                                    ? 'bg-rose-950/80 border-rose-500/70 text-red-300'
                                    : 'bg-slate-900 border-slate-600 text-slate-100'
                                }`}
                              >
                                {rankDisplay(outCard.rank)}
                                {SUIT_SYMBOL[outCard.suit] || outCard.suit}
                              </span>
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
              </div>
            );
          })}
        </div>

        {/* Right: Board & Pot & Action Clock */}
        <div className="flex flex-col justify-end items-end gap-3 shrink-0">
          {clockSecondsLeft != null && (
            <div className="flex items-center justify-between w-full min-w-[200px] rounded-xl border border-emerald-500/80 bg-[#161d26]/95 px-3.5 py-2 shadow-xl backdrop-blur-md animate-pulse">
              <div className="flex items-center gap-2">
                <Clock size={16} className={clockSecondsLeft > 10 ? 'text-emerald-400' : clockSecondsLeft > 5 ? 'text-amber-400' : 'text-rose-400'} />
                <span className="text-xs text-slate-300 font-semibold truncate max-w-[120px]">
                  {hand?.players?.[hand?.currentPlayer]?.name || 'Action'}
                </span>
              </div>
              <span className={`text-xl font-black font-mono tracking-tight ${clockSecondsLeft > 10 ? 'text-emerald-400' : clockSecondsLeft > 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                {clockSecondsLeft}s
              </span>
            </div>
          )}
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
