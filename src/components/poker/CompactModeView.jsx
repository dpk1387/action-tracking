import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Maximize2, Undo2, Clock, ArrowRight, Zap, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  money,
  parseAmount,
  formatBlinds,
  formatSessionName,
  formatPotAmount,
  formatPotOutcome,
  formatBetAmount,
  formatPlayerTagAmount,
  bettingFrozen,
  hasSoleDeepestStack,
  effectiveHoleSize,
  holeCardsComplete,
  STREET_LABEL,
  potTotal,
  RANKS,
  SUITS,
  evaluateWinners,
} from '@/lib/poker';
import {
  levelTimerState,
  formatTimer,
  formatTimerLabel,
  scheduledLevelNumber,
} from '@/lib/levelTimer';

function KeyBadge({ label }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 ml-1.5 text-[10px] font-black rounded bg-black/50 text-amber-300 border border-amber-500/30 uppercase tracking-wider select-none leading-none">
      {label}
    </kbd>
  );
}

const SUIT_INFO = {
  s: { symbol: '♠', color: 'text-slate-200', bg: 'bg-slate-800 border-slate-600', name: 'Spades' },
  h: { symbol: '♥', color: 'text-rose-400', bg: 'bg-rose-950/80 border-rose-600', name: 'Hearts' },
  d: { symbol: '♦', color: 'text-blue-400', bg: 'bg-blue-950/80 border-blue-600', name: 'Diamonds' },
  c: { symbol: '♣', color: 'text-emerald-400', bg: 'bg-emerald-950/80 border-emerald-600', name: 'Clubs' },
};

