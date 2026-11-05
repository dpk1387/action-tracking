import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Clock } from 'lucide-react';
import {
  money,
  formatPotAmount,
  getMultipleBoardWinPercentages,
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
  evaluateWinners,
  effectiveHoleSize,
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
  'UTG+4': 7,
  '+4': 7,
  'UTG+5': 8,
  '+5': 8,
  LJ: 9,
  HJ: 10,
  CO: 11,
  BTN: 12,
};

function formatPosition(pos) {
  if (!pos) return '—';
  if (pos === 'UTG+1') return '+1';
  if (pos === 'UTG+2') return '+2';
  if (pos === 'UTG+3') return '+3';
  if (pos === 'UTG+4') return '+4';
  if (pos === 'UTG+5') return '+5';
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

function AllInOutCard({ card }) {
  if (!card) return null;
  const isRed = SUIT_RED[card.suit];
  const suitSym = SUIT_SYMBOL[card.suit] || card.suit;
  return (
    <div className="px-1.5 h-5 min-w-[26px] rounded bg-white border border-slate-300 flex items-center justify-center gap-0.5 select-none shadow-sm leading-none shrink-0">
      <span className={`text-[11px] font-black ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {rankDisplay(card.rank)}
      </span>
      <span className={`text-[10px] font-bold ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {suitSym}
      </span>
    </div>
  );
}

function AllInBoardCard({ card, highlight = null, anim = null, delay = 0, style = {}, compact = false }) {
  if (!card || card.hidden) {
    return (
      <div className={`${compact ? 'w-9 h-11' : 'w-12 h-14'} rounded-lg border-2 border-dashed border-[#2a2f37] bg-[#161a22]/50 flex items-center justify-center text-slate-600 text-xs font-mono`}>
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
      className={`relative ${compact ? 'w-9 h-11 px-1' : 'w-12 h-14 px-1.5'} rounded-lg border flex flex-row items-center justify-center gap-1 select-none shadow-lg transition-transform ${
        anim || ''
      } ${
        isHl
          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400 scale-105 z-10'
          : 'bg-white border-slate-300'
      }`}
    >
      <span className={`${compact ? 'text-xs' : 'text-base'} font-black leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {rankDisplay(card.rank)}
      </span>
      <span className={`${compact ? 'text-xs' : 'text-base'} leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {suitSym}
      </span>
    </div>
  );
}

function formatEquity(val, isSecured = false, isMultipleBoards = false) {
  if (val == null) return '—';
  const num = Number(val);
  if (isNaN(num)) return '—';
  if (isMultipleBoards) {
    if (num >= 99.9) return '100%';
    if (num > 0 && num < 1) return '<1%';
    if (Math.round(num) === 33) return '33%';
    if (Math.round(num) === 67 || Math.round(num) === 66) return '67%';
    if (Math.round(num) === 50) return '50%';
    return `${Math.round(num)}%`;
  }
  if (isSecured) return '100%';
  if (num > 0 && num < 1) return '<1%';
  if (num >= 99.95 && num < 100) return '>99%';
  return `${Math.round(num)}%`;
}

function getPlayerLastActionText(player, currency, hand) {
  if (!player) return 'Waiting';
  if (player.status === 'folded') return 'Fold';
  const isAllInPlayer = player.status === 'allin' || player.stack <= 0;
  const isSoleDeepest = hand ? hasSoleDeepestStack(hand, player.id) : false;
  const frozen = hand ? bettingFrozen(hand) : false;
  const actionEnded = hand ? (frozen || hand.currentPlayer === -1 || hand.phase === 'ended' || hand.phase === 'awarded') : false;

  // When action ends, remove the all in text and show nothing for the deep stack because they are not at risk
  if (actionEnded && isSoleDeepest) {
    return '';
  }

  const isCapped = player._wasCapped || player._allInCapped;
  if (isCapped) return 'All-in';
  const la = player.lastAction;
  if (!la) {
    if (isAllInPlayer) return 'All-in';
    if (frozen) return isSoleDeepest ? '' : 'All-in';
    return 'Waiting';
  }
  const callAmt = la.callAmount != null ? formatBetAmount(la.callAmount, currency) : (la.amount != null ? formatBetAmount(la.amount, currency) : '');
  const amt = la.amount != null ? formatBetAmount(la.amount, currency) : '';
  switch (la.type) {
    case 'fold': return 'Fold';
    case 'check': return 'Check';
    case 'allin': return (la.callAmount != null ? `All in for ${callAmt}` : (amt ? `All in for ${amt}` : 'All-in'));
    case 'call': return isAllInPlayer ? (callAmt ? `All in for ${callAmt}` : 'All-in') : (callAmt ? `Call ${callAmt}` : 'Call');
    case 'bet':
    case 'raise': {
      if (isAllInPlayer) {
        return amt ? `All in for ${amt}` : 'All-in';
      }
      const lbl = raiseLabelLocal(la.raiseLevel);
      return amt ? `${lbl} ${amt}` : lbl;
    }
    case 'sb': return amt ? `SB ${amt}` : 'SB';
    case 'bb': return amt ? `BB ${amt}` : 'BB';
    case '3b': return amt ? `3B ${amt}` : '3B';
    case '4b': return amt ? `4B ${amt}` : '4B';
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
  displayUnit = 'chips',
}) {
  const isTournament = hand?.mode === 'tournament';
  const cur = isTournament ? '' : (hand?.currency || '');
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';
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
  const lockedOrderRef = useRef(null);

  // Reset state on new hand
  useEffect(() => {
    if (hand?.handNumber !== handNumRef.current) {
      handNumRef.current = hand?.handNumber;
      lockedOrderRef.current = null;
      setPreflopActorOrder([]);
      setFadingFoldIds(new Set());
      setCollapsingFoldIds(new Set());
      setDismissedFoldIds(new Set());
      setNewlyEnteredIds(new Set());
      tagDomRefs.current = {};
      prevTopsRef.current = {};
      prevStreetRef.current = hand?.street;
    }
  }, [hand?.handNumber]);

  // Snapshot tag positions before preflop->postflop street transition for FLIP animation
  useEffect(() => {
    if (hand?.street === 'preflop') {
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
    }
  }, [hand?.street, hand?.players, preflopActorOrder]);

  // FLIP animate re-ordering ONLY when leaving preflop to flop (one time shuffle, never on turn/river!)
  useLayoutEffect(() => {
    const prevStreet = prevStreetRef.current;
    const currentStreet = hand?.street;

    if (prevStreet === 'preflop' && currentStreet && currentStreet !== 'preflop') {
      setFadingFoldIds(new Set());
      setCollapsingFoldIds(new Set());

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
              el.style.transition = 'transform 700ms cubic-bezier(0.25, 1, 0.5, 1)';
              el.style.transform = '';
            });
          }
        }
      });
      prevTopsRef.current = {};
    }
    prevStreetRef.current = hand?.street;
  }, [hand?.street]);

  // Actor updates and smooth fold collapse
  useEffect(() => {
    if (!hand?.players) return;

    const currId = hand.currentPlayer >= 0 ? hand.players[hand.currentPlayer]?.id : null;

    // Detect players who folded
    hand.players.forEach((p) => {
      const inPreflop = isPreflop && preflopActorOrder.includes(p.id);
      const inPostflop = !isPreflop && !dismissedFoldIds.has(p.id);
      const shouldAnimateFold = p.status === 'folded' && (inPreflop || inPostflop) && !fadingFoldIds.has(p.id) && !dismissedFoldIds.has(p.id);

      if (shouldAnimateFold) {
        setFadingFoldIds((prev) => new Set([...prev, p.id]));

        setTimeout(() => {
          setCollapsingFoldIds((prev) => new Set([...prev, p.id]));
        }, 400);

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

            return [...pastActed, currId];
          }

          if (prev.includes(currId)) {
            return prev;
          }
          return [...prev, currId];
        });
      }
    }
  }, [hand?.street, hand?.currentPlayer, hand?.players, isPreflop, preflopActorOrder, fadingFoldIds, dismissedFoldIds, newlyEnteredIds]);

  // Check if all-in condition or betting action has frozen/ended
  const isAllIn = useMemo(() => {
    if (!hand?.players) return false;
    const nonFolded = hand.players.filter((p) => p.status !== 'folded');
    return nonFolded.some((p) => p.status === 'allin' || p.stack <= 0);
  }, [hand]);

  const frozen = hand ? bettingFrozen(hand) : false;
  const actionEnded = Boolean(
    isAllIn ||
    frozen ||
    hand?.currentPlayer === -1 ||
    hand?.phase === 'ended' ||
    hand?.phase === 'awarded'
  );

  // List of players to display
  const contestants = useMemo(() => {
    if (!hand?.players) return [];

    let playersToInclude = [];
    if (isPreflop && !actionEnded) {
      let order = preflopActorOrder;
      if (order.length === 0 && hand.currentPlayer >= 0) {
        order = [hand.players[hand.currentPlayer].id];
      }
      if (order.length === 0) {
        order = hand.players.filter((p) => p.status !== 'folded').map((p) => p.id);
      }
      playersToInclude = order.map((id) => hand.players.find((p) => p.id === id)).filter(Boolean);
    } else {
      playersToInclude = hand.players.filter((p) => p.status !== 'folded');
    }

    return playersToInclude.map((p) => {
      const idx = hand.players.findIndex((x) => x.id === p.id);
      const posLabel = positions[idx] || positionForSeat(n, buttonIdx, idx, hand?.variant) || '';
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
  }, [hand, positions, n, buttonIdx, isAllIn, isPreflop, preflopActorOrder, actionEnded]);

  const sortedContestants = useMemo(() => {
    const hasChipRank = contestants.some((c) => c.player?.chipRank != null);
    if (hasChipRank) {
      return [...contestants].sort((a, b) => (a.player?.chipRank || 99) - (b.player?.chipRank || 99));
    }
    if (isPreflop && !actionEnded) {
      return contestants;
    }
    // Lock the postflop order once determined so tags NEVER reorder or reverse on turn/river
    if (!lockedOrderRef.current) {
      const order = [...contestants].sort((a, b) => b.posOrder - a.posOrder).map((c) => c.player.id);
      lockedOrderRef.current = order;
    }
    const idMap = new Map(contestants.map((c) => [c.player.id, c]));
    const result = [];
    lockedOrderRef.current.forEach((id) => {
      const c = idMap.get(id);
      if (c) result.push(c);
    });
    contestants.forEach((c) => {
      if (!lockedOrderRef.current.includes(c.player.id)) result.push(c);
    });
    return result;
  }, [contestants, isPreflop, actionEnded]);

  const totalPot = useMemo(() => {
    if (pot > 0) return pot;
    return (hand?.players || []).reduce((s, p) => s + (p.totalBet || 0), 0);
  }, [pot, hand]);

  const isTriple = (Number(hand?.bombBoards) >= 3) || (hand?.boardC && hand?.boardC.length > 0) || (Number(hand?.runTimes) >= 3);
  const isMultipleBoards = Boolean(hand?.doubleBoard || isTriple || (Number(hand?.runTimes) >= 2));

  const multipleBoardWinPct = useMemo(() => {
    const cardsALen = (hand?.communityCards || []).filter((c) => !c.hidden).length;
    const cardsBLen = (hand?.boardB || []).filter((c) => !c.hidden).length;
    const cardsCLen = (hand?.boardC || []).filter((c) => !c.hidden).length;
    const isMultiRun = Number(hand?.runTimes) >= 2;
    const isTripleRun = Number(hand?.runTimes) >= 3;
    const allComplete = isTripleRun
      ? (cardsALen === 5 && cardsBLen === 5 && cardsCLen === 5)
      : isMultiRun
      ? (cardsALen === 5 && cardsBLen === 5)
      : (cardsALen === 5);
    if (!allComplete && hand?.phase !== 'awarded') {
      return null;
    }
    return getMultipleBoardWinPercentages(hand, holeCards);
  }, [hand, holeCards]);

  const computedEquity = useMemo(() => {
    if (!isAllIn && !actionEnded) return null;
    if (multipleBoardWinPct) {
      return { byId: multipleBoardWinPct, split: 0, isComplete: true };
    }
    if (equity?.byId) return equity;
    if (!hand || !holeCards) return null;
    const holes = contestants.map((c) => holeCards[c.player.id]);
    if (holes.some((h) => !h || !h.length)) return null;
    const variant = hand.variant || 'nlh';
    const iters = 5000;
    try {
      const byId = {};
      let split = 0;
      if (isTriple) {
        const resA = calcEquity(holes, hand.communityCards || [], iters, variant);
        const resB = calcEquity(holes, hand.boardB || [], iters, variant);
        const resC = calcEquity(holes, hand.boardC || [], iters, variant);
        contestants.forEach((c, i) => {
          byId[c.player.id] = (resA.results[i].win + resB.results[i].win + resC.results[i].win) / 3;
        });
        split = (resA.split + resB.split + resC.split) / 3;
      } else if (isMultipleBoards) {
        const resA = calcEquity(holes, hand.communityCards || [], iters, variant);
        const resB = calcEquity(holes, hand.boardB || [], iters, variant);
        contestants.forEach((c, i) => {
          byId[c.player.id] = (resA.results[i].win + resB.results[i].win) / 2;
        });
        split = (resA.split + resB.split) / 2;
      } else {
        const res = calcEquity(holes, hand.communityCards || [], iters, variant);
        contestants.forEach((c, i) => {
          byId[c.player.id] = res.results[i].win;
        });
        split = res.split;
      }
      return { byId, split };
    } catch {
      return null;
    }
  }, [equity, hand, holeCards, contestants, isAllIn, isTriple, isMultipleBoards, multipleBoardWinPct, actionEnded]);

  const boardWinningsInfo = useMemo(() => {
    if (!isMultipleBoards || !hand) {
      return { playerWinnings: {}, totalAwardedSoFar: 0 };
    }
    const numBoards = isTriple ? 3 : 2;
    const boardShare = totalPot / numBoards;
    const eligiblePids = contestants.map((c) => c.player.id).filter((id) => holeCards[id] && holeCards[id].length > 0);
    if (eligiblePids.length < 2) {
      return { playerWinnings: {}, totalAwardedSoFar: 0 };
    }

    const cardsA = (hand.communityCards || []).filter((c) => c && !c.hidden);
    const cardsB = (hand.boardB || []).filter((c) => c && !c.hidden);
    const cardsC = (hand.boardC || []).filter((c) => c && !c.hidden);

    const playerWinnings = {};
    let totalAwardedSoFar = 0;
    const variant = hand.variant || 'nlh';
    const holeSize = effectiveHoleSize(hand);

    // Board 1 / A
    if (cardsA.length === 5) {
      const winnersA = evaluateWinners(eligiblePids, holeCards, cardsA, variant, holeSize);
      if (winnersA && winnersA.length > 0) {
        const splitAmount = Math.round((boardShare / winnersA.length) * 100) / 100;
        winnersA.forEach((wId) => {
          playerWinnings[wId] = (playerWinnings[wId] || 0) + splitAmount;
        });
        totalAwardedSoFar += boardShare;
      }
    }

    // Board 2 / B
    if (cardsB.length === 5) {
      const winnersB = evaluateWinners(eligiblePids, holeCards, cardsB, variant, holeSize);
      if (winnersB && winnersB.length > 0) {
        const splitAmount = Math.round((boardShare / winnersB.length) * 100) / 100;
        winnersB.forEach((wId) => {
          playerWinnings[wId] = (playerWinnings[wId] || 0) + splitAmount;
        });
        totalAwardedSoFar += boardShare;
      }
    }

    // Board 3 / C
    if (isTriple && cardsC.length === 5) {
      const winnersC = evaluateWinners(eligiblePids, holeCards, cardsC, variant, holeSize);
      if (winnersC && winnersC.length > 0) {
        const splitAmount = Math.round((boardShare / winnersC.length) * 100) / 100;
        winnersC.forEach((wId) => {
          playerWinnings[wId] = (playerWinnings[wId] || 0) + splitAmount;
        });
        totalAwardedSoFar += boardShare;
      }
    }

    return { playerWinnings, totalAwardedSoFar };
  }, [isMultipleBoards, hand, totalPot, isTriple, contestants, holeCards]);

  const allInOuts = useMemo(() => {
    if (!isAllIn && !actionEnded) return [];
    return calculateAllInOuts(hand, holeCards);
  }, [hand, holeCards, isAllIn, actionEnded]);

  const cardsALen = (hand?.communityCards || []).filter((c) => c && !c.hidden).length;
  const cardsBLen = (hand?.boardB || []).filter((c) => c && !c.hidden).length;
  const cardsCLen = (hand?.boardC || []).filter((c) => c && !c.hidden).length;

  const activeBoardLen = (
    cardsALen < 5
      ? cardsALen
      : isMultipleBoards && cardsBLen < 5
      ? cardsBLen
      : isTriple && cardsCLen < 5
      ? cardsCLen
      : 5
  );

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

  // Compute active board and previous completed boards for multi-board runout
  const { currentActiveBoard, currentActiveName, previousCompletedBoards } = useMemo(() => {
    if (!isMultipleBoards) {
      return {
        currentActiveBoard: hand?.communityCards || [],
        currentActiveName: 'Board',
        previousCompletedBoards: [],
      };
    }

    const completed = [];
    let active = hand?.communityCards || [];
    let activeName = 'Board 1';

    if (cardsALen === 5) {
      completed.push({ id: 'a', name: 'Board 1', cards: (hand?.communityCards || []).slice(0, 5) });
      active = hand?.boardB || [];
      activeName = 'Board 2';

      if (cardsBLen === 5 && isTriple) {
        completed.push({ id: 'b', name: 'Board 2', cards: (hand?.boardB || []).slice(0, 5) });
        active = hand?.boardC || [];
        activeName = 'Board 3';
      }
    }

    return {
      currentActiveBoard: active,
      currentActiveName: activeName,
      previousCompletedBoards: completed,
    };
  }, [isMultipleBoards, hand, cardsALen, cardsBLen, isTriple]);

  // Dynamic tag width based on number of hole cards so 4+ card games don't truncate names to ...
  const maxHoleCards = useMemo(() => {
    let max = effectiveHoleSize(hand);
    (contestants || []).forEach((c) => {
      const h = holeCards?.[c.player?.id];
      if (Array.isArray(h) && h.length > max) {
        max = h.length;
      }
    });
    return max;
  }, [hand, contestants, holeCards]);

  const tagWidthClass = maxHoleCards >= 6
    ? 'w-[430px]'
    : maxHoleCards === 5
    ? 'w-[370px]'
    : maxHoleCards === 4
    ? 'w-[325px]'
    : 'w-[260px]';

  // Render individual player tag
  const renderPlayerTag = (item) => {
    const p = item.player;
    const eqVal = computedEquity?.byId?.[p.id];
    const isAtRisk = item.isAtRisk;
    const cards = sortHoleCards(holeCards[p.id] || []);
    const isFolded = p.status === 'folded';
    const isFadingFold = fadingFoldIds.has(p.id);
    const isCollapsing = collapsingFoldIds.has(p.id);
    const isNewlyEntered = newlyEnteredIds.has(p.id);
    const isCurrentActor = hand?.currentPlayer >= 0 && hand?.players[hand.currentPlayer]?.id === p.id;
    const isWinner = Boolean(
      winningPlayerIds?.has?.(p.id) ||
      hand?.winners?.some?.((w) => w.playerId === p.id)
    );
    const isSoleDeepest = hand ? hasSoleDeepestStack(hand, p.id) : false;

    const toCall = isCurrentActor ? Math.max(0, (hand.currentBet || 0) - (p.currentBet || 0)) : 0;
    const rawAction = isFadingFold ? 'Fold' : getPlayerLastActionText(p, cur, hand);
    const wonAmount = boardWinningsInfo.playerWinnings[p.id];
    const hasWonBoard = wonAmount != null && wonAmount > 0;
    const winText = hasWonBoard ? `Win ${money(wonAmount, cur)}` : null;

    let wonTotal = 0;
    if (hand?.winners && hand.winners.length > 0) {
      hand.winners.forEach((w) => {
        if (w.playerId === p.id) {
          wonTotal += Number(w.amount) || 0;
        }
      });
    } else if (hasWonBoard) {
      wonTotal = wonAmount || 0;
    }
    const playerProfit = wonTotal - (p.totalBet || 0);

    const displayActionText = winText || ((actionEnded && isSoleDeepest)
      ? ''
      : isCurrentActor && toCall > 0
      ? `${money(toCall, cur)} TO CALL`
      : rawAction);

    const otherContestants = contestants.filter((c) => c.player.status !== 'folded' && c.player.id !== p.id);
    const othersZeroEq = otherContestants.length > 0 && otherContestants.every((o) => {
      const oEq = computedEquity?.byId?.[o.player.id];
      return oEq == null || oEq <= 0.05;
    });
    const isScoop = eqVal != null && eqVal >= 99.9;
    const isSecured = isMultipleBoards
      ? isScoop
      : (isWinner || (eqVal != null && eqVal >= 99 && othersZeroEq) || isScoop);

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
          transformOrigin: 'bottom center',
          overflow: isCollapsing ? 'hidden' : 'visible',
          transition: 'max-height 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 350ms ease, transform 350ms ease',
          pointerEvents: isCollapsing ? 'none' : undefined,
        }}
        className={`${tagWidthClass} shrink-0 rounded-lg border overflow-hidden shadow-lg flex flex-col justify-between select-none relative transition-all duration-300 ${
          isNewlyEntered ? 'animate-[slideInDown_300ms_cubic-bezier(0.16,1,0.3,1)]' : ''
        } ${
          isFadingFold
            ? 'border-rose-900 bg-rose-950/40 opacity-50'
            : isWinner || hasWonBoard
            ? 'border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.35)]'
            : isCurrentActor
            ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.4)]'
            : isFolded
            ? 'border-slate-800 bg-[#14171d]/60 opacity-40'
            : isAtRisk
            ? 'border-rose-500/80 bg-[#281c1c] shadow-[0_0_10px_rgba(244,63,94,0.25)]'
            : 'border-slate-800 bg-black'
        }`}
      >
        {/* TOP SECTION */}
        <div
          className={`px-2.5 py-1.5 flex items-center justify-between min-h-[46px] transition-colors ${
            isCurrentActor
              ? 'bg-gradient-to-r from-[#cfac3e] via-[#f3d058] to-[#cfac3e]'
              : 'bg-black border-b border-zinc-800'
          }`}
        >
          {/* Left: Player Name */}
          <div className="flex items-center min-w-0 pr-1">
            <span
              className={`font-black uppercase text-sm tracking-wide truncate ${
                isCurrentActor ? 'text-black' : 'text-white'
              }`}
              title={p.name}
            >
              {p.name}
            </span>
          </div>

          {/* Center: Hole cards */}
          {(isAllIn || actionEnded) && cards.length > 0 && (
            <div className="flex items-center gap-1 px-1">
              {cards.map((c, j) => (
                <AllInHoleCard key={j} card={c} highlight={highlightKeys} animate={isAllIn || actionEnded} />
              ))}
            </div>
          )}

          {/* Right: Equity % & Position */}
          <div className="flex flex-col items-end shrink-0 pl-1 leading-none z-10 gap-0.5">
            {(isAllIn || actionEnded) && (
              <span
                className={`font-black tabular-nums text-xs sm:text-[13px] ${
                  isCurrentActor ? 'text-black' : 'text-white'
                }`}
              >
                {formatEquity(eqVal, isSecured, isMultipleBoards)}
              </span>
            )}
            <span
              className={`text-[10px] uppercase tracking-wider font-extrabold ${
                isCurrentActor ? 'text-black' : 'text-slate-300'
              }`}
            >
              {formatPosition(item.position)}
            </span>
          </div>
        </div>

        {/* BOTTOM BAR: Left stack, right action area */}
        <div className="bg-black px-2.5 py-1 relative flex items-center justify-between border-t border-black min-h-[30px]">
          <div className="text-[#f3d058] font-black tabular-nums text-xs tracking-tight shrink-0 z-10">
            {stackShown(p) ? formatPlayerTagAmount(p.stack, cur, hand, false, activeUnit) : '—'}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-10">
            {(isWinner || hasWonBoard) && wonTotal > 0 ? (
              <span className="tabular-nums font-black text-xs text-emerald-400 flex items-center gap-1 font-extrabold tracking-wide">
                ✓ {money(playerProfit, cur)}
              </span>
            ) : (
              <span
                className={`tabular-nums font-black text-[10px] uppercase tracking-wide truncate ${
                  hasWonBoard
                    ? 'text-emerald-300 font-extrabold'
                    : displayActionText.startsWith('All in') || displayActionText.startsWith('All-in') || displayActionText === 'ALL-IN'
                    ? 'text-rose-400'
                    : displayActionText.includes('TO CALL')
                    ? 'text-cyan-300 animate-pulse'
                    : displayActionText === 'Fold'
                    ? 'text-slate-400'
                    : 'text-white'
                }`}
              >
                {displayActionText}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render outs display block for a player (multi-row wrap, NO scrollbar)
  const renderPlayerOuts = (item) => {
    const p = item.player;
    const myOuts = outsByPlayerId[p.id];

    if (activeBoardLen < 3 || activeBoardLen >= 5) {
      return null;
    }

    if (myOuts && myOuts.length > 0) {
      return (
        <div className="flex flex-col gap-1 max-w-[340px] items-start shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-amber-400 tabular-nums">
              {myOuts.length} {myOuts.length === 1 ? 'OUT' : 'OUTS'}
            </span>
          </div>
          {/* Multi-row wrap with NO scrollbar */}
          <div className="flex flex-wrap gap-1 justify-start">
            {myOuts.map((c, ci) => (
              <AllInOutCard key={ci} card={c} />
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // Split into left and right sides when 5+ players
  const isFiveOrMore = sortedContestants.length >= 5;
  const splitIndex = isFiveOrMore ? Math.ceil(sortedContestants.length / 2) : sortedContestants.length;
  const leftContestants = sortedContestants.slice(0, splitIndex);
  const rightContestants = isFiveOrMore ? sortedContestants.slice(splitIndex) : [];

  const hasAwarded = isMultipleBoards && boardWinningsInfo.totalAwardedSoFar > 0;
  const remainingPot = Math.max(0, Math.round(totalPot - boardWinningsInfo.totalAwardedSoFar));
  const displayPot = hasAwarded ? remainingPot : totalPot;

  return (
    <div className="relative w-full min-h-[500px] rounded-[2rem] border-2 border-[#364536] bg-gradient-to-b from-[#14181e] via-[#111419] to-[#0c0f13] overflow-hidden p-4 flex flex-col justify-between shadow-2xl select-none transition-all duration-700 ease-in-out">
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
          {computedEquity && Number(computedEquity.split) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300 ml-1">
              <span>Split:</span>
              <span className="tabular-nums text-amber-200">{formatEquity(computedEquity.split)}</span>
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

      {/* WHEN ACTION HAS ENDED: Redesigned Layout (Graphics slide to new position) */}
      {actionEnded ? (
        <div className="relative z-10 flex-1 flex flex-col justify-between mt-3 gap-4 min-h-0 transition-all duration-700 ease-in-out">
          {/* TOP / MIDDLE SECTION: Player Tags and Outs Area */}
          <div className="flex-1 flex flex-row items-stretch justify-between gap-6 overflow-x-auto py-1 min-h-[280px]">
            {/* Left Side: Player Tags (or Left half if 5+) */}
            <div className="flex flex-col justify-start gap-2.5 shrink-0">
              {leftContestants.map((item) => (
                <div key={item.player.id} className="flex items-center gap-3">
                  {renderPlayerTag(item)}
                  {renderPlayerOuts(item)}
                </div>
              ))}
            </div>

            {/* Right Side: Second half of Player Tags (when 5+) */}
            {isFiveOrMore && (
              <div className="flex flex-col justify-start gap-2.5 shrink-0">
                {rightContestants.map((item) => (
                  <div key={item.player.id} className="flex items-center gap-3">
                    {renderPlayerTag(item)}
                    {renderPlayerOuts(item)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTTOM BAR: Pot on Bottom-Left, Active Board Bottom-Center, Previous Boards on Right */}
          <div className="w-full rounded-2xl border border-[#2b3748] bg-gradient-to-r from-[#111620] via-[#141b26] to-[#111620] p-3.5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 transition-all duration-700">
            {/* Bottom-Left: Pot Size */}
            <div className="flex flex-col items-start min-w-[180px] shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {hasAwarded ? 'Remaining Pot' : 'Total Pot'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight drop-shadow">
                {potShown ? formatPotAmount(displayPot, cur, hand, activeUnit) : '—'}
              </div>
              {hasAwarded && potShown && (
                <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                  Awarded: {formatPotAmount(boardWinningsInfo.totalAwardedSoFar, cur, hand, activeUnit)}
                </div>
              )}
              {potShown && sidePots.length > 0 && (
                <div className="text-[10px] text-amber-300 font-semibold mt-0.5">
                  Side pots: {sidePots.map((sp) => formatSidePotAmount(sp.amount, cur, hand, activeUnit)).join(' / ')}
                </div>
              )}
            </div>

            {/* Bottom-Center: Active Board */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {currentActiveName}
                </span>
                <span className="text-[11px] font-black text-emerald-400 uppercase">
                  {STREET_LABEL[hand?.street] || 'Preflop'}
                </span>
              </div>
              <div className="relative flex gap-1.5 items-center justify-center">
                {animKey > 0 && (
                  <div
                    key={`burn-${animKey}`}
                    className="burn-card absolute -left-3 top-0 w-10 h-14 rounded-lg bg-[#3a4a3a] border border-[#4a5a4a] flex items-center justify-center pointer-events-none z-20 shadow-md"
                  >
                    <span className="text-[#7fae7f] text-xs font-bold">?</span>
                  </div>
                )}
                {[0, 1, 2, 3, 4].map((i) => {
                  const c = currentActiveBoard?.[i];
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
            </div>

            {/* Bottom-Right: Saved Previous Completed Boards (when running multiple times) */}
            <div className="flex items-center justify-end min-w-[180px] shrink-0">
              {previousCompletedBoards.length > 0 ? (
                <div className="flex flex-col gap-1.5 items-end">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Completed Boards
                  </span>
                  <div className="flex flex-col gap-1">
                    {previousCompletedBoards.map((b) => (
                      <div key={b.id} className="flex items-center gap-1.5 bg-[#171f2c] border border-slate-700/80 rounded-xl px-2 py-1 shadow-md">
                        <span className="text-[10px] font-extrabold text-amber-300 uppercase shrink-0">
                          {b.name}:
                        </span>
                        <div className="flex gap-1">
                          {b.cards.map((c, ci) => (
                            <AllInBoardCard key={ci} card={c} compact={true} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Showdown</div>
                  <div className="text-xs font-semibold text-slate-300">Action Complete</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* WHEN ACTION IS STILL IN PROGRESS: Standard Layout */
        <div className="relative z-10 flex-1 flex flex-col md:flex-row gap-4 items-stretch mt-3 min-h-0">
          {/* Left: Player tags stacked vertically */}
          <div className="flex-1 flex flex-row items-end gap-5 overflow-x-auto overflow-y-hidden pb-1 min-h-[380px]">
            {(() => {
              const col1 = sortedContestants.slice(0, 5);
              const col2 = sortedContestants.slice(5, 10);

              return (
                <>
                  <div className="flex flex-col-reverse justify-start gap-2.5">
                    {col1.map((item) => (
                      <div key={item.player.id} className="flex items-center gap-2">
                        {renderPlayerTag(item)}
                      </div>
                    ))}
                  </div>

                  {col2.length > 0 && (
                    <div className="flex flex-col-reverse justify-start gap-2.5">
                      {col2.map((item) => (
                        <div key={item.player.id} className="flex items-center gap-2">
                          {renderPlayerTag(item)}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
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
                <span className={`text-xl font-black tabular-nums tracking-tight ${clockSecondsLeft > 10 ? 'text-emerald-400' : clockSecondsLeft > 5 ? 'text-amber-400' : 'text-rose-400'}`}>
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
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Total Pot
              </div>
              <div className="text-2xl font-black text-white tabular-nums drop-shadow">
                {potShown ? formatPotAmount(displayPot, cur, hand, activeUnit) : '—'}
              </div>
              {potShown && sidePots.length > 0 && (
                <div className="text-[11px] text-amber-300 font-semibold mt-0.5">
                  Side pots: {sidePots.map((sp) => formatSidePotAmount(sp.amount, cur, hand, activeUnit)).join(' / ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
