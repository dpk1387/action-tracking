import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Clock,
  ChevronUp,
  ChevronDown,
  Smartphone,
  ShieldCheck,
  Settings,
  SlidersHorizontal,
  History,
  LogOut,
  RefreshCw,
  Pause,
  Play,
  Rewind,
  FastForward,
  KeyRound,
  RotateCcw,
  UserPlus,
} from 'lucide-react';
import {
  money,
  formatPotAmount,
  formatPlayerTagAmount,
  formatBlinds,
  positionForSeat,
  SUIT_SYMBOL,
  rankDisplay,
  suitColorClass,
  calcEquity,
  bettingFrozen,
  winningHandCards,
  effectiveHoleSize,
  isPotLimitVariant,
} from '@/lib/poker';
import {
  roundStack,
  sortGoHoleCards,
  parseBetShorthand,
  stepBetAmount,
  getLowestDenomination,
} from '@/lib/goMode';
import { levelTimerState, formatTimer } from '@/lib/levelTimer';
import HandHistoryModal from './HandHistoryModal';

/**
 * Format amount with full digits (e.g. $1,500 or $25,000) rather than K/M shorthand.
 * Respects tournament mode (no currency symbol) and BB mode.
 */
export function formatFullBetAmount(val, currency = '', hand = null, displayUnit = 'chips') {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (!isFinite(n)) return '';
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const isTourney = hand?.mode === 'tournament';
  const sym = isTourney ? '' : (currency || '');
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';

  // 'both' is used at an all-in when players picked different stack units.
  if (activeUnit === 'both') {
    const chipsStr = formatFullBetAmount(val, currency, hand, 'chips');
    const bbVal = Number(hand?.bigBlind) || 0;
    if (bbVal > 0) {
      const bbs = absN / bbVal;
      const rounded = Math.round(bbs * 10) / 10;
      const bbStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
      return `${chipsStr} (${bbStr} BB)`;
    }
    return chipsStr;
  }

  if (activeUnit === 'bb') {
    const bbVal = Number(hand?.bigBlind) || 0;
    if (bbVal > 0) {
      const bbs = absN / bbVal;
      const rounded = Math.round(bbs * 10) / 10;
      const str = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
      return `${sign}${str} BB`;
    }
  }

  const hasDec = !Number.isInteger(absN);
  const numStr = absN.toLocaleString('en-US', {
    minimumFractionDigits: hasDec ? 2 : 0,
    maximumFractionDigits: hasDec ? 2 : 0,
  });
  return `${sign}${sym}${numStr}`;
}

function formatActionTypeTitle(rawAction = '', raiseLevel = 0) {
  const s = String(rawAction || '').toLowerCase();
  const isAllIn = s.includes('all-in') || s.includes('allin') || s.startsWith('all-in');
  if (s.includes('5-bet') || raiseLevel === 5) return isAllIn ? '5-Bet All In' : '5-Bet';
  if (s.includes('4-bet') || raiseLevel === 4) return isAllIn ? '4-Bet All In' : '4-Bet';
  if (s.includes('3-bet') || raiseLevel === 3) return isAllIn ? '3-Bet All In' : '3-Bet';
  if (s.includes('raise') || raiseLevel === 2) return isAllIn ? 'Raise All In' : 'Raise';
  if (s.includes('bet') || raiseLevel === 1) return isAllIn ? 'Bet All In' : 'Bet';
  if (s.includes('straddle')) return isAllIn ? 'Straddle All In' : 'Straddle';
  if (raiseLevel > 5) return isAllIn ? `${raiseLevel}-Bet All In` : `${raiseLevel}-Bet`;
  return isAllIn ? 'All In' : (raiseLevel >= 3 ? `${raiseLevel}-Bet` : raiseLevel === 2 ? 'Raise' : 'Bet');
}