export default function CompactModeView({
  hand,
  onAction,
  onUndo,
  canUndo = false,
  onExitCompact,
  hideAmounts = false,
  onToggleHideAmounts,
  onDeal,
  onDealBoard,
  onFillBoard,
  onDealHidden,
  onRunIt,
  onNextHand,
  now,
  actionClockSecondsLeft = null,
  actionClockType = null,
  handleCallClock = null,
  onEndHand = null,
  holeCards = {},
  onHoleChange = null,
  equity = null,
  onSetBoardCards = null,
  onOpenTempGameModal = null,
}) {
  const [raiseAmount, setRaiseAmount] = useState('');
  const [muckArmed, setMuckArmed] = useState(false);
  const raiseInputRef = useRef(null);

  // All-in card entry state
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [selectedRank, setSelectedRank] = useState(null);

  const cp = hand.currentPlayer >= 0 ? hand.players[hand.currentPlayer] : null;
  const cur = hand.currency;
  const gt = hand.gameType || 'nl';
  const isPL = gt === 'pl' || gt === 'pot_limit';
  const isFL = gt === 'fl' || gt === 'fixed_limit';
  const isCash = hand.mode === 'cash';

  useEffect(() => {
    setRaiseAmount('');
    setMuckArmed(false);
  }, [hand.currentPlayer, hand.street]);

  const ootForCurrent = cp && Array.isArray(hand.ootActions)
    ? hand.ootActions.find((o) => o.playerId === cp.id && o.street === hand.street)
    : null;
  const passiveBoundThisStreet = cp && hand.passiveBound && hand.passiveBound[cp.id] === hand.street;
  const ootPassiveBound = !!(ootForCurrent && ootForCurrent.kind === 'passive') || passiveBoundThisStreet;

  const toCall = cp ? Math.max(0, hand.currentBet - cp.currentBet) : 0;
  const canCheck = cp ? toCall === 0 : false;
  const callAmt = cp ? Math.min(toCall, cp.stack) : 0;
  const maxTotalCommitment = cp ? cp.currentBet + cp.stack : 0;
  const nonFolded = hand.players.filter((p) => p.status !== 'folded');
  const otherNonFolded = cp ? nonFolded.filter((p) => p.id !== cp.id) : [];
  const othersHaveChips = otherNonFolded.some((p) => (p.stack || 0) > 0);
  const canReopenRaise = cp ? (!hand.shortAllinOpen || !cp.hasActed || cp.currentBet < hand.currentBet) : false;
  const canRaise = cp ? (cp.stack > toCall && canReopenRaise && othersHaveChips) : false;
  const mustAllinToCall = cp ? (!canCheck && cp.stack < toCall) : false;

  const effectiveLiveBlind = (hand.street === 'preflop')
    ? (hand.anteType === 'four_blinds'
        ? (Number(hand.fourthBlind) || (hand.bigBlind * 4))
        : hand.anteType === 'three_blinds'
        ? (Number(hand.thirdBlind) || (hand.bigBlind * 2))
        : hand.bigBlind)
    : hand.bigBlind;

  const minRaise = hand.currentBet === 0
    ? hand.bigBlind
    : (hand.street === 'preflop' && (!hand.raiseLevel || hand.raiseLevel <= 1))
    ? Math.max(hand.currentBet * 2, hand.currentBet + (hand.lastRaiseAmount || effectiveLiveBlind))
    : (hand.currentBet + Math.max(hand.lastRaiseAmount || 0, hand.bigBlind || 1));
  const isBet = hand.currentBet === 0;

  const potNow = hand.players.reduce((s, p) => s + (p.totalBet || 0), 0);
  const facingBet = hand.currentBet;
  const potRaiseTo = isBet ? potNow : (potNow - facingBet) + 3 * facingBet;
  const potChips = cp ? potRaiseTo - cp.currentBet : 0;
  const canCoverPot = cp ? (potChips > 0 && potChips <= cp.stack && othersHaveChips) : false;

  const potAction = !othersHaveChips
    ? () => onAction('call')
    : canCoverPot
    ? () => onAction(isBet ? 'bet' : 'raise', potRaiseTo)
    : () => onAction('allin');
  const potLabel = !othersHaveChips ? 'Call' : canCoverPot ? 'Pot' : 'All-in';
  const overLimit = isPL && raiseAmount !== '' && (parseAmount(raiseAmount) ?? 0) > potRaiseTo;

  const flSize = (hand.street === 'preflop' || hand.street === 'flop') ? (hand.smallBet || hand.bigBlind) : (hand.bigBet || hand.bigBlind * 2);
  const flRaiseTo = hand.currentBet + flSize;
  const flCap = (hand.raiseLevel || 0) >= ((hand.flMaxRaises || 4) + 1);
  const flRaiseChips = isBet ? flSize : (flRaiseTo - (cp?.currentBet || 0));
  const flCanRaise = cp && !flCap && cp.stack > toCall && cp.stack >= flRaiseChips && othersHaveChips;
  const flLabel = isBet ? `Bet ${money(flRaiseChips, cur)}` : `Raise ${money(flRaiseTo, cur)}`;
  const callLabel = cp?.stack < toCall ? 'All-in' : `Call ${money(toCall, cur)}`;

  const canStraddle = cp && !isFL && !isPL && hand.street === 'preflop' && hand.straddleOpen
    && (hand.straddleLevel || 0) < (hand.maxStraddles || 0) && !cp.hasActed && cp.status === 'active';
  const highestBlind = Math.max(
    hand.bigBlind || 0,
    Number(hand.thirdBlind) || 0,
    Number(hand.fourthBlind) || 0
  );
  const defaultBaseStraddle = hand.straddleAmount || (highestBlind * 2);
  const straddleAmt = (hand.straddleLevel || 0) === 0
    ? defaultBaseStraddle
    : (defaultBaseStraddle * Math.pow(2, hand.straddleLevel || 0));
  const straddlePutsAllIn = cp ? cp.stack <= (straddleAmt - cp.currentBet) : false;
  const straddleLabel = straddlePutsAllIn ? 'All-in' : `Straddle ${money(straddleAmt, cur)}`;

  const submitRaise = () => {
    if (!cp) return;
    if (!othersHaveChips) {
      onAction('call');
      return;
    }
    const v = parseAmount(raiseAmount);
    if (v == null) return;
    const isAllinAmount = v === maxTotalCommitment;
    if (v < minRaise && !isAllinAmount) return;
    if (v > maxTotalCommitment) return;
    if (isPL && v > potRaiseTo) return;
    if (isAllinAmount) {
      onAction('allin');
    } else {
      onAction(isBet ? 'bet' : 'raise', v);
    }
  };

  const submitAllin = () => {
    if (!cp) return;
    if (!othersHaveChips && toCall > 0) {
      onAction('call');
      return;
    }
    onAction('allin');
  };

  const minRaiseVal = Math.min(minRaise, maxTotalCommitment);
  const minRaiseClamped = isPL ? Math.min(minRaiseVal, potRaiseTo) : minRaiseVal;
  const canMinRaise = canRaise && minRaiseClamped > (cp?.currentBet || 0);
  const submitMinRaise = () => {
    if (!cp) return;
    if (!othersHaveChips) {
      onAction('call');
      return;
    }
    if (!canMinRaise) return;
    onAction(isBet ? 'bet' : 'raise', minRaiseClamped);
  };
  const minRaiseLabel = `${isBet ? 'Min bet' : 'Min raise'} ${money(minRaiseClamped, cur)}`;

  const handleFold = () => {
    if (canCheck) {
      if (!muckArmed) {
        setMuckArmed(true);
        return;
      }
      setMuckArmed(false);
    }
    onAction('fold');
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;
      if (isInput) {
        if (e.key === 'Escape') {
          activeEl.blur();
        }
        return;
      }

      // Shift + A -> All in
      if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (cp && (!mustAllinToCall && !ootPassiveBound)) {
          if (isPL) potAction();
          else submitAllin();
        } else if (cp && mustAllinToCall) {
          submitAllin();
        }
        return;
      }

      // Ctrl + Z or Cmd + Z -> Undo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (canUndo && onUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toUpperCase();

      if (!cp) return;

      if (key === 'F') {
        e.preventDefault();
        handleFold();
      } else if (key === 'X') {
        if (canCheck) {
          e.preventDefault();
          onAction('check');
        }
      } else if (key === 'C') {
        if (!canCheck && !mustAllinToCall) {
          e.preventDefault();
          onAction('call');
        }
      } else if (key === 'R') {
        if (isFL) {
          if (flCanRaise && !mustAllinToCall && !ootPassiveBound) {
            e.preventDefault();
            onAction(isBet ? 'bet' : 'raise', flRaiseTo);
          }
        } else if (canRaise && !mustAllinToCall && !ootPassiveBound) {
          e.preventDefault();
          raiseInputRef.current?.focus();
          raiseInputRef.current?.select();
        }
      } else if (key === 'M') {
        if (canMinRaise && !mustAllinToCall && !ootPassiveBound) {
          e.preventDefault();
          submitMinRaise();
        }
      } else if (key === 'S') {
        if (canStraddle && !mustAllinToCall && !ootPassiveBound) {
          e.preventDefault();
          onAction(straddlePutsAllIn ? 'allin' : 'straddle', straddleAmt);
        }
      } else if (key === 'P') {
        if (isPL && !mustAllinToCall && !ootPassiveBound) {
          e.preventDefault();
          potAction();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cp, canCheck, toCall, mustAllinToCall, canRaise, canMinRaise, minRaiseClamped,
    canStraddle, straddleAmt, straddlePutsAllIn, isPL, isFL, flCanRaise, flRaiseTo,
    isBet, ootPassiveBound, onUndo, canUndo, muckArmed
  ]);

  const timerState = hand ? levelTimerState(hand, now) : null;
  const currentLevelNum = hand ? scheduledLevelNumber(hand) : 1;
  const isTourney = hand.mode === 'tournament';
  const frozen = bettingFrozen(hand);
  const actionDone = !cp || frozen || hand.phase === 'ended' || hand.phase === 'awarded' || hand.currentPlayer === -1;

  const allInContestants = nonFolded.filter((p) => p.status === 'allin' || p.stack <= 0);
  const isMultiAllIn = (allInContestants.length >= 2) || (allInContestants.length >= 1 && nonFolded.length >= 2 && frozen);
  const cardsALen = (hand.communityCards || []).filter((c) => c && !c.hidden).length;
  const canRunIt = isCash && isMultiAllIn && actionDone && (!hand.runTimes || Number(hand.runTimes) <= 1) && !hand.runItSelected && cardsALen < 5 && hand.phase !== 'awarded';

  // All-in Showdown Condition: ONLY trigger when there is NO MORE ACTION!
  const isAllInShowdown = nonFolded.length >= 2 && actionDone && (
    frozen ||
    allInContestants.length >= 2 ||
    (allInContestants.length >= 1 && nonFolded.length >= 2) ||
    hand.street === 'river' ||
    hand.phase === 'ended' ||
    hand.phase === 'awarded'
  );

  const holeSize = effectiveHoleSize(hand);
  const isMultiRun = Number(hand.runTimes) >= 2;
  const isTripleRun = Number(hand.runTimes) >= 3;
  const numBoards = isTripleRun ? 3 : isMultiRun ? 2 : (hand.doubleBoard ? 2 : 1);

  const compactBoardWinnings = useMemo(() => {
    if (numBoards <= 1 || !hand) return {};
    const totalPot = hand.players.reduce((s, p) => s + (p.totalBet || 0), 0);
    const boardShare = totalPot / numBoards;
    const eligiblePids = nonFolded.map((p) => p.id).filter((id) => holeCards[id] && holeCards[id].length > 0);
    if (eligiblePids.length < 2) return {};

    const cardsA = (hand.communityCards || []).filter((c) => c && !c.hidden);
    const cardsB = (hand.boardB || []).filter((c) => c && !c.hidden);
    const cardsC = (hand.boardC || []).filter((c) => c && !c.hidden);

    const winnings = {};
    const variant = hand.variant || 'nlh';
    const hs = effectiveHoleSize(hand);

    if (cardsA.length === 5) {
      const wa = evaluateWinners(eligiblePids, holeCards, cardsA, variant, hs);
      if (wa && wa.length > 0) {
        const share = Math.round((boardShare / wa.length) * 100) / 100;
        wa.forEach((id) => { winnings[id] = (winnings[id] || 0) + share; });
      }
    }
    if (cardsB.length === 5) {
      const wb = evaluateWinners(eligiblePids, holeCards, cardsB, variant, hs);
      if (wb && wb.length > 0) {
        const share = Math.round((boardShare / wb.length) * 100) / 100;
        wb.forEach((id) => { winnings[id] = (winnings[id] || 0) + share; });
      }
    }
    if (numBoards >= 3 && cardsC.length === 5) {
      const wc = evaluateWinners(eligiblePids, holeCards, cardsC, variant, hs);
      if (wc && wc.length > 0) {
        const share = Math.round((boardShare / wc.length) * 100) / 100;
        wc.forEach((id) => { winnings[id] = (winnings[id] || 0) + share; });
      }
    }
    return winnings;
  }, [numBoards, hand, nonFolded, holeCards]);

  // Ordered slots sequence for card entry:
  // First player card 1, first player card 2, second player card 1, etc., then community cards!
  const orderedSlots = useMemo(() => {
    const slots = [];
    // 1. Contestant hole cards in order
    nonFolded.forEach((p) => {
      const pHoles = holeCards[p.id] || [];
      for (let k = 0; k < holeSize; k++) {
        const card = pHoles[k] || null;
        slots.push({
          id: `h_${p.id}_${k}`,
          type: 'hole',
          playerId: p.id,
          player: p,
          cardIdx: k,
          label: `${p.name} Card ${k + 1}`,
          shortLabel: `${p.name} #${k + 1}`,
          card,
        });
      }
    });

    // 2. Community board cards in order
    for (let b = 1; b <= numBoards; b++) {
      const bCards = (b === 1 ? hand.communityCards : b === 2 ? hand.boardB : hand.boardC) || [];
      for (let s = 0; s < 5; s++) {
        const card = bCards[s] && !bCards[s].hidden ? bCards[s] : null;
        const streetName = s < 3 ? `Flop ${s + 1}` : s === 3 ? 'Turn' : 'River';
        slots.push({
          id: `b_${b}_${s}`,
          type: 'board',
          boardIndex: b,
          cardIdx: s,
          label: numBoards > 1 ? `Board ${b} ${streetName}` : streetName,
          shortLabel: numBoards > 1 ? `B${b} ${s < 3 ? `F${s + 1}` : s === 3 ? 'T' : 'R'}` : (s < 3 ? `F${s + 1}` : s === 3 ? 'T' : 'R'),
          card,
        });
      }
    }
    return slots;
  }, [nonFolded, holeCards, holeSize, numBoards, hand.communityCards, hand.boardB, hand.boardC]);

  // Determine active slot
  const currentSlot = useMemo(() => {
    if (activeSlotId) {
      const found = orderedSlots.find((s) => s.id === activeSlotId);
      if (found) return found;
    }
    const firstEmpty = orderedSlots.find((s) => !s.card);
    return firstEmpty || orderedSlots[0] || null;
  }, [activeSlotId, orderedSlots]);

  // Set card in current slot and advance
  const handlePickCard = (card) => {
    if (!currentSlot) return;

    if (currentSlot.type === 'hole') {
      const curHole = (holeCards[currentSlot.playerId] || []).slice();
      curHole[currentSlot.cardIdx] = card;
      if (onHoleChange) {
        onHoleChange(currentSlot.playerId, curHole);
      }
    } else if (currentSlot.type === 'board') {
      const curBoard = ((currentSlot.boardIndex === 1 ? hand.communityCards : currentSlot.boardIndex === 2 ? hand.boardB : hand.boardC) || []).slice();
      curBoard[currentSlot.cardIdx] = card;
      if (onSetBoardCards) {
        onSetBoardCards(currentSlot.boardIndex, curBoard);
      } else if (onDealBoard) {
        onDealBoard(currentSlot.boardIndex, [card]);
      }
    }

    // Auto-advance to next slot
    const curIdx = orderedSlots.findIndex((s) => s.id === currentSlot.id);
    if (curIdx >= 0 && curIdx < orderedSlots.length - 1) {
      setActiveSlotId(orderedSlots[curIdx + 1].id);
    }
    setSelectedRank(null);
  };

  const handleClearCurrentSlot = () => {
    if (!currentSlot) return;
    if (currentSlot.type === 'hole') {
      const curHole = (holeCards[currentSlot.playerId] || []).slice();
      curHole.splice(currentSlot.cardIdx, 1);
      if (onHoleChange) onHoleChange(currentSlot.playerId, curHole);
    } else if (currentSlot.type === 'board') {
      const curBoard = ((currentSlot.boardIndex === 1 ? hand.communityCards : currentSlot.boardIndex === 2 ? hand.boardB : hand.boardC) || []).slice();
      curBoard.splice(currentSlot.cardIdx, 1);
      if (onSetBoardCards) onSetBoardCards(currentSlot.boardIndex, curBoard);
    }
    const curIdx = orderedSlots.findIndex((s) => s.id === currentSlot.id);
    if (curIdx > 0) {
      setActiveSlotId(orderedSlots[curIdx - 1].id);
    }
    setSelectedRank(null);
  };

  // Used cards set to prevent duplicates
  const usedCardsSet = useMemo(() => {
    const set = new Set();
    Object.values(holeCards || {}).forEach((cards) => {
      (cards || []).forEach((c) => { if (c) set.add(c.rank + c.suit); });
    });
    (hand.communityCards || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    (hand.boardB || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    (hand.boardC || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    return set;
  }, [holeCards, hand.communityCards, hand.boardB, hand.boardC]);

  return (
    <div className={`w-full ${holeSize >= 4 ? 'max-w-3xl' : 'max-w-xl'} mx-auto flex flex-col gap-3 p-2 sm:p-4 select-none`}>
      {/* 1. COMPACT TOP BAR: Level, Clock, Undo, Standard View */}
      <div className="flex items-center justify-between bg-[#151921] border border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-xl">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>{isTourney ? `Level ${currentLevelNum} · ${formatSessionName(hand)}` : formatSessionName(hand)}</span>
            {hand.inBreak && <span className="text-amber-400 font-extrabold">· BREAK</span>}
          </div>
          <div className="text-sm sm:text-base font-black text-white tabular-nums tracking-tight">
            {formatBlinds(hand)}
          </div>
        </div>

        {/* Level Timer / Countdown Clock */}
        {timerState?.active && (
          <div className="flex flex-col items-center px-2">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
              {timerState.expired ? 'Time' : 'Clock'}
            </span>
            <span className={`text-lg sm:text-2xl font-black tabular-nums tracking-tight drop-shadow ${
              timerState.expired ? 'text-rose-400 animate-pulse' : 'text-amber-300'
            }`}>
              {formatTimer(timerState)}
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {isCash && onOpenTempGameModal && (
            <button
              type="button"
              onClick={onOpenTempGameModal}
              title="Temporary Game Schedule"
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border shadow transition-colors cursor-pointer ${
                hand?.isTemporaryGame
                  ? 'bg-amber-950 border-amber-500 text-amber-200 animate-pulse'
                  : (hand?.temporaryGames || []).length > 0
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-300'
                  : 'bg-[#222834] hover:bg-[#2d3545] text-slate-300 border-slate-700/60'
              }`}
            >
              <Zap size={13} className="text-amber-400" />
              <span className="hidden sm:inline">Temp</span>
              {(hand?.temporaryGames || []).length > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-amber-500 text-black font-black font-mono">
                  {(hand?.temporaryGames || []).length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last action (Shortcut: Ctrl+Z)"
            className="px-2.5 py-1.5 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 border border-slate-700/60 shadow transition-colors"
          >
            <Undo2 size={13} />
            <span className="hidden sm:inline">Undo</span>
            <KeyBadge label="^Z" />
          </button>
          <button
            type="button"
            onClick={onExitCompact}
            title="Switch back to Standard table view"
            className="px-2.5 py-1.5 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700/60 shadow transition-colors cursor-pointer"
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">Full View</span>
          </button>
        </div>
      </div>

      {/* 2. STREET BAR (Total pot display removed as requested) */}
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#11141b] border border-slate-800/90 text-xs shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-slate-400">Street</span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-[11px] font-black uppercase">
            {STREET_LABEL[hand.street] || 'Preflop'}
          </span>
          {Number(hand.runTimes) >= 2 && (
            <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-600/60 text-purple-300 text-[10px] font-extrabold">
              Run {hand.runTimes}x
            </span>
          )}
        </div>
      </div>

      {/* 3. ALL-IN SHOWDOWN CARD ENTRY (When 2+ players all in or betting complete) */}
      {isAllInShowdown ? (
        <div className="rounded-2xl bg-[#141922] border-2 border-amber-500/80 p-3.5 shadow-2xl flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-300 text-[11px] font-black uppercase tracking-wider animate-pulse">
                All-In Showdown
              </span>
              {canRunIt && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRunIt && onRunIt(2)}
                    className="px-2 py-0.5 rounded bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-500 text-emerald-200 text-[10px] font-bold cursor-pointer"
                  >
                    Run 2x
                  </button>
                  <button
                    type="button"
                    onClick={() => onRunIt && onRunIt(3)}
                    className="px-2 py-0.5 rounded bg-purple-900/80 hover:bg-purple-800 border border-purple-500 text-purple-200 text-[10px] font-bold cursor-pointer"
                  >
                    Run 3x
                  </button>
                </div>
              )}
            </div>
            {canUndo && hand.phase === 'awarded' && (
              <button
                type="button"
                onClick={onUndo}
                className="text-[11px] text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer"
                title="Undo pot award to fix mistyped river card"
              >
                <Undo2 size={12} />
                <span>Fix River (Undo)</span>
              </button>
            )}
          </div>

          {/* Step 1: Contestant Hole Cards in Order */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>1. Enter Contestants' Hole Cards:</span>
              <span className="text-[10px] text-amber-300 lowercase font-medium">select slot then pick rank + suit</span>
            </div>
            <div className="space-y-2">
              {nonFolded.map((p) => {
                const isBtn = hand.players.findIndex((pl) => pl.seat === hand.buttonSeat) === hand.players.findIndex((pl) => pl.id === p.id);
                const pPct = equity?.byId ? equity.byId[p.id] : null;

                const wonAmt = compactBoardWinnings[p.id];

                return (
                  <div key={p.id} className="flex items-center justify-between bg-[#19202b] rounded-xl px-2.5 py-1.5 border border-slate-700/80 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold text-white truncate shrink-0">{p.name}</span>
                      {isBtn && (
                        <span className="px-1.5 py-0.2 rounded bg-black/60 border border-slate-700 text-[9px] font-black text-slate-300 uppercase shrink-0">
                          BTN
                        </span>
                      )}
                      {!isCash && (
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          (Seat {p.seat})
                        </span>
                      )}
                      <span className="text-amber-300 font-mono text-xs font-bold tabular-nums shrink-0">
                        {formatPlayerTagAmount(p.stack, cur, hand)}
                      </span>
                      {wonAmt != null && wonAmt > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-black shrink-0 animate-bounce">
                          ✓ {money(wonAmt - (p.totalBet || 0), cur)}
                        </span>
                      )}
                    </div>
                    {/* Card slots for this player WITH equity badge to the left of cards */}
                    <div className="flex items-center gap-2 shrink-0">
                      {pPct != null && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 font-mono text-xs font-black shadow-sm">
                          {Math.round(pPct)}%
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: holeSize }, (_, k) => {
                          const slotId = `h_${p.id}_${k}`;
                          const card = (holeCards[p.id] || [])[k];
                          const isCurrent = currentSlot?.id === slotId;
                          const sInfo = card ? SUIT_INFO[card.suit] : null;

                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setActiveSlotId(slotId)}
                              className={`${holeSize >= 5 ? 'w-7 h-10 text-[10px]' : holeSize === 4 ? 'w-8 h-11 text-xs' : 'w-9 h-11 text-xs'} rounded-lg flex flex-col items-center justify-center font-bold border transition-all cursor-pointer ${
                                isCurrent
                                  ? 'border-amber-400 bg-amber-950/60 shadow-[0_0_10px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/80 scale-105'
                                  : card
                                  ? 'bg-[#151921] border-slate-600'
                                  : 'bg-[#11141b] border-dashed border-slate-700 text-slate-500 hover:border-slate-500'
                              }`}
                            >
                              {card ? (
                                <>
                                  <span className="leading-none text-white text-[11px] font-black">{card.rank === 'T' ? '10' : card.rank}</span>
                                  <span className={`leading-none text-sm font-extrabold ${sInfo?.color || ''}`}>{sInfo?.symbol}</span>
                                </>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500">#{k + 1}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Community Cards in Order (Quick Fill removed) */}
          <div className="border-t border-slate-800/80 pt-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>2. Enter Community Board Cards:</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: numBoards }, (_, bIdx) => {
                const bNum = bIdx + 1;
                const bCards = (bNum === 1 ? hand.communityCards : bNum === 2 ? hand.boardB : hand.boardC) || [];
                return (
                  <div key={bNum} className="flex items-center justify-between bg-[#19202b] rounded-xl px-2.5 py-1.5 border border-slate-700/80">
                    <span className="text-xs font-bold text-slate-300">
                      {numBoards > 1 ? `Board ${bNum}` : 'Board'}
                    </span>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {Array.from({ length: 5 }, (_, s) => {
                        const slotId = `b_${bNum}_${s}`;
                        const card = bCards[s] && !bCards[s].hidden ? bCards[s] : null;
                        const isCurrent = currentSlot?.id === slotId;
                        const sInfo = card ? SUIT_INFO[card.suit] : null;
                        const streetLabel = s < 3 ? 'Flop' : s === 3 ? 'Turn' : 'River';

                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setActiveSlotId(slotId)}
                            className={`w-9 h-11 rounded-lg flex flex-col items-center justify-center font-bold text-xs border transition-all cursor-pointer ${
                              isCurrent
                                ? 'border-amber-400 bg-amber-950/60 shadow-[0_0_10px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/80 scale-105'
                                : card
                                ? 'bg-[#151921] border-slate-600'
                                : 'bg-[#11141b] border-dashed border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}
                          >
                            {card ? (
                              <>
                                <span className="leading-none text-white text-[11px] font-black">{card.rank === 'T' ? '10' : card.rank}</span>
                                <span className={`leading-none text-sm font-extrabold ${sInfo?.color || ''}`}>{sInfo?.symbol}</span>
                              </>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-500">{streetLabel[0]}{s < 3 ? s + 1 : ''}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Card Selection Keyboard OR Pots Awarded Outcome (In-place!) */}
          {hand.phase === 'awarded' ? (
            <div className="rounded-xl bg-[#111812] border-2 border-emerald-600/70 p-3.5 flex flex-col gap-2.5 shadow-xl animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                  <CheckCircle2 size={16} />
                  <span>Pots Awarded</span>
                </div>
                {canUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="text-[11px] text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer"
                    title="Undo pot award to fix mistyped river card"
                  >
                    <Undo2 size={12} />
                    <span>Fix River (Undo)</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5 py-1">
                {(hand.pots || []).map((pot, i) => {
                  const summary = formatPotOutcome(pot, i, hand.winners, hand.players, hand.currency);
                  if (!summary) return null;
                  return (
                    <div key={i} className="text-xs sm:text-sm font-semibold text-slate-200 bg-black/40 rounded-xl px-3 py-2 border border-slate-800">
                      {summary}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onNextHand}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <span>Confirm & Next Hand</span>
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-[#0e1219] border border-slate-800 p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">
                  Filling: <span className="text-amber-300 font-extrabold">{currentSlot?.label || 'Select Slot'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearCurrentSlot}
                  className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded font-bold cursor-pointer"
                >
                  Clear / Back
                </button>
              </div>

              {/* Rank Row */}
              <div className="grid grid-cols-13 gap-1">
                {['A','K','Q','J','T','9','8','7','6','5','4','3','2'].map((r) => {
                  const isSelected = selectedRank === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRank(r)}
                      className={`py-2 rounded-md font-black text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-black shadow-md ring-1 ring-amber-300 scale-105'
                          : 'bg-[#1d2430] hover:bg-[#283244] text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      {r === 'T' ? '10' : r}
                    </button>
                  );
                })}
              </div>

              {/* Suit Row */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {Object.entries(SUIT_INFO).map(([suitKey, info]) => {
                  const cardKey = selectedRank ? (selectedRank + suitKey) : null;
                  const isUsed = cardKey ? usedCardsSet.has(cardKey) : false;

                  return (
                    <button
                      key={suitKey}
                      type="button"
                      disabled={!selectedRank || isUsed}
                      onClick={() => {
                        if (selectedRank && !isUsed) {
                          handlePickCard({ rank: selectedRank, suit: suitKey });
                        }
                      }}
                      className={`py-2 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                        info.bg
                      }`}
                    >
                      <span className={`text-base font-extrabold leading-none ${info.color}`}>{info.symbol}</span>
                      <span className="text-white text-xs">{selectedRank ? (selectedRank === 'T' ? '10' : selectedRank) : ''}{info.symbol}</span>
                      {isUsed && <span className="text-[9px] text-slate-500 line-through">used</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action button: Award Showdown */}
          {hand.phase !== 'awarded' && onEndHand && (
            <div className="pt-1 flex items-center justify-end">
              <button
                type="button"
                onClick={onEndHand}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
              >
                Award Showdown Pots
              </button>
            </div>
          )}
        </div>
      ) : !actionDone && cp ? (
        /* 4. ACTIVE PLAYER HERO CARD (When not all-in showdown) */
        <div className="rounded-2xl bg-gradient-to-b from-[#181f2a] to-[#12161f] border-2 border-emerald-500/60 p-4 shadow-xl flex flex-col gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Action On</span>
            </div>
            {actionClockSecondsLeft != null && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black tabular-nums border flex items-center gap-1 shadow ${
                actionClockSecondsLeft > 10
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : actionClockSecondsLeft > 5
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse'
                  : 'bg-rose-950 border-rose-500 text-rose-200 animate-bounce'
              }`}>
                <Clock size={11} /> {actionClockSecondsLeft}s
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between mt-0.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {cp.name}
              </span>
              {/* Position badge: in cash games, no seat label! */}
              {(() => {
                const isBtn = hand.players.findIndex((p) => p.seat === hand.buttonSeat) === hand.players.findIndex((p) => p.id === cp.id);
                if (isBtn) {
                  return (
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-slate-700 text-slate-300 text-xs font-extrabold uppercase">
                      BTN
                    </span>
                  );
                }
                if (!isCash) {
                  return (
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-slate-700 text-slate-300 text-xs font-extrabold uppercase">
                      Seat {cp.seat}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          <div className="text-xs text-slate-300 mt-1 font-medium bg-black/30 rounded-lg p-2 border border-slate-800 flex items-center justify-between">
            <span>
              {canCheck ? 'Check is free' : `${money(toCall, cur)} to call`}
            </span>
          </div>
        </div>
      ) : (
        /* Action Frozen / Showdown / Hand End Banner */
        <div className="rounded-2xl bg-[#141922] border border-slate-800 p-4 shadow-lg text-center flex flex-col items-center justify-center gap-1.5">
          <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={16} />
            {hand.phase === 'awarded'
              ? 'Pots Awarded'
              : hand.phase === 'ended'
              ? 'Hand Ended – Award Showdown'
              : frozen
              ? 'Betting Complete'
              : 'Street Complete'}
          </div>
          <div className="text-xs text-slate-400">
            {hand.phase === 'awarded'
              ? 'Ready to deal next hand'
              : frozen
              ? 'Showdown reached'
              : (hand.message || 'Deal the next street to proceed')}
          </div>
          {(hand.phase === 'ended' || (frozen && hand.phase !== 'awarded')) && onEndHand && (
            <button
              type="button"
              onClick={onEndHand}
              className="mt-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              Award Showdown Pots
            </button>
          )}
        </div>
      )}

      {/* 4. COMPACT ACTION BUTTONS (With Keyboard Shortcuts) */}
      {!actionDone && cp && !isAllInShowdown && (
        <div className="rounded-2xl bg-[#151921] border border-slate-800 p-3.5 shadow-xl flex flex-col gap-2.5">
          {/* Row 1: Fold, Check, Call */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleFold}
              className={`py-3 px-2 rounded-xl text-white font-bold text-sm transition-all shadow-md flex items-center justify-center cursor-pointer ${
                canCheck && muckArmed
                  ? 'bg-rose-700 hover:bg-rose-600 ring-2 ring-rose-400'
                  : canCheck
                  ? 'bg-[#252c37] hover:bg-[#303847] opacity-60'
                  : 'bg-rose-900/80 hover:bg-rose-800 border border-rose-700/70 text-rose-100'
              }`}
            >
              <span>{canCheck && muckArmed ? 'Confirm?' : 'Fold'}</span>
              <KeyBadge label="F" />
            </button>

            <button
              type="button"
              onClick={() => onAction('check')}
              disabled={!canCheck}
              className="py-3 px-2 rounded-xl bg-[#252c37] hover:bg-[#303847] disabled:opacity-25 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-md flex items-center justify-center border border-slate-700 cursor-pointer"
            >
              <span>Check</span>
              <KeyBadge label="X" />
            </button>

            <button
              type="button"
              onClick={() => onAction('call')}
              disabled={canCheck || mustAllinToCall}
              className="py-3 px-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-25 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-md flex items-center justify-center border border-emerald-600/60 cursor-pointer truncate"
            >
              <span className="truncate">{callLabel}</span>
              <KeyBadge label="C" />
            </button>
          </div>

          {/* Row 2: Bet / Raise input & submit + Min Raise */}
          {!isFL ? (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-8 flex items-center gap-1.5">
                <input
                  ref={raiseInputRef}
                  type="text"
                  inputMode="decimal"
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitRaise();
                    } else if (e.key === 'Escape') {
                      e.target.blur();
                    }
                  }}
                  placeholder="Amount"
                  disabled={!canRaise || mustAllinToCall || ootPassiveBound}
                  className="flex-1 rounded-xl bg-[#11141b] border border-slate-700 focus:border-amber-400 px-3 py-2.5 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-inner"
                />
                <button
                  type="button"
                  onClick={submitRaise}
                  disabled={!canRaise || overLimit || mustAllinToCall || ootPassiveBound}
                  className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                >
                  <span>{isBet ? 'Bet' : 'Raise'}</span>
                  <KeyBadge label="R" />
                </button>
              </div>

              <div className="sm:col-span-4">
                <button
                  type="button"
                  onClick={submitMinRaise}
                  disabled={!canMinRaise || mustAllinToCall || ootPassiveBound}
                  className="w-full py-2.5 px-2 rounded-xl bg-[#2e3746] hover:bg-[#3b4759] disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 font-bold text-xs shadow-md flex items-center justify-center border border-slate-600 cursor-pointer transition-colors truncate"
                >
                  <span className="truncate">{minRaiseLabel}</span>
                  <KeyBadge label="M" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => onAction(isBet ? 'bet' : 'raise', flRaiseTo)}
                disabled={!flCanRaise || mustAllinToCall || ootPassiveBound}
                className="w-full py-3 px-3 rounded-xl bg-[#3c4e3c] hover:bg-[#4c624c] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md flex items-center justify-center border border-emerald-600/60 cursor-pointer"
              >
                <span>{flLabel}{flCap ? ' (capped)' : ''}</span>
                <KeyBadge label="R" />
              </button>
            </div>
          )}

          {/* Row 3: Special Actions: Straddle, Pot, All-in */}
          <div className="flex flex-wrap gap-2">
            {canStraddle && !mustAllinToCall && !ootPassiveBound && (
              <button
                type="button"
                onClick={() => onAction(straddlePutsAllIn ? 'allin' : 'straddle', straddleAmt)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-white font-bold text-xs shadow-md flex items-center justify-center cursor-pointer transition-colors ${
                  straddlePutsAllIn ? 'bg-rose-800 hover:bg-rose-700' : 'bg-amber-900/80 hover:bg-amber-800 border border-amber-600/60'
                }`}
              >
                <span>{straddleLabel}</span>
                <KeyBadge label="S" />
              </button>
            )}

            {isPL ? (
              <button
                type="button"
                onClick={potAction}
                disabled={!mustAllinToCall && ootPassiveBound}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#2e3846] hover:bg-[#3c4a5c] disabled:opacity-30 text-white font-bold text-xs shadow-md flex items-center justify-center border border-cyan-600/60 cursor-pointer"
              >
                <span>{mustAllinToCall ? 'All-in' : potLabel}</span>
                <KeyBadge label="P" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submitAllin}
                disabled={!mustAllinToCall && ootPassiveBound}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-900 to-rose-700 hover:from-rose-800 hover:to-rose-600 disabled:opacity-30 text-white font-extrabold text-xs shadow-md flex items-center justify-center border border-rose-500/60 cursor-pointer"
              >
                <span>All-in</span>
                <KeyBadge label="⇧A" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. POTS AWARDED SUMMARY & NEXT HAND (Only for non-all-in showdowns; all-in showdown handles it in Step 3) */}
      {hand.phase === 'awarded' && !isAllInShowdown && (
        <div className="rounded-2xl bg-[#131b14] border border-emerald-600/60 p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm uppercase tracking-wider">
            <CheckCircle2 size={18} />
            <span>Pots Awarded</span>
          </div>

          <div className="space-y-1.5 py-1">
            {(hand.pots || []).map((pot, i) => {
              const summary = formatPotOutcome(pot, i, hand.winners, hand.players, hand.currency);
              if (!summary) return null;
              return (
                <div key={i} className="text-sm font-semibold text-slate-200 bg-black/40 rounded-xl px-3.5 py-2.5 border border-slate-800">
                  {summary}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onNextHand}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <span>Next Hand</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
