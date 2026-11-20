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

function getPlayerPasskeyId(p) {
  if (!p) return '';
  const name = String(p.name || '').trim();
  return name ? `name:${name}` : `seat:${p.seat ?? p.id}`;
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
  goHoleCards = {},
  stackRounding = 'exact',
  goSecurityMode = 'modal',
  suitColors = 2,
  displayUnit = 'chips',
  onNextHand,
  onEndHand,
  onDealNextStreet,
  onOpenSettings,
  onOpenStructureSetup,
  onEndSession,
  onToggleGoMode,
  showPosition = true,
  timerPaused = false,
  timerCanNudge = false,
  onPauseTimer,
  onResumeTimer,
  onNudgeTimer,
}) {
  const [peekCards, setPeekCards] = useState(false);
  const [showHandHistoryModal, setShowHandHistoryModal] = useState(false);
  const [raiseInput, setRaiseInput] = useState('');
  const [turnVerified, setTurnVerified] = useState(false);
  const [playerPasskeys, setPlayerPasskeys] = useState({});
  const [revealedPasskeys, setRevealedPasskeys] = useState({});
  const [passkeyEntry, setPasskeyEntry] = useState('');
  const [passkeyError, setPasskeyError] = useState('');
  const [justAssignedKey, setJustAssignedKey] = useState(false);
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
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';
  const players = hand?.players || [];
  const cpIndex = hand?.currentPlayer >= 0 ? hand.currentPlayer : -1;
  const cp = cpIndex >= 0 ? players[cpIndex] : null;
  const cpPasskeyId = cp ? getPlayerPasskeyId(cp) : '';
  const cpPasskey = cpPasskeyId ? playerPasskeys[cpPasskeyId] : '';
  const cpPasskeyRevealed = cpPasskeyId ? Boolean(revealedPasskeys[cpPasskeyId]) : false;

  // Ensure every player has a distinct random 2-digit passkey between 00 and 99
  useEffect(() => {
    if (!players.length) return;
    setPlayerPasskeys((prev) => {
      const missing = players.filter((p) => {
        const key = getPlayerPasskeyId(p);
        return key && !prev[key];
      });
      if (missing.length === 0) return prev;
      const next = { ...prev };
      const used = new Set(Object.values(next));
      missing.forEach((p) => {
        const key = getPlayerPasskeyId(p);
        let code = '';
        let guard = 0;
        do {
          code = String(Math.floor(Math.random() * 100)).padStart(2, '0');
          guard++;
        } while (used.has(code) && guard < 500);
        used.add(code);
        next[key] = code;
      });
      return next;
    });
  }, [players]);

  // Require security verification after EVERY action (never skip consecutive turns)
  useEffect(() => {
    setPeekCards(false);
    setRaiseInput('');
    setTurnVerified(false);
    setPasskeyEntry('');
    setPasskeyError('');
    setJustAssignedKey(false);
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

  // Accurate pot size
  const potTotal = players.reduce((s, p) => s + (p.totalBet || 0), 0);

  // Pot Limit enforcement for PLO
  const isPL = hand?.gameType === 'pl' || hand?.gameType === 'pot_limit' || hand?.variant === 'plo';
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
    setPasskeyEntry('');
    setPasskeyError('');
    setJustAssignedKey(false);
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

  const handlePasskeyDigit = (digit) => {
    if (!cpPasskey || passkeyEntry.length >= 2) return;
    const next = passkeyEntry + digit;
    setPasskeyEntry(next);
    setPasskeyError('');
    if (next.length === 2) {
      if (next === cpPasskey) {
        setTurnVerified(true);
        setPasskeyEntry('');
        setPasskeyError('');
      } else {
        setPasskeyError('Incorrect passkey — try again');
        setTimeout(() => setPasskeyEntry(''), 350);
      }
    }
  };

  // Keyboard shortcuts listener:
  // s = show/hide cards, f = fold, x/c = check, c = call, r = bet/raise, m = min, shift+a = all in / pot
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (needsTurnAck) {
        if (goSecurityMode === 'passkey' && cpPasskeyRevealed) {
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            handlePasskeyDigit(e.key);
          } else if (e.key === 'Backspace') {
            e.preventDefault();
            setPasskeyEntry((prev) => prev.slice(0, -1));
            setPasskeyError('');
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setPasskeyEntry('');
            setPasskeyError('');
          }
        } else if (goSecurityMode !== 'passkey' || !cpPasskeyRevealed) {
          if (e.key === 'Enter' && cp) {
            e.preventDefault();
            if (goSecurityMode === 'passkey' && cpPasskeyId) {
              setRevealedPasskeys((prev) => ({ ...prev, [cpPasskeyId]: true }));
              setJustAssignedKey(true);
            }
            setTurnVerified(true);
          }
        }
        return;
      }

      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter' && e.target === raiseInputRef.current) {
          e.preventDefault();
          handleExecuteRaise();
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
          setPeekCards((v) => !v);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cp, canCheck, disableCall, toCall, minRaise, effectiveMaxRaise, isPL, raiseInput, needsTurnAck, goSecurityMode, cpPasskeyRevealed, cpPasskey, cpPasskeyId, passkeyEntry, isAllInSituation]);

  const isShowdownComplete = Boolean(
    isAllInSituation && (commCards.length >= targetBoardLen || hand?.phase === 'awarded' || hand?.phase === 'ended')
  );

  const levelNum = hand?.levelIndex != null ? hand.levelIndex + 1 : (hand?.levelNumber || 1);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col justify-between p-3 sm:p-5 select-none max-w-2xl mx-auto border-x border-slate-800/80 shadow-2xl relative">
      {/* TOP HEADER: Row 1 (Explicit GO Mode Badge, Level #, Blinds, Clock + Controls, History, Switch Mode, End Session, Structure & Settings), Row 2 (Show Cards) */}
      <div className="space-y-2">
        {/* Row 1: Top Control Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#121620] rounded-xl border border-slate-800 text-xs shadow-sm flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-500/60 text-amber-300 font-black uppercase text-xs tracking-wider shadow">
              GO Mode · {hand?.variant === 'plo' ? 'PLO' : 'NLH'}
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
        <div className="flex items-center justify-between bg-[#141a24] px-3 py-1.5 rounded-xl border border-slate-700/80 shadow">
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
            onClick={() => setPeekCards((v) => !v)}
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

        {/* Newly assigned passkey banner on player's first turn */}
        {goSecurityMode === 'passkey' && justAssignedKey && turnVerified && cp && cpPasskey && (
          <div className="p-2.5 bg-indigo-950/90 border border-indigo-400/70 rounded-xl flex items-center justify-between gap-2 text-xs shadow-lg animate-fade-in">
            <div className="flex items-center gap-2 text-indigo-200">
              <KeyRound size={15} className="text-indigo-300 shrink-0" />
              <span>
                <strong className="text-white">{cp.name}</strong>, remember your 2-digit passkey for future turns:
              </span>
            </div>
            <span className="px-3 py-1 rounded-lg bg-indigo-500 text-white font-mono font-black text-base tracking-widest shadow">
              {cpPasskey}
            </span>
          </div>
        )}
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
                const suitColor = suitColorClass(c.suit, suitColors);
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
        <div className="my-2 bg-[#121722] p-3 rounded-2xl border-2 border-amber-500/80 shadow-2xl space-y-2 animate-fade-in">
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
                      : 'bg-[#171d29] border-slate-700/80'
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
                      const sc = suitColorClass(c.suit, suitColors);
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
          <div className="bg-[#131722] p-5 rounded-3xl border border-amber-500/60 shadow-2xl text-center space-y-4">
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
                        className="w-10 h-14 rounded-lg border-2 border-dashed border-slate-700 bg-[#171c26] flex items-center justify-center text-slate-600 font-bold text-sm"
                      >
                        ?
                      </div>
                    );
                  }
                  const suitColor = suitColorClass(c.suit, suitColors);
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
              <div className="space-y-1.5 bg-[#171d29] p-3.5 rounded-2xl border border-emerald-500/50 mt-2 shadow-lg animate-fade-in text-center">
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
          <div className="bg-[#131722] p-4 sm:p-6 rounded-3xl border border-slate-700/80 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
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
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Current Pot
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight drop-shadow-md">
                    {formatPotAmount(potTotal, cur, hand, activeUnit)}
                  </div>
                </div>

                {/* Last Raise / Bet Info next to Current Pot */}
                <div className="bg-[#181e2c] border border-slate-700/80 rounded-2xl px-3 py-2 text-left min-w-[130px]">
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
                            className="w-9 h-12 rounded-lg border-2 border-dashed border-slate-700 bg-[#171c26] flex items-center justify-center text-slate-600 font-bold text-xs"
                          >
                            ?
                          </div>
                        );
                      }
                      const suitColor = suitColorClass(c.suit, suitColors);
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
          <div className="p-6 bg-[#131722] rounded-3xl border border-slate-800 text-center space-y-4">
            <h2 className="text-2xl font-black text-amber-300">Hand Concluded</h2>
            {aggregatedWinners.length > 0 && (
              <div className="space-y-1.5 bg-[#181d26] p-3 rounded-2xl border border-emerald-500/40">
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
                            : 'bg-[#171d29] border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-xs font-bold text-white">
                          <span className="truncate max-w-[110px]">{p.name}</span>
                          {isWinner && <span className="text-[10px] text-amber-300 font-black">🏆</span>}
                        </div>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {sorted.length > 0 ? sorted.map((c, ci) => {
                            const sc = suitColorClass(c.suit, suitColors);
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
                    const suitColor = suitColorClass(c.suit, suitColors);
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
      {isAllInSituation ? (
        /* In an all-in: deal streets manually until river; on/post river show "Deal Next Hand" */
        <div className="bg-[#141a24] p-3 rounded-2xl border border-slate-700/80 shadow-2xl">
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
        <div className="bg-[#141a24] p-3 rounded-2xl border border-slate-700/80 space-y-2.5 shadow-2xl">
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
              className="w-32 px-3 py-2 rounded-xl bg-[#0d1017] border border-slate-700 text-white text-sm font-bold text-center focus:outline-none focus:border-amber-400"
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

      {/* GAME SECURITY OVERLAY (Always shown after every action: Modal or Passkey System) */}
      {needsTurnAck && cp && !isAllInSituation && (
        <div className="fixed inset-0 z-50 bg-[#0d1017]/95 backdrop-blur-md flex items-start pt-10 sm:pt-14 justify-center p-5 animate-fade-in select-none">
          <div className="bg-[#181d26] border-2 border-amber-500/80 rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              {goSecurityMode === 'passkey' && cpPasskeyRevealed ? <KeyRound size={30} /> : <Smartphone size={32} />}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-amber-400 uppercase tracking-widest">
                {goSecurityMode === 'passkey' ? 'Passkey Security' : 'Turn Transition'}
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

            {goSecurityMode === 'passkey' && cpPasskeyRevealed ? (
              <div className="space-y-4">
                <div className="p-3 bg-[#11141b] rounded-2xl border border-slate-800 text-xs text-slate-300">
                  Enter <span className="text-white font-bold">{cp.name}</span>&apos;s 2-digit passkey to unlock your action and cards.
                </div>

                {/* 2-digit PIN boxes */}
                <div className="flex items-center justify-center gap-3">
                  {[0, 1].map((slotIdx) => {
                    const char = passkeyEntry[slotIdx];
                    const isActive = passkeyEntry.length === slotIdx;
                    return (
                      <div
                        key={slotIdx}
                        className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center font-mono text-2xl font-black transition-all ${
                          passkeyError
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

                {passkeyError && (
                  <div className="text-xs font-bold text-rose-400">{passkeyError}</div>
                )}

                {/* Numeric Keypad 00-99 */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handlePasskeyDigit(d)}
                      className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-lg border border-slate-700 cursor-pointer transition-all"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setPasskeyEntry(''); setPasskeyError(''); }}
                    className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs border border-slate-800 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePasskeyDigit('0')}
                    className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-lg border border-slate-700 cursor-pointer transition-all"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPasskeyEntry((prev) => prev.slice(0, -1)); setPasskeyError(''); }}
                    className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 font-bold text-sm border border-slate-800 cursor-pointer"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-[#11141b] rounded-2xl border border-slate-800 text-xs text-slate-400">
                  {goSecurityMode === 'passkey' ? (
                    <>
                      Pass the phone to <span className="text-white font-bold">{cp.name}</span>. Click below to reveal your personal 2-digit passkey and open your turn.
                    </>
                  ) : (
                    <>
                      Pass the phone to <span className="text-white font-bold">{cp.name}</span>. When ready, click below to view your action and cards.
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (goSecurityMode === 'passkey' && cpPasskeyId) {
                      setRevealedPasskeys((prev) => ({ ...prev, [cpPasskeyId]: true }));
                      setJustAssignedKey(true);
                    }
                    setTurnVerified(true);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
                >
                  <ShieldCheck size={18} />
                  <span>{goSecurityMode === 'passkey' ? `Reveal Key & Start — ${cp.name}` : `I am ${cp.name}`}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM MUCK MODAL (When folding while check is free) */}
      {showConfirmMuckModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-[#181d26] border-2 border-rose-500/70 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
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
          <div className="bg-[#181d26] border-2 border-slate-700 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white">
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
                  <div key={p.id} className="bg-[#11141c] px-3 py-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-bold">
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

      {/* SESSION HAND HISTORY MODAL */}
      {showHandHistoryModal && (
        <HandHistoryModal onClose={() => setShowHandHistoryModal(false)} />
      )}
    </div>
  );
}