export default function GoModeView({
  hand,
  onAction,
  goDiscards = {},
  onGoDiscardPick,
  goHoleCards = {},
  stackRounding = 'exact',
  goPlayerPrefs = {},
  onUpdatePlayerPrefs,
  suitColors = 2,
  displayUnit = 'chips',
  onNextHand,
  onEndHand,
  onDealNextStreet,
  onOpenSettings,
  onOpenStructureSetup,
  onOpenRebuy,
  onOpenReentry,
  onEndSession,
  onToggleGoMode,
  showPosition = true,
  timerPaused = false,
  timerCanNudge = false,
  onPauseTimer,
  onResumeTimer,
  onNudgeTimer,
  onResumeFromBreak,
  onRunChipRace,
}) {
  const [peekCards, setPeekCards] = useState(false);
  const [showHandHistoryModal, setShowHandHistoryModal] = useState(false);
  const [raiseInput, setRaiseInput] = useState('');
  const [turnVerified, setTurnVerified] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [digitOrder, setDigitOrder] = useState(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showConfirmMuckModal, setShowConfirmMuckModal] = useState(false);
  const [showOpponentStacksModal, setShowOpponentStacksModal] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [wasAllInHand, setWasAllInHand] = useState(false);

  const raiseInputRef = useRef(null);

  // Update timer clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cur = hand?.mode === 'tournament' ? '' : (hand?.currency || '$');
  const players = hand?.players || [];
  const cpIndex = hand?.currentPlayer >= 0 ? hand.currentPlayer : -1;
  const cp = cpIndex >= 0 ? players[cpIndex] : null;
  const cpPrefs = cp ? (goPlayerPrefs[cp.id] || {}) : {};
  const cpPin = String(cpPrefs.pin || '');

  // Every player carries their own display prefs; anything unset falls back to the session defaults.
  const prefFor = (p) => (p ? (goPlayerPrefs[p.id] || {}) : {});

  // Turn handoff is always gated by a short hold so a stray tap cannot open another player's action.
  useEffect(() => {
    setPeekCards(false);
    setRaiseInput('');
    setTurnVerified(false);
    setPinPromptOpen(false);
    setPinEntry('');
    setPinError('');
    setPinUnlocked(false);
    setHoldProgress(0);
  }, [hand?.handNumber, hand?.street, hand?.currentPlayer, hand?.actionHistory?.length]);

  // Reset wasAllInHand on new hand
  useEffect(() => {
    setWasAllInHand(false);
  }, [hand?.handNumber]);

  const buttonIndex = players.findIndex((p) => p.seat === hand?.buttonSeat);
  const n = players.length;
  const positions = players.map((p, idx) => {
    let pos = positionForSeat(n, buttonIndex, idx, hand?.variant);
    if (pos === 'BTN' || pos === 'D/SB') pos = 'D';
    if (!showPosition && !['D', 'SB', 'BB'].includes(pos)) return '';
    return pos;
  });

  const cpPos = cpIndex >= 0 ? positions[cpIndex] : '';
  const rawHole = cp ? (goHoleCards[cp.id] || []) : [];
  // Sort hole cards: larger card on left, and for pairs sort by suit Spades > Hearts > Diamonds > Clubs
  const cpHole = sortGoHoleCards(rawHole);

  const toCall = cp ? Math.max(0, (hand?.currentBet || 0) - (cp.currentBet || 0)) : 0;
  const canCheck = toCall === 0;
  const isMandatory3BetPreflop = hand?.street === 'preflop' && hand?.variant === 'mandatory_3bet' && !hand?.threeBetOccurred && (hand?.raiseLevel || 1) < 3;
  const disableCall = canCheck || isMandatory3BetPreflop;

  const minRaise = (hand?.currentBet || 0) + (hand?.lastRaiseAmount || hand?.bigBlind || 10);
  const maxRaise = cp ? cp.stack + cp.currentBet : 0;
  const breakItem = hand?.inBreak ? ((hand.blindSchedule || [])[hand.tLevel] || null) : null;
  const hasBreakRace = !!(breakItem && ((breakItem.type === 'color_up') || (breakItem.race && Number(breakItem.race.retired) > 0 && Number(breakItem.race.replacement) > 0)));
  // Accurate pot size
  const potTotal = players.reduce((s, p) => s + (p.totalBet || 0), 0);

  // Pot Limit enforcement for PLO
  const isPL = hand?.gameType === 'pl' || hand?.gameType === 'pot_limit' || isPotLimitVariant(hand?.variant);
  const facingBet = hand?.currentBet || 0;
  const rawPotRaiseTo = cp
    ? (facingBet === 0 ? Math.max(hand?.bigBlind || 1, potTotal) : potTotal + 2 * facingBet - (cp.currentBet || 0))
    : 0;
  const effectiveMaxRaise = isPL ? Math.min(maxRaise, rawPotRaiseTo) : maxRaise;
  const isPotCapped = isPL && rawPotRaiseTo < maxRaise;

  // Lowest denomination in play (e.g. 25 in 25/50)
  const stepSize = getLowestDenomination(hand);

  // Check if hand is currently in play
  const isHandActive = Boolean(
    cp && hand?.phase !== 'ended' && hand?.phase !== 'awarded' && hand?.currentPlayer !== -1
  );

  // All-in tracking:
  const nonFolded = useMemo(() => players.filter((p) => p.status !== 'folded'), [players]);

  useEffect(() => {
    if (nonFolded.length <= 1) {
      setWasAllInHand(false);
    }
  }, [nonFolded.length]);

  useEffect(() => {
    if (
      hand?.currentPlayer === -1 &&
      bettingFrozen(hand) &&
      nonFolded.length >= 2 &&
      (nonFolded.some((p) => p.status === 'allin') || nonFolded.filter((p) => p.stack > 0).length <= 1)
    ) {
      setWasAllInHand(true);
    }
  }, [hand, nonFolded]);

  const isBettingActive = Boolean(cp && hand?.currentPlayer >= 0);
  const isAllInConcluding = wasAllInHand || (
    nonFolded.length >= 2 &&
    (nonFolded.some((p) => p.status === 'allin') || nonFolded.filter((p) => p.stack > 0).length <= 1)
  );

  const isAllInSituation = Boolean(
    nonFolded.length >= 2 &&
    nonFolded.some((p) => p.status === 'allin') &&
    !isBettingActive &&
    isAllInConcluding
  );

  // Display prefs: the acting player's own settings drive the screen. An all-in is watched by
  // everyone, so mixed stack units show chips AND big blinds, and one 4-color choice shows 4 colors.
  const sessionUnit = displayUnit || hand?.displayUnit || 'chips';
  // Folded players are not watching the runout, so only the players still in the hand count.
  const sureUnits = nonFolded.map((p) => prefFor(p).displayUnit || sessionUnit);
  const mixedUnits = isAllInSituation && new Set(sureUnits).size > 1;
  const activeUnit = isAllInSituation
    ? (mixedUnits ? 'both' : (sureUnits[0] || sessionUnit))
    : (cpPrefs.displayUnit || sessionUnit);
  const displaySuitColors = isAllInSituation
    ? (nonFolded.some((p) => (prefFor(p).suitColors ?? suitColors) === 4) ? 4 : 2)
    : (cpPrefs.suitColors ?? suitColors);

  // At-risk stacks calculation: players are at risk iff they are not the sole deepest stack
  const nonFoldedStacks = useMemo(() => nonFolded.map((p) => p.stack), [nonFolded]);
  const maxStack = nonFoldedStacks.length > 0 ? Math.max(...nonFoldedStacks) : 0;
  const deepestCount = useMemo(() => nonFolded.filter((p) => p.stack === maxStack).length, [nonFolded, maxStack]);

  // Aggregated winners across all pots (sum of profit won from all pots combined, no separation by pot)
  const aggregatedWinners = useMemo(() => {
    if (!hand?.winners || hand.winners.length === 0) return [];
    const map = {};
    hand.winners.forEach((w) => {
      const winnerPlayer = players.find((p) => p.id === w.playerId);
      const profit = Math.max(0, (w.amount || 0) - (winnerPlayer?.totalBet || 0));
      if (!map[w.playerId]) {
        map[w.playerId] = {
          playerId: w.playerId,
          playerName: w.playerName || winnerPlayer?.name || 'Winner',
          amount: profit,
          handName: w.handName,
        };
      } else {
        map[w.playerId].amount += profit;
        if (w.handName && !map[w.playerId].handName) {
          map[w.playerId].handName = w.handName;
        }
      }
    });
    return Object.values(map);
  }, [hand?.winners, players]);

  // Community cards array
  const commCards = useMemo(() => (hand?.communityCards || []).filter((c) => c && !c.hidden), [hand?.communityCards]);
  const isOcean = hand?.variant === 'ocean';
  const is321 = hand?.variant === 'three_two_one';
  const targetBoardLen = (isOcean || is321) ? 6 : 5;

  // Winning 5-card calculation for showdown highlighting
  const winningCardKeys = useMemo(() => {
    if (!hand?.winners || hand.winners.length === 0 || commCards.length < targetBoardLen) return new Set();
    const keys = new Set();
    for (const w of hand.winners) {
      const winnerHole = goHoleCards[w.playerId] || [];
      const best5 = winningHandCards(winnerHole, commCards, hand?.variant || 'nlh');
      if (Array.isArray(best5)) {
        for (const c of best5) {
          if (c && c.rank != null && c.suit) {
            keys.add(`${String(c.rank).toUpperCase()}_${String(c.suit).toLowerCase()}`);
          }
        }
      }
    }
    return keys;
  }, [hand?.winners, commCards, goHoleCards, hand?.variant, targetBoardLen]);

  const isWinningCard = (c) => {
    if (!c || c.hidden || !winningCardKeys.size) return false;
    return winningCardKeys.has(`${String(c.rank).toUpperCase()}_${String(c.suit).toLowerCase()}`);
  };

  const isWinnerPlayer = (playerId) => {
    return Boolean(hand?.winners?.some((w) => w.playerId === playerId));
  };

  // Equity calculation for all-in players (only active while board is incomplete)
  const allInEquity = useMemo(() => {
    if (!isAllInSituation || nonFolded.length < 2 || commCards.length >= targetBoardLen) return null;
    const reqHoleSize = effectiveHoleSize(hand);
    const holes = nonFolded.map((p) => goHoleCards[p.id] || null);
    if (holes.some((h) => !h || h.length < reqHoleSize)) return null;
    const eq = calcEquity(holes, commCards, 10000, hand?.variant || 'nlh');
    return {
      contestants: nonFolded,
      results: eq?.results || [],
      split: eq?.split || 0,
    };
  }, [isAllInSituation, nonFolded, goHoleCards, commCards, hand, targetBoardLen]);

  // Single button text for all-in manual deals
  let dealButtonText = 'Deal Flop';
  if (commCards.length < 3) {
    dealButtonText = 'Deal Flop';
  } else if (commCards.length === 3) {
    dealButtonText = 'Deal Turn';
  } else if (commCards.length === 4 || (is321 && commCards.length === 5)) {
    dealButtonText = 'Deal River';
  } else if (isOcean && commCards.length === 5) {
    dealButtonText = 'Deal Ocean';
  }

  // Wrap action submission so turnVerified always resets immediately on every action
  const submitGoAction = (type, amount) => {
    setPeekCards(false);
    setTurnVerified(false);
    setPinPromptOpen(false);
    setPinEntry('');
    setPinError('');
    setPinUnlocked(false);
    onAction(type, amount);
  };

  // Last aggressive bet/raise info on the current street (shown next to Current Pot)
  const lastRaiseInfo = useMemo(() => {
    const hist = hand?.actionHistory || [];
    const curStreet = hand?.street || 'preflop';
    for (let i = hist.length - 1; i >= 0; i--) {
      const entry = hist[i];
      if (!entry || entry.street !== curStreet) continue;
      const actStr = String(entry.action || '').toLowerCase();
      const looksAggressive = entry.isAggressive ?? (
        actStr.startsWith('bet') ||
        actStr.startsWith('raise') ||
        actStr.startsWith('3-bet') ||
        actStr.startsWith('4-bet') ||
        actStr.startsWith('5-bet') ||
        actStr.startsWith('straddle') ||
        actStr.startsWith('kill') ||
        actStr.startsWith('half-kill') ||
        actStr.startsWith('all-in raise') ||
        actStr.startsWith('all-in 3-bet') ||
        actStr.startsWith('all-in 4-bet') ||
        actStr.startsWith('all-in 5-bet') ||
        actStr.startsWith('all-in bet')
      );
      if (looksAggressive) {
        const size = entry.betTo != null && entry.betTo > 0 ? entry.betTo : entry.chips;
        return {
          type: formatActionTypeTitle(entry.action, entry.raiseLevel),
          size,
          player: entry.player,
        };
      }
    }
    return null;
  }, [hand?.actionHistory, hand?.street]);

  const handleStepBet = (dir) => {
    if (!cp) return;
    const currentVal = raiseInput !== '' ? raiseInput : minRaise;
    const nextVal = stepBetAmount(currentVal, dir, stepSize, minRaise, effectiveMaxRaise);
    setRaiseInput(String(nextVal));
  };

  const handleExecuteRaise = () => {
    if (!cp) return;
    const parsed = parseBetShorthand(raiseInput);
    if (parsed >= minRaise && (!isPL || parsed <= effectiveMaxRaise)) {
      submitGoAction('raise', Math.min(effectiveMaxRaise, parsed));
      setRaiseInput('');
    }
  };

  const handleFoldClick = () => {
    if (!cp) return;
    if (canCheck) {
      setShowConfirmMuckModal(true);
    } else {
      submitGoAction('fold');
    }
  };

  const needsTurnAck = Boolean(cp && !turnVerified && !isAllInSituation);

  // 3-digit card PIN: only the hole cards are locked, stacks and bets stay readable.
  const handlePinDigit = (digit) => {
    if (!cpPin || pinEntry.length >= 3) return;
    const next = pinEntry + digit;
    setPinEntry(next);
    setPinError('');
    if (next.length === 3) {
      if (next === cpPin) {
        setPinUnlocked(true);
        setPinPromptOpen(false);
        setPinEntry('');
        setPeekCards(true);
      } else {
        setPinError('Wrong PIN');
        setTimeout(() => setPinEntry(''), 350);
      }
    }
  };

  // Cards stay hidden until the acting player unlocks them with their PIN (if they set one).
  const togglePeekCards = () => {
    if (!peekCards && cpPin && !pinUnlocked) {
      setPinPromptOpen(true);
      setPinEntry('');
      setPinError('');
      return;
    }
    setPeekCards((v) => !v);
  };

  const shuffleKeypad = () => {
    setDigitOrder((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  };

  const completeTurnAck = () => {
    setTurnVerified(true);
  };

  // Hold-to-confirm: the handoff button must be held for 0.5s so a stray tap cannot open a turn.
  const holdTimerRef = useRef(null);
  const holdStartRef = useRef(0);
  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };
  useEffect(() => () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
  }, []);
  const startHold = () => {
    if (holdTimerRef.current) return;
    holdStartRef.current = Date.now();
    holdTimerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - holdStartRef.current) / 500) * 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        cancelHold();
        completeTurnAck();
      }
    }, 40);
  };

  // Keyboard shortcuts listener:
  // s = show/hide cards, f = fold, x/c = check, c = call, r = bet/raise, m = min, shift+a = all in / pot
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (needsTurnAck) return;

      if (pinPromptOpen) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handlePinDigit(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          setPinEntry((prev) => prev.slice(0, -1));
          setPinError('');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setPinPromptOpen(false);
          setPinEntry('');
          setPinError('');
        }
        return;
      }

      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter' && e.target === raiseInputRef.current) {
          e.preventDefault();
          handleExecuteRaise();
        } else if (e.target === raiseInputRef.current && /^[+\-=]$/.test(e.key)) {
          // +/- resize the bet by half a big blind even while the box has focus.
          e.preventDefault();
          const step = Math.max(1, Math.round((hand?.bigBlind || 0) / 2));
          const base = parseBetShorthand(raiseInput) || minRaise;
          const next = e.key === '-' ? base - step : base + step;
          setRaiseInput(String(Math.min(Math.max(next, minRaise), effectiveMaxRaise || next)));
        }
        return;
      }

      // Shift + A -> All in (or Pot in PLO)
      if (e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (cp && effectiveMaxRaise > 0) {
          submitGoAction('raise', effectiveMaxRaise);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();

      if (key === 's') {
        if (cp && !isAllInSituation) {
          e.preventDefault();
          togglePeekCards();
        }
      } else if (key === 'f') {
        if (!canCheck) {
          e.preventDefault();
          handleFoldClick();
        }
      } else if (key === 'x') {
        if (canCheck) {
          e.preventDefault();
          submitGoAction('check');
        }
      } else if (key === 'c') {
        e.preventDefault();
        if (canCheck) {
          submitGoAction('check');
        } else if (!disableCall && toCall > 0) {
          submitGoAction('call');
        }
      } else if (key === 'r') {
        e.preventDefault();
        raiseInputRef.current?.focus();
        raiseInputRef.current?.select();
      } else if (key === 'm') {
        e.preventDefault();
        setRaiseInput(String(Math.min(minRaise, effectiveMaxRaise || minRaise)));
        raiseInputRef.current?.focus();
      } else if (key === '+' || key === '=' || key === '-') {
        // Bet size steps by half a big blind, clamped to the legal raise range.
        e.preventDefault();
        const step = Math.max(1, Math.round((hand?.bigBlind || 0) / 2));
        const base = parseBetShorthand(raiseInput) || minRaise;
        const next = key === '-' ? base - step : base + step;
        const cap = effectiveMaxRaise || next;
        setRaiseInput(String(Math.min(Math.max(next, minRaise), cap)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cp, canCheck, disableCall, toCall, minRaise, effectiveMaxRaise, isPL, raiseInput, needsTurnAck, cpPin, pinUnlocked, pinPromptOpen, pinEntry, isAllInSituation]);

  const isShowdownComplete = Boolean(
    isAllInSituation && (commCards.length >= targetBoardLen || hand?.phase === 'awarded' || hand?.phase === 'ended')
  );

  const levelNum = hand?.levelIndex != null ? hand.levelIndex + 1 : (hand?.levelNumber || 1);
  const variantBadge = ({
    nlh: 'NLH', plo: 'PLO4', plo5: 'PLO5', plo6: 'PLO6', plo8: 'PLO8',
    short_deck: 'SHORT DECK', pineapple: 'PINEAPPLE', crazy_pineapple: 'CRAZY PINEAPPLE',
    lazy_pineapple: 'LAZY PINEAPPLE', super_holdem: "SUPER HOLD'EM",
  })[hand?.variant] || String(hand?.variant || 'NLH').replace(/_/g, ' ').toUpperCase();

  return (
    <div className="min-h-screen bg-[#121417] text-white flex flex-col justify-between p-2 sm:p-4 select-none max-w-2xl mx-auto border-x border-slate-800/80 shadow-2xl relative">
      {/* TOP HEADER: Row 1 (Explicit GO Mode Badge, Level #, Blinds, Clock + Controls, History, Switch Mode, End Session, Structure & Settings), Row 2 (Show Cards) */}
      <div className="space-y-2">
        {/* Row 1: Top Control Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#151921] rounded-xl border border-slate-800 text-xs shadow-sm flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-500/60 text-amber-300 font-black uppercase text-xs tracking-wider shadow">
              GO Mode · {variantBadge}
            </span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-emerald-400 font-extrabold text-xs">
              Lvl {levelNum} · Blinds: {formatBlinds(hand)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {hand?.blindSchedule?.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/70 rounded-lg px-2 py-0.5 text-amber-300 font-mono font-bold">
                <Clock size={12} className="text-amber-400" />
                <span>{formatTimer(levelTimerState(hand, now))}</span>
                {hand?.mode === 'tournament' && (
                  <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-700">
                    <button
                      type="button"
                      onClick={() => onNudgeTimer?.(60000)}
                      disabled={!timerCanNudge}
                      title="Rewind 1 minute"
                      className="px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-[10px] text-slate-200 font-sans font-bold flex items-center gap-0.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Rewind size={10} />
                      <span>1m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => (timerPaused ? onResumeTimer?.() : onPauseTimer?.())}
                      disabled={!timerCanNudge && !timerPaused}
                      title={timerPaused ? 'Resume timer' : 'Pause timer'}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                        timerPaused
                          ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
                      }`}
                    >
                      {timerPaused ? <Play size={10} /> : <Pause size={10} />}
                      <span className="hidden sm:inline">{timerPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNudgeTimer?.(-60000)}
                      disabled={!timerCanNudge}
                      title="Forward 1 minute"
                      className="px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-[10px] text-slate-200 font-sans font-bold flex items-center gap-0.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span>1m</span>
                      <FastForward size={10} />
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Mode Switch Button */}
            {onToggleGoMode && (
              <button
                type="button"
                onClick={onToggleGoMode}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 transition-colors cursor-pointer shadow"
                title="Switch between GO Mode and Action Tracking Mode"
              >
                <RefreshCw size={12} />
                <span>Switch Mode</span>
              </button>
            )}

            {/* Hand History Button */}
            <button
              type="button"
              disabled={isHandActive}
              onClick={() => setShowHandHistoryModal(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                isHandActive
                  ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-500/30 cursor-pointer shadow'
              }`}
              title={isHandActive ? 'Hand History available between hands' : 'View Session Hand History'}
            >
              <History size={13} />
              <span>History</span>
            </button>

            {/* End Session Button */}
            {onEndSession && (
              <button
                type="button"
                onClick={onEndSession}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 transition-colors cursor-pointer shadow"
                title="End Session (Save / Discard)"
              >
                <LogOut size={13} />
                <span>End</span>
              </button>
            )}

            {onOpenRebuy && (
              <button
                type="button"
                onClick={onOpenRebuy}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/60 transition-colors cursor-pointer font-bold text-xs"
                title="Tournament rebuy / add-on"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Rebuy</span>
              </button>
            )}

            {onOpenReentry && (
              <button
                type="button"
                onClick={onOpenReentry}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/60 transition-colors cursor-pointer font-bold text-xs"
                title="Re-enter a busted player"
              >
                <UserPlus size={13} />
                <span className="hidden sm:inline">Re-entry</span>
              </button>
            )}

            {/* Structure Setup Button (next to Settings) */}
            {onOpenStructureSetup && (
              <button
                type="button"
                onClick={onOpenStructureSetup}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer font-bold text-xs"
                title="Structure Setup"
              >
                <SlidersHorizontal size={13} />
                <span className="hidden sm:inline">Structure</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Open Settings"
              >
                <Settings size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Show Stacks (Left) and Show Cards (Right) */}
        <div className="flex items-center justify-between bg-[#151921] px-3 py-1.5 rounded-xl border border-slate-700/80 shadow">
          <button
            type="button"
            onClick={() => setShowOpponentStacksModal((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer border ${
              showOpponentStacksModal
                ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600/50'
            }`}
          >
            <span>Show Stacks</span>
          </button>

          <button
            type="button"
            onClick={togglePeekCards}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer border ${
              peekCards
                ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
            }`}
          >
            {peekCards ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{peekCards ? 'Hide Cards' : 'Show Cards'}</span>
            <span className={`kbd-shortcut-hint hidden md:inline text-[10px] font-mono font-normal ${peekCards ? 'text-black/70' : 'text-amber-200/70'}`}>(S)</span>
          </button>
        </div>

      </div>

      {/* REVEALED HOLE CARDS BANNER (When Show Cards is Active) */}
      {peekCards && (
        <div className="my-2 p-3 bg-amber-950/80 border-2 border-amber-500/90 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-2 animate-fade-in">
          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
            {cp ? `${cp.name}'s Hole Cards` : 'Your Hole Cards'}
          </span>
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {cpHole.length > 0 ? (
              cpHole.map((c, i) => {
                const suitColor = suitColorClass(c.suit, displaySuitColors);
                return (
                  <div
                    key={i}
                    className={`px-3 py-1.5 rounded-xl bg-white border border-slate-300 flex items-center gap-1 shadow-lg font-black text-lg ${suitColor}`}
                  >
                    <strong className="font-bold">{rankDisplay(c.rank)}</strong>
                    <span className="text-base">{SUIT_SYMBOL[c.suit] || c.suit}</span>
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-slate-400 font-mono">No hole cards dealt</span>
            )}
          </div>
        </div>
      )}

      {/* ALL-IN SHOWDOWN TOP BANNER */}
      {isAllInSituation && (
        <div className="my-2 bg-[#151921] p-3 rounded-2xl border-2 border-amber-500/80 shadow-2xl space-y-2 animate-fade-in">
          <div className="text-center flex items-center justify-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-extrabold text-[11px] uppercase tracking-wider">
              {isShowdownComplete ? 'All-In Showdown Result' : 'All-In Showdown'}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            {nonFolded.map((p, idx) => {
              const rawCards = goHoleCards[p.id] || [];
              const sorted = sortGoHoleCards(rawCards);
              const winPct = allInEquity?.results?.[idx]?.win ?? 0;
              const isWinner = isWinnerPlayer(p.id);
              const isAtRisk = p.stack < maxStack || (p.stack === maxStack && deepestCount > 1);

              return (
                <div
                  key={p.id}
                  className={`px-3 py-2 rounded-2xl border flex flex-col items-center gap-1 shadow-lg transition-all ${
                    isWinner && isShowdownComplete
                      ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50'
                      : isAtRisk
                      ? 'bg-rose-950/50 border-rose-500 ring-1 ring-rose-500/60'
                      : 'bg-[#19202b] border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs font-bold text-white">
                    <span className="truncate max-w-[110px]">{p.name}</span>
                    {isWinner && isShowdownComplete && (
                      <span className="text-[10px] text-amber-300 font-black">🏆</span>
                    )}
                  </div>
                  {/* Hole cards with bold ranks + winning 5-card highlight */}
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {sorted.map((c, ci) => {
                      const sc = suitColorClass(c.suit, displaySuitColors);
                      const isWinCard = isWinningCard(c);
                      return (
                        <div
                          key={ci}
                          className={`px-2 py-1 rounded-lg border flex items-center gap-0.5 shadow font-black text-sm transition-all ${sc} ${
                            isWinCard
                              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 scale-105 shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          <strong className="font-bold">{rankDisplay(c.rank)}</strong>
                          <span className="text-xs">{SUIT_SYMBOL[c.suit] || c.suit}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Win % only */}
                  {isShowdownComplete ? (
                    <div className="text-[11px] font-mono font-bold leading-none pt-0.5">
                      {isWinner ? (
                        <span className="text-emerald-400">Winner</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono font-bold leading-none pt-0.5">
                      <span className="text-emerald-400">Win {winPct.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MIDDLE AREA */}
      <div className="my-auto py-3 space-y-3">

        {isAllInSituation ? (
          /* All-In Center Display: Pot, Split/Tie Chance, Community Cards, and Showdown Payouts */
          <div className="bg-[#151921] p-5 rounded-3xl border border-amber-500/60 shadow-2xl text-center space-y-4">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Current Pot
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight drop-shadow-md">
                {formatPotAmount(potTotal, cur, hand, activeUnit)}
              </div>
              {/* Split / Tie Chance moved here */}
              {allInEquity && allInEquity.split > 0 && !isShowdownComplete && (
                <div className="text-xs font-mono font-bold text-amber-300 mt-1">
                  Tie / Split Chance: {allInEquity.split.toFixed(1)}%
                </div>
              )}
            </div>

            {/* Board cards with winning card highlighting */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Community Cards ({commCards.length}/{targetBoardLen})
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {Array.from({ length: targetBoardLen }, (_, idx) => {
                  const c = commCards[idx];
                  if (!c) {
                    return (
                      <div
                        key={idx}
                        className="w-10 h-14 rounded-lg border-2 border-dashed border-slate-700 bg-[#19202b] flex items-center justify-center text-slate-600 font-bold text-sm"
                      >
                        ?
                      </div>
                    );
                  }
                  const suitColor = suitColorClass(c.suit, displaySuitColors);
                  const isWinCard = isWinningCard(c);
                  return (
                    <div
                      key={idx}
                      className={`w-10 h-14 rounded-lg border flex flex-col items-center justify-center shadow-lg transition-all ${suitColor} ${
                        isWinCard
                          ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 scale-105 shadow-[0_0_14px_rgba(245,158,11,0.7)]'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      <strong className="font-bold text-sm leading-none">{rankDisplay(c.rank)}</strong>
                      <span className="text-xs font-bold leading-none">{SUIT_SYMBOL[c.suit] || c.suit}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All-In Showdown Payouts directly on the all-in view ([name] wins [profit]) */}
            {isShowdownComplete && aggregatedWinners.length > 0 && (
              <div className="space-y-1.5 bg-[#19202b] p-3.5 rounded-2xl border border-emerald-500/50 mt-2 shadow-lg animate-fade-in text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Payouts
                </div>
                {aggregatedWinners.map((w, idx) => (
                  <div key={idx} className="text-sm font-normal text-emerald-400">
                    🏆 {w.playerName} wins {formatFullBetAmount(w.amount, cur, hand, activeUnit)}
                    {w.handName ? ` · ${w.handName}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : cp ? (
          <div className="bg-[#151921] p-4 sm:p-6 rounded-3xl border border-slate-700/80 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* CENTER-LEFT: Player Name, Position, My Stack, Call Amount */}
            <div className="space-y-3 text-left border-b md:border-b-0 md:border-r border-slate-800 pb-4 md:pb-0 md:pr-4">
              <div className="flex items-center gap-2.5">
                {cpPos && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider shadow">
                    {cpPos}
                  </span>
                )}
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">{cp.name}</h2>
              </div>

              {/* My Stack Display (On screen) */}
              <div className="text-xs text-slate-300">
                My Stack: <span className="text-amber-300 font-mono font-bold text-base">{formatFullBetAmount(cp.stack, cur, hand, activeUnit)}</span>
                {cp.currentBet > 0 && (
                  <span className="text-slate-400 ml-1 font-mono text-[11px]">({formatFullBetAmount(cp.currentBet, cur, hand, activeUnit)} bet)</span>
                )}
              </div>

              {/* "X to Call" / "Check Available" */}
              <div>
                {canCheck ? (
                  <div className="inline-block px-3.5 py-2 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500 text-emerald-300 font-black text-base shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                    Check Available
                  </div>
                ) : (
                  <div className="inline-block px-3.5 py-2 rounded-2xl bg-amber-950/90 border-2 border-amber-500 text-amber-300 font-black text-base shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                    {formatFullBetAmount(toCall, cur, hand, activeUnit)} to Call
                  </div>
                )}
              </div>
            </div>

            {/* CENTER-RIGHT: Pot Size + Last Raise Info & Community Board */}
            <div className="space-y-3 text-center md:text-right md:pl-2">
              <div className="flex flex-wrap items-start justify-center md:justify-end gap-4">
                {/* Last Raise / Bet Info (left of Current Pot) */}
                <div className="bg-[#19202b] border border-slate-700/80 rounded-2xl px-3 py-2 text-left min-w-[130px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Last Raise
                  </div>
                  {lastRaiseInfo ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-black uppercase">
                          {lastRaiseInfo.type}
                        </span>
                        <span className="text-sm font-black text-white font-mono">
                          {formatFullBetAmount(lastRaiseInfo.size, cur, hand, activeUnit)}
                        </span>
                      </div>
                      {lastRaiseInfo.player && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                          from <span className="text-slate-200 font-semibold">{lastRaiseInfo.player}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-slate-500">None</div>
                  )}
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Current Pot
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight drop-shadow-md">
                    {formatPotAmount(potTotal, cur, hand, activeUnit)}
                  </div>
                </div>

              </div>

              {/* Community Cards */}
              <div className="pt-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Community Cards
                </div>
                <div className="flex items-center justify-center md:justify-end gap-1.5 flex-wrap">
                  {(hand?.communityCards || []).length > 0 ? (
                    hand.communityCards.map((c, idx) => {
                      if (!c || c.hidden) {
                        return (
                          <div
                            key={idx}
                            className="w-9 h-12 rounded-lg border-2 border-dashed border-slate-700 bg-[#19202b] flex items-center justify-center text-slate-600 font-bold text-xs"
                          >
                            ?
                          </div>
                        );
                      }
                      const suitColor = suitColorClass(c.suit, displaySuitColors);
                      return (
                        <div
                          key={idx}
                          className={`w-9 h-12 rounded-lg bg-white border border-slate-300 flex flex-col items-center justify-center shadow-md ${suitColor}`}
                        >
                          <strong className="font-bold text-xs leading-none">{rankDisplay(c.rank)}</strong>
                          <span className="text-[10px] font-bold leading-none">{SUIT_SYMBOL[c.suit] || c.suit}</span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-500 font-mono py-1">Preflop</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Non-All-In Hand Concluded Screen ([name] wins [amount] + showdown hole cards) */
          <div className="p-6 bg-[#151921] rounded-3xl border border-slate-800 text-center space-y-4">
            <h2 className="text-2xl font-black text-amber-300">Hand Concluded</h2>
            {aggregatedWinners.length > 0 && (
              <div className="space-y-1.5 bg-[#19202b] p-3 rounded-2xl border border-emerald-500/40">
                {aggregatedWinners.map((w, idx) => (
                  <div key={idx} className="text-sm font-normal text-emerald-400">
                    🏆 {w.playerName} wins {formatFullBetAmount(w.amount, cur, hand, activeUnit)}
                    {w.handName ? ` · ${w.handName}` : ''}
                  </div>
                ))}
              </div>
            )}
            <div className="text-base text-slate-300 font-bold">
              Total Pot: <span className="font-mono text-amber-300">{formatPotAmount(potTotal, cur, hand, activeUnit)}</span>
            </div>

            {/* Showdown Hole Cards even when NOT an all-in */}
            {nonFolded.length >= 2 && (
              <div className="pt-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Showdown Hands
                </div>
                <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                  {nonFolded.map((p) => {
                    const sorted = sortGoHoleCards(goHoleCards[p.id] || []);
                    const isWinner = isWinnerPlayer(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`px-3 py-2 rounded-2xl border flex flex-col items-center gap-1.5 shadow-lg ${
                          isWinner
                            ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50'
                            : 'bg-[#19202b] border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-xs font-bold text-white">
                          <span className="truncate max-w-[110px]">{p.name}</span>
                          {isWinner && <span className="text-[10px] text-amber-300 font-black">🏆</span>}
                        </div>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {sorted.length > 0 ? sorted.map((c, ci) => {
                            const sc = suitColorClass(c.suit, displaySuitColors);
                            const isWinCard = isWinningCard(c);
                            return (
                              <div
                                key={ci}
                                className={`px-2 py-1 rounded-lg border flex items-center gap-0.5 shadow font-black text-sm ${sc} ${
                                  isWinCard
                                    ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 scale-105 shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                                    : 'bg-white border-slate-300'
                                }`}
                              >
                                <strong className="font-bold">{rankDisplay(c.rank)}</strong>
                                <span className="text-xs">{SUIT_SYMBOL[c.suit] || c.suit}</span>
                              </div>
                            );
                          }) : (
                            <span className="text-[11px] text-slate-500 font-mono">No cards</span>
                          )}
                        </div>
                        {isWinner && (
                          <div className="text-[11px] font-mono font-bold leading-none text-emerald-400">
                            Winner
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Show board cards */}
            {(hand?.communityCards || []).length > 0 && (
              <div className="pt-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Final Board
                </div>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {hand.communityCards.map((c, idx) => {
                    if (!c || c.hidden) return null;
                    const suitColor = suitColorClass(c.suit, displaySuitColors);
                    const isWinCard = isWinningCard(c);
                    return (
                      <div
                        key={idx}
                        className={`w-10 h-14 rounded-lg border flex flex-col items-center justify-center shadow-md ${suitColor} ${
                          isWinCard
                            ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 scale-105 shadow-[0_0_14px_rgba(245,158,11,0.7)]'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        <strong className="font-bold text-sm leading-none">{rankDisplay(c.rank)}</strong>
                        <span className="text-xs font-bold leading-none">{SUIT_SYMBOL[c.suit] || c.suit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {onNextHand && (
              <button
                type="button"
                onClick={onNextHand}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-base cursor-pointer shadow-xl transition-transform active:scale-95"
              >
                Deal Next Hand
              </button>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION AREA */}
      {hand.inBreak ? (
        <div className="bg-[#2a2414] border border-amber-600/60 p-4 rounded-2xl shadow-2xl space-y-3 text-center">
          <div className="text-xs font-black uppercase tracking-widest text-amber-400">
            {hasBreakRace ? 'Chip race break' : 'Tournament break'}
          </div>
          <div className="text-3xl font-mono font-black text-amber-200">{formatTimer(levelTimerState(hand, now))}</div>
          <div className="text-xs text-amber-200/70">
            {hand.blindsPosted === false ? 'Blinds post when play resumes.' : 'Blinds update when the next hand starts.'}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {hasBreakRace && onRunChipRace && (
              <button
                type="button"
                onClick={onRunChipRace}
                className="px-4 py-3 rounded-xl bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white font-medium text-sm cursor-pointer"
              >
                Run chip race
              </button>
            )}
            <button
              type="button"
              onClick={() => onResumeFromBreak?.()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-black font-black text-base cursor-pointer shadow-xl"
            >
              Resume play →
            </button>
          </div>
        </div>
      ) : isAllInSituation ? (
        /* In an all-in: deal streets manually until river; on/post river show "Deal Next Hand" */
        <div className="bg-[#151921] p-3 rounded-2xl border border-slate-700/80 shadow-2xl">
          {isShowdownComplete ? (
            <button
              type="button"
              onClick={onNextHand}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-black font-black text-lg tracking-wide shadow-xl cursor-pointer transition-transform active:scale-95"
            >
              Deal Next Hand
            </button>
          ) : (
            <button
              type="button"
              onClick={onDealNextStreet}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-black font-black text-lg tracking-wide shadow-xl cursor-pointer transition-transform active:scale-95 animate-pulse"
            >
              {dealButtonText}
            </button>
          )}
        </div>
      ) : cp ? (
        /* Regular Action Area: If check is available, remove fold and show ONLY Check + All In. If check is not available, show Fold, Call, All In. */
        <div className="bg-[#151921] p-3 rounded-2xl border border-slate-700/80 space-y-2.5 shadow-2xl">
          <div className={`grid ${canCheck ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
            {/* If check is NOT available, show Fold button */}
            {!canCheck && (
              <button
                type="button"
                onClick={handleFoldClick}
                className="py-3 rounded-xl bg-slate-900 hover:bg-rose-950 border border-slate-700 hover:border-rose-600 text-slate-300 hover:text-rose-300 font-extrabold text-sm cursor-pointer transition-colors shadow"
                title="Shortcut: F"
              >
                Fold <span className="kbd-shortcut-hint hidden md:inline text-[10px] text-slate-500 font-mono font-normal">(F)</span>
              </button>
            )}

            {/* Check / Call Button */}
            {canCheck ? (
              <button
                type="button"
                onClick={() => submitGoAction('check')}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm cursor-pointer transition-colors shadow-lg"
                title="Shortcut: C"
              >
                Check <span className="kbd-shortcut-hint hidden md:inline text-[10px] text-emerald-200 font-mono font-normal">(C)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={disableCall}
                onClick={() => submitGoAction('call')}
                title={isMandatory3BetPreflop ? 'Mandatory 3-Bet: Cannot call or limp preflop until a 3-bet occurs.' : 'Shortcut: C'}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-extrabold text-sm cursor-pointer transition-colors shadow-lg"
              >
                Call {formatFullBetAmount(toCall, cur, hand, activeUnit)}{' '}
                <span className="kbd-shortcut-hint hidden md:inline text-[10px] text-emerald-200 font-mono font-normal">(C)</span>
              </button>
            )}

            {/* All In / Pot Limit Max Button */}
            <button
              type="button"
              onClick={() => submitGoAction('raise', effectiveMaxRaise)}
              className="py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm cursor-pointer transition-all shadow-lg"
              title="Shortcut: Shift + A"
            >
              {isPotCapped
                ? `Pot (${formatFullBetAmount(effectiveMaxRaise, cur, hand, activeUnit)})`
                : `All In (${formatFullBetAmount(maxRaise, cur, hand, activeUnit)})`}
            </button>
          </div>

          {/* Bet / Raise Controls: Shorthand Input + Stepper Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            {/* Stepper Down (- step) */}
            <button
              type="button"
              onClick={() => handleStepBet(-1)}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-black text-base cursor-pointer border border-slate-700"
              title="Decrease bet"
            >
              <ChevronDown size={18} />
            </button>

            {/* Text Input (Accepts 5k, 2.5m, etc.) */}
            <input
              ref={raiseInputRef}
              type="text"
              value={raiseInput}
              onChange={(e) => setRaiseInput(e.target.value)}
              placeholder={`Min ${minRaise}`}
              className="w-32 px-3 py-2 rounded-xl bg-[#11141b] border border-slate-700 text-white text-sm font-bold text-center focus:outline-none focus:border-amber-400"
              title="Shortcut: R to focus"
            />

            {/* Stepper Up (+ step) */}
            <button
              type="button"
              onClick={() => handleStepBet(1)}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-black text-base cursor-pointer border border-slate-700"
              title="Increase bet"
            >
              <ChevronUp size={18} />
            </button>

            {/* Bet / Raise Button */}
            <button
              type="button"
              onClick={handleExecuteRaise}
              disabled={!raiseInput || parseBetShorthand(raiseInput) < minRaise || (isPL && parseBetShorthand(raiseInput) > effectiveMaxRaise)}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs cursor-pointer shadow"
            >
              {isPL && raiseInput && parseBetShorthand(raiseInput) > effectiveMaxRaise
                ? `Max ${effectiveMaxRaise}`
                : (hand?.currentBet || 0) > 0
                ? 'Raise'
                : 'Bet'}
            </button>

            {/* Quick Reset Min (Shortcut: M) */}
            <button
              type="button"
              onClick={() => {
                setRaiseInput(String(Math.min(minRaise, effectiveMaxRaise || minRaise)));
                raiseInputRef.current?.focus();
              }}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs cursor-pointer border border-slate-700"
              title="Shortcut: M"
            >
              Min <span className="kbd-shortcut-hint hidden md:inline">(M)</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* TURN HANDOFF: hold 0.5s to open the acting player's controls */}
      {needsTurnAck && cp && !isAllInSituation && !hand.inBreak && (
        <div className="fixed inset-0 z-50 bg-[#11141b]/95 backdrop-blur-md flex items-start pt-10 sm:pt-14 justify-center p-5 animate-fade-in select-none">
          <div className="bg-[#19202b] border-2 border-amber-500/80 rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Smartphone size={32} />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-amber-400 uppercase tracking-widest">
                Turn Transition
              </div>
              <h3 className="text-2xl font-black text-white">
                Pass phone to <span className="text-amber-300">{cp.name}</span>
              </h3>
              {cpPos && (
                <div className="inline-block px-3 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-xs uppercase">
                  Position: {cpPos}
                </div>
              )}
            </div>

            <div className="p-3 bg-[#11141b] rounded-2xl border border-slate-800 text-xs text-slate-400">
              Hold the button below so a stray tap cannot open someone else&apos;s turn.
              {cpPin ? ' Hole cards stay hidden until you enter your PIN.' : ' Hole cards stay hidden until you tap Show Cards.'}
            </div>

            <button
              type="button"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
              className="relative w-full overflow-hidden py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer select-none touch-none"
            >
              <span
                className="absolute inset-y-0 left-0 bg-emerald-400/70 pointer-events-none"
                style={{ width: `${holdProgress}%` }}
              />
              <ShieldCheck size={18} className="relative" />
              <span className="relative">
                {holdProgress > 0 ? 'Keep holding…' : `Hold to confirm — ${cp.name}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 3-DIGIT CARD PIN (only the hole cards are locked) */}
      {pinPromptOpen && cp && (
        <div className="fixed inset-0 z-50 bg-[#11141b]/95 backdrop-blur-md flex items-start pt-10 sm:pt-14 justify-center p-5 animate-fade-in select-none">
          <div className="bg-[#19202b] border-2 border-amber-500/80 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-500 text-amber-400 flex items-center justify-center mx-auto">
              <KeyRound size={26} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-extrabold text-amber-400 uppercase tracking-widest">Cards Locked</div>
              <h3 className="text-xl font-black text-white">Enter {cp.name}&apos;s PIN</h3>
              <p className="text-[11px] text-slate-400">Stacks and bets stay visible; only your hole cards are hidden.</p>
            </div>

            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: 3 }, (_, slotIdx) => {
                const char = pinEntry[slotIdx];
                const isActive = pinEntry.length === slotIdx;
                return (
                  <div
                    key={slotIdx}
                    className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl transition-all ${
                      pinError
                        ? 'border-rose-500 bg-rose-950/50 text-rose-300'
                        : char != null
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                        : isActive
                        ? 'border-amber-500/70 bg-[#11141b] text-slate-500'
                        : 'border-slate-700 bg-[#11141b] text-slate-600'
                    }`}
                  >
                    {char != null ? '•' : ''}
                  </div>
                );
              })}
            </div>

            {pinError && <div className="text-xs font-bold text-rose-400">{pinError}</div>}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={shuffleKeypad}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
              >
                Shuffle
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {digitOrder.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handlePinDigit(d)}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-lg border border-slate-700 cursor-pointer transition-all"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setPinEntry(''); setPinError(''); }}
                className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs border border-slate-800 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-lg border border-slate-700 cursor-pointer transition-all"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => { setPinEntry((prev) => prev.slice(0, -1)); setPinError(''); }}
                className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 font-bold text-sm border border-slate-800 cursor-pointer"
              >
                ⌫
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setPinPromptOpen(false); setPinEntry(''); setPinError(''); }}
              className="w-full py-2 rounded-xl bg-[#222834] hover:bg-[#222834] text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM MUCK MODAL (When folding while check is free) */}
      {showConfirmMuckModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-[#19202b] border-2 border-rose-500/70 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="text-rose-400 font-black text-xl">Confirm Muck?</div>
            <div className="text-sm text-slate-300">
              Checking is free! Are you sure you want to muck/fold your hand instead of checking?
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmMuckModal(false);
                  submitGoAction('check');
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer shadow"
              >
                Check Instead
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmMuckModal(false);
                  submitGoAction('fold');
                }}
                className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-rose-950 text-rose-300 border border-rose-500/40 font-bold text-sm cursor-pointer shadow"
              >
                Confirm Fold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPPONENT STACKS MODAL */}
      {showOpponentStacksModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-[#19202b] border-2 border-slate-700 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Opponent Stacks</h3>
              <span className="text-xs text-amber-400 font-mono">
                {stackRounding === 'exact' ? 'Exact' : `Nearest ${stackRounding}`}
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {players.map((p, idx) => {
                if (cp && p.id === cp.id) return null;
                const roundedVal = roundStack(p.stack, stackRounding);
                const useExactDigits = activeUnit !== 'bb' && (stackRounding === 'exact' || roundedVal % 100 !== 0);
                const formattedStack = useExactDigits
                  ? formatFullBetAmount(roundedVal, cur, hand, activeUnit)
                  : formatPlayerTagAmount(roundedVal, cur, hand, false, activeUnit);
                const pos = positions[idx] || '';
                return (
                  <div key={p.id} className="bg-[#151921] px-3 py-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 min-w-0">
                      {pos && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-mono">{pos}</span>}
                      <span className="text-slate-200 truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.currentBet > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          (+{formatFullBetAmount(p.currentBet, cur, hand, activeUnit)})
                        </span>
                      )}
                      <span className="text-amber-300 font-mono font-extrabold text-sm">{formattedStack}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowOpponentStacksModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer shadow"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PINEAPPLE DISCARD STEP */}
      {hand?.cpNeedsDiscard && !hand?.cpDiscarded && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/50 bg-[#151921] p-4 space-y-3 my-auto shadow-2xl">
            <div className="text-center">
              <div className="text-amber-300 font-black text-lg uppercase tracking-wide">Discard One Card</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {hand.variant === 'pineapple' && 'Pineapple: discard before the flop is dealt.'}
                {hand.variant === 'crazy_pineapple' && 'Crazy Pineapple: discard now that the flop is out.'}
                {hand.variant === 'lazy_pineapple' && 'Lazy Pineapple: discard on the river.'}
              </p>
            </div>
            {(hand.players || []).filter((p) => p.status !== 'folded').map((p) => {
              const cards = goHoleCards[p.id] || [];
              const picked = goDiscards[p.id];
              return (
                <div key={p.id} className="rounded-xl bg-slate-900/70 border border-slate-700 p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200 truncate">{p.name}</span>
                    <span className={`text-[10px] font-black uppercase ${picked != null ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {picked != null ? 'Ready' : 'Tap a card'}
                    </span>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {cards.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onGoDiscardPick && onGoDiscardPick(p.id, i)}
                        className={`w-12 h-16 rounded-lg bg-white border-2 flex flex-col items-center justify-center shadow-md cursor-pointer transition-all ${
                          picked === i ? 'border-rose-500 opacity-40 scale-95' : 'border-slate-300 hover:border-amber-400'
                        }`}
                      >
                        <span className="text-base font-black leading-none text-slate-900">{rankDisplay(c.rank)}</span>
                        <span className={`text-lg leading-none ${suitColorClass(c.suit, displaySuitColors)}`}>{SUIT_SYMBOL[c.suit]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-center text-slate-500">
              Applied automatically once every player has chosen.
            </p>
          </div>
        </div>
      )}

      {/* SESSION HAND HISTORY MODAL */}
      {showHandHistoryModal && (
        <HandHistoryModal onClose={() => setShowHandHistoryModal(false)} />
      )}
    </div>
  );
}
