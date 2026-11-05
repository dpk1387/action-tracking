import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import SetupDialog from '@/components/poker/SetupDialog';
import MysteryBountyDialog from '@/components/poker/MysteryBountyDialog';
import StacksBar from '@/components/poker/StacksBar';
import PokerTable from '@/components/poker/PokerTable';
import ActionRecorder from '@/components/poker/ActionRecorder';
import OutOfTurnRecorder from '@/components/poker/OutOfTurnRecorder';
import ActionHistory from '@/components/poker/ActionHistory';
import CommunityCardInput from '@/components/poker/CommunityCardInput';
import EndHandDialog from '@/components/poker/EndHandDialog';
import SevenTwoAward from '@/components/poker/SevenTwoAward';
import AllInEquity from '@/components/poker/AllInEquity';
import DiscardStep from '@/components/poker/DiscardStep';
import NextLevelDialog from '@/components/poker/NextLevelDialog';
import RebuyCashoutDialog from '@/components/poker/RebuyCashoutDialog';
import LateEntryDialog from '@/components/poker/LateEntryDialog';
import ReentryDialog from '@/components/poker/ReentryDialog';
import RebuyDialog from '@/components/poker/RebuyDialog';
import ShareDialog from '@/components/poker/ShareDialog';
import StartScreen from '@/components/poker/StartScreen';
import EndSessionDialog from '@/components/poker/EndSessionDialog';
import BreakDialog from '@/components/poker/BreakDialog';
import GameOverScreen from '@/components/poker/GameOverScreen';
import SetLevelDialog from '@/components/poker/SetLevelDialog';
import BombPotDialog from '@/components/poker/BombPotDialog';
import CompactModeView from '@/components/poker/CompactModeView';
import TemporaryGameModal from '@/components/poker/TemporaryGameModal';
import { findPlanForHand } from '@/lib/tempGameScheduler';
import { Undo2, Eye, EyeOff, Share2, Save, Power, Rewind, FastForward, Snowflake, Clock, UserPlus, Minimize2, Maximize2, Zap } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sessionStore } from '@/lib/sessionStore';
import { useAuth } from '@/lib/AuthContext';
import { mttStore } from '@/lib/mttStore';
import {
  publishLive, getShareCode, setShareCode, ensureSaveCode, saveNow, loadSavedSession,
  discardSavedSession, getSaveStatus, subscribeSaveStatus,
} from '@/lib/liveSync';
import {
  startHand, applyAction, dealNextStreet, fillBoard, endHand, computePots, awardPots,
  positionForSeat, getButtonIndex, money, formatPotAmount, formatPotOutcome, formatSessionName, getMultipleBoardWinPercentages, potTotal, STREET_LABEL, calcEquity, VARIANTS, GAME_TYPES, variantMeta, tryAutoWinners, winningHandCards, refundUncontestedPots, effectiveHoleSize, holeCardsComplete, recomputeBlindsForLevel, postBlinds, bbaPotOpts, recordOutOfTurn, formatBlinds, bettingFrozen, isAllInShowdown, parseAmount, clone, calcAnteForType,
} from '@/lib/poker';
import { rewardFor } from '@/lib/sevenTwoPatterns';
import { suggestAnte } from '@/lib/poker';
import { suggestNextBlinds } from '@/lib/tournamentStructures';
import { advanceToNextHand, initLevelTimer, advanceTimerSegment, pauseLevelTimer, resumeLevelTimer, levelTimerState, formatTimer, formatTimerLabel, nudgeLevelTimer, scheduledLevelNumber } from '@/lib/levelTimer';

export default function PokerTracker() {
  const [config, setConfig] = useState(() => sessionStore.get().config);
  const [hand, setHand] = useState(() => sessionStore.get().hand);
  const [history, setHistory] = useState([]);
  const [showSetup, setShowSetup] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [showBlinds, setShowBlinds] = useState(false);
  const [blindsPrefill, setBlindsPrefill] = useState(null);
  const [preplannerLevel, setPreplannerLevel] = useState(false);
  const [gameOver, setGameOver] = useState(() => sessionStore.get().gameOver);
  const [holeCards, setHoleCards] = useState({});
  const [equity, setEquity] = useState(null);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showRebuy, setShowRebuy] = useState(false);
  const [showReentry, setShowReentry] = useState(false);
  const [showLateEntry, setShowLateEntry] = useState(false);
  const [showBombPotModal, setShowBombPotModal] = useState(false);
  const [showTempGameModal, setShowTempGameModal] = useState(false);
  const [runTimesInput, setRunTimesInput] = useState('2');
  const [runTimesApplied, setRunTimesApplied] = useState(1);
  const [freezeStacks, setFreezeStacks] = useState(true);
  const [frozenStacks, setFrozenStacks] = useState({});
  const [displayUnit, setDisplayUnit] = useState(() => {
    try {
      return localStorage.getItem('poker_display_unit') || 'chips';
    } catch (_) {
      return 'chips';
    }
  });
  const [discards, setDiscards] = useState({});
  const [actionError, setActionError] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [shareVersion, setShareVersion] = useState(0);
  const [savedSession, setSavedSession] = useState(null);
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [showEndSession, setShowEndSession] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showBreak, setShowBreak] = useState(false);
  const [showRaceOverride, setShowRaceOverride] = useState(null);
  const [showSetLevel, setShowSetLevel] = useState(false);
  const [bonusApplied, setBonusApplied] = useState(false);
  const [sevenTwoFoldWinner, setSevenTwoFoldWinner] = useState(null);

  // Compact Mode state (auto-enabled on small screens, persists preference)
  const [isCompactMode, setIsCompactMode] = useState(() => {
    try {
      const saved = localStorage.getItem('poker_compact_mode');
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  useEffect(() => {
    try {
      localStorage.setItem('poker_compact_mode', String(isCompactMode));
    } catch (_) {}
  }, [isCompactMode]);

  useEffect(() => {
    if (hand) {
      document.title = `${formatSessionName(hand)} | Poker Action Tracker`;
    }
  }, [hand?.variant, hand?.bombPot, hand?.handNumber]);

  // Action Clock System
  const [shotClockEnabled, setShotClockEnabled] = useState(true);
  const [calledClockActive, setCalledClockActive] = useState(false);
  const [actionClockSecondsLeft, setActionClockSecondsLeft] = useState(null);
  const [actionClockTotal, setActionClockTotal] = useState(null);
  const [actionClockType, setActionClockType] = useState(null); // 'shot_clock' | 'call_clock'

  const getBaseActionSeconds = (h) => {
    const cfg = h?.clockConfig;
    if (!cfg) return 30;
    if (cfg.timeBankMode === 'single') {
      return Number(cfg.singleSeconds) || 30;
    }
    if (h.street === 'preflop') {
      return Number(cfg.preflopSeconds) || 20;
    }
    if (cfg.postflopSplitStreet) {
      if (h.street === 'flop') return Number(cfg.flopSeconds) || 40;
      if (h.street === 'turn') return Number(cfg.turnSeconds) || 40;
      if (h.street === 'river') return Number(cfg.riverSeconds) || 40;
    }
    return Number(cfg.postflopSeconds) || 40;
  };

  const handleCallClock = () => {
    if (!hand || hand.currentPlayer < 0) return;
    if (calledClockActive) {
      setCalledClockActive(false);
      setActionClockSecondsLeft(null);
      setActionClockTotal(null);
      setActionClockType(null);
      return;
    }
    const sec = Number(hand.clockConfig?.callClockSeconds) || 60;
    setCalledClockActive(true);
    setActionClockSecondsLeft(sec);
    setActionClockTotal(sec);
    setActionClockType('call_clock');
  };

  const handleUseTimeBank = (playerId) => {
    if (!hand) return;
    setHand((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) => {
          if (p.id === playerId) {
            const banks = p.timeBanks ?? prev.clockConfig?.initialTimeBanks ?? 3;
            if (banks <= 0) return p;
            return { ...p, timeBanks: banks - 1, usedBanks: (p.usedBanks || 0) + 1 };
          }
          return p;
        }),
      };
    });
    if (hand.currentPlayer >= 0 && hand.players[hand.currentPlayer]?.id === playerId) {
      const addSec = Number(hand.clockConfig?.timeBankAddSeconds) || 30;
      setActionClockSecondsLeft((curr) => (curr != null ? curr + addSec : addSec));
      setActionClockTotal((curr) => (curr != null ? curr + addSec : addSec));
    }
  };

  const handleAdjustTimeBanks = (playerId, delta) => {
    if (!hand) return;
    setHand((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) => {
          if (p.id === playerId) {
            const banks = Math.max(0, (p.timeBanks ?? prev.clockConfig?.initialTimeBanks ?? 3) + delta);
            return { ...p, timeBanks: banks };
          }
          return p;
        }),
      };
    });
  };

  const currentActionKey = hand && hand.phase === 'playing' && hand.currentPlayer >= 0
    ? `${hand.handNumber}-${hand.street}-${hand.currentPlayer}`
    : null;

  useEffect(() => {
    setCalledClockActive(false);

    if (!hand || hand.phase !== 'playing' || hand.currentPlayer < 0) {
      setActionClockSecondsLeft(null);
      setActionClockTotal(null);
      setActionClockType(null);
      return;
    }

    const clockSys = hand.clockConfig?.clockSystem || 'call_clock';
    if (clockSys === 'time_banks' && shotClockEnabled) {
      const baseSec = getBaseActionSeconds(hand);
      setActionClockSecondsLeft(baseSec);
      setActionClockTotal(baseSec);
      setActionClockType('shot_clock');
    } else {
      setActionClockSecondsLeft(null);
      setActionClockTotal(null);
      setActionClockType(null);
    }
  }, [currentActionKey, shotClockEnabled, hand?.clockConfig?.clockSystem]);

  useEffect(() => {
    if (actionClockSecondsLeft == null) return;
    if (!hand || hand.phase !== 'playing' || hand.currentPlayer < 0) return;

    if (actionClockSecondsLeft <= 0) {
      const cp = hand.players[hand.currentPlayer];
      if (!cp) return;

      if (actionClockType === 'shot_clock') {
        const banks = cp.timeBanks ?? hand.clockConfig?.initialTimeBanks ?? 3;
        if (banks > 0) {
          // Automatically deduct 1 time bank, increment usedBanks, and reset timer
          setHand((prev) => {
            if (!prev || prev.currentPlayer < 0) return prev;
            return {
              ...prev,
              players: prev.players.map((p, idx) =>
                idx === prev.currentPlayer
                  ? { ...p, timeBanks: Math.max(0, (p.timeBanks ?? 3) - 1), usedBanks: (p.usedBanks || 0) + 1 }
                  : p
              ),
            };
          });
          const addSec = Number(hand.clockConfig?.timeBankAddSeconds) || 30;
          setActionClockSecondsLeft(addSec);
          setActionClockTotal(addSec);
          return;
        }
      }

      // If out of time banks or called clock expired: auto-fold if facing a bet, auto-check if facing no bet
      const toCall = (hand.currentBet || 0) - (cp.currentBet || 0);
      setCalledClockActive(false);
      setActionClockSecondsLeft(null);
      setActionClockTotal(null);
      setActionClockType(null);
      handleAction(toCall > 0 ? 'fold' : 'check');
      return;
    }

    const timer = setTimeout(() => {
      setActionClockSecondsLeft((prev) => (prev != null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [actionClockSecondsLeft, actionClockType, hand]);

  const offeredRaceRef = useRef(null);
  const recordedHandNumbers = useRef(new Set());
  const { isAuthenticated } = useAuth();
  const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);

  useEffect(() => {
    try {
      localStorage.setItem('poker_display_unit', displayUnit);
    } catch (_) {}
  }, [displayUnit]);

  useEffect(() => {
    sessionStore.set({ config, hand, gameOver, hideAmounts, displayUnit });
  }, [config, hand, gameOver, hideAmounts, displayUnit]);

  useEffect(() => {
    if (!hand || hand.mode !== 'tournament') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const adv = advanceTimerSegment(hand, t);
      if (adv !== hand) setHand(adv);
    }, 1000);
    return () => clearInterval(id);
  }, [hand]);

  useEffect(() => {
    if (!hand || !hand.pendingRace) return;
    const isIdle = !hand.actionHistory || hand.actionHistory.length === 0;
    if (hand.phase !== 'awarded' && !isIdle) return;
    const rc = hand.pendingRace;
    const key = `${rc.tLevel}:${rc.retired}-${rc.replacement}`;
    if (offeredRaceRef.current === key) return;
    offeredRaceRef.current = key;
    setShowRaceOverride(rc);
    setShowBreak(true);
  }, [hand]);

  useEffect(() => {
    if (!hand || !hand.pendingMissedRaces || !hand.pendingMissedRaces.length) return;
    if (hand.phase !== 'awarded') return;
    const races = hand.pendingMissedRaces;
    const key = 'missed:' + races.map((r) => `${r.tLevel}:${r.retired}-${r.replacement}`).join(',');
    if (offeredRaceRef.current === key) return;
    offeredRaceRef.current = key;
    setShowRaceOverride(races[0]);
    setShowBreak(true);
  }, [hand]);

  useEffect(() => { if (hand) ensureSaveCode(); }, [hand]);
  useEffect(() => { publishLive({ config, hand, gameOver, equity, hideAmounts, holeCards }); }, [config, hand, gameOver, equity, hideAmounts, holeCards, shareVersion]);

  useEffect(() => {
    if (!hand || !hand.players) return;
    const snap = {};
    hand.players.forEach((p) => {
      snap[p.seat] = hand.phase === 'awarded'
        ? p.stack
        : (p.initialStack != null ? p.initialStack : p.stack);
    });
    setFrozenStacks(snap);
  }, [hand?.handNumber, hand?.phase]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code') || urlParams.get('resume');
    if (code && code !== getShareCode()) {
      setShareCode(code);
      setResumeChecked(false);
    }
    if (hand || resumeChecked) return;
    if (isAuthenticated) { setResumeChecked(true); return; }
    let cancelled = false;
    loadSavedSession().then((res) => {
      if (cancelled) return;
      if (res) { setSavedSession(res.saved); setSavedUpdatedAt(res.updatedAt); }
      setResumeChecked(true);
    }).catch(() => { if (!cancelled) setResumeChecked(true); });
    return () => { cancelled = true; };
  }, [hand, resumeChecked, location.pathname, location.search, isAuthenticated]);

  useEffect(() => {
    const s = sessionStore.get();
    if (s.hand !== hand || s.config !== config || s.gameOver !== gameOver) {
      setConfig(s.config); setHand(s.hand); setGameOver(s.gameOver);
    }
  }, [location.pathname]);

  const recordHand = (h) => {
    if (recordedHandNumbers.current.has(h.handNumber)) return;
    recordedHandNumbers.current.add(h.handNumber);
    const bi = getButtonIndex(h);
    sessionStore.addHand({
      handNumber: h.handNumber,
      smallBlind: h.smallBlind,
      bigBlind: h.bigBlind,
      anteType: h.anteType,
      anteAmount: h.anteAmount,
      currency: h.currency,
      communityCards: h.communityCards,
      actions: h.actionHistory,
      actionHistory: h.actionHistory,
      holeCards: { ...holeCards },
      pots: h.pots,
      winners: h.winners,
      notes: h.sideNotes || [],
      bombPot: !!h.bombPot,
      killPot: !!(h.sideGames?.killPot || h.sideGames?.halfKill),
      halfKill: !!h.sideGames?.halfKill,
      players: h.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        initialStack: p.initialStack,
        stack: p.stack,
        position: positionForSeat(h.players.length, bi, i, h.variant),
      })),
    });
  };

  const setupInitial = useMemo(() => {
    if (!hand) return config;
    return {
      ...config,
      ...hand,
      isMidGame: true,
      variant: hand.variant || config?.variant,
      gameType: hand.gameType || config?.gameType,
      smallBlind: hand.smallBlind ?? config?.smallBlind,
      bigBlind: hand.bigBlind ?? config?.bigBlind,
      anteAmount: hand.anteAmount ?? config?.anteAmount,
      anteType: hand.anteType || config?.anteType,
      doubleBoard: hand.doubleBoard ?? config?.doubleBoard,
      bombPot: hand.bombPot ?? config?.bombPot,
      bombAmount: hand.bombAmount ?? config?.bombAmount,
      players: (hand.players || []).map((p) => ({
        seat: p.seat,
        name: p.name,
        stack: p.stack, // MID-GAME ONLY: prefill with player's current stack size
        occupied: p.status !== 'eliminated' && p.status !== 'out',
      })),
    };
  }, [hand, config]);

  const positions = (h) => {
    if (!h) return [];
    const n = h.players.length;
    const bi = getButtonIndex(h);
    return h.players.map((_, i) => positionForSeat(n, bi, i, h.variant));
  };

  const resetHoleCards = () => { setHoleCards({}); setEquity(null); };
  const pushHistory = (h) => setHistory((prev) => [...prev, h]);

  const handleSave = (cfg) => {
    setConfig(cfg);
    if (hand) {
      const newSchedule = cfg.blindSchedule || [];
      const updatedPlayers = cfg.players.map((cp, idx) => {
        const existing = hand.players.find((p) => p.seat === cp.seat) || hand.players[idx];
        return {
          id: idx,
          name: cp.name || (existing ? existing.name : `Player ${cp.seat}`),
          seat: cp.seat,
          initialStack: existing?.initialStack != null ? existing.initialStack : cp.stack,
          stack: cp.stack,
          currentBet: existing?.currentBet || 0,
          totalBet: existing?.totalBet || 0,
          status: cp.stack > 0 ? (existing?.status === 'folded' ? 'folded' : 'active') : 'busted',
          lastAction: existing?.lastAction || null,
          timeBanks: existing?.timeBanks != null ? existing.timeBanks : (cfg.clockConfig?.initialTimeBanks ?? 3),
          usedBanks: existing?.usedBanks || 0,
        };
      });

      const snap = {};
      updatedPlayers.forEach((p) => { snap[p.seat] = p.stack; });
      setFrozenStacks(snap);

      setHand((prev) => {
        let updated = {
          ...prev,
          players: updatedPlayers,
          blindSchedule: newSchedule,
          levelConfig: cfg.levelConfig || prev.levelConfig,
          chipDenominations: cfg.chipDenominations || prev.chipDenominations,
          currency: cfg.currency || prev.currency,
          gameType: cfg.gameType || prev.gameType,
          mode: cfg.mode || prev.mode,
          variant: cfg.variant || prev.variant,
          baseVariant: cfg.variant || prev.baseVariant || prev.variant,
          tableSize: cfg.tableSize || prev.tableSize,
          doubleBoard: !!cfg.doubleBoard,
          baseDoubleBoard: !!cfg.doubleBoard,
          allowStraddle: !!cfg.allowStraddle,
          allowMultiStraddle: !!cfg.allowMultiStraddle,
          mandatoryStraddle: !!cfg.mandatoryStraddle,
          bombPot: !!cfg.bombPot,
          baseBombPot: !!cfg.bombPot,
          bombAmount: cfg.bombAmount || prev.bombAmount,
          smallBlind: cfg.smallBlind != null ? cfg.smallBlind : prev.smallBlind,
          bigBlind: cfg.bigBlind != null ? cfg.bigBlind : prev.bigBlind,
          thirdBlind: cfg.thirdBlind != null ? cfg.thirdBlind : prev.thirdBlind,
          anteAmount: cfg.anteAmount != null ? cfg.anteAmount : prev.anteAmount,
          anteType: cfg.anteType || prev.anteType,
          sbHalfAnteShortHanded: cfg.sbHalfAnteShortHanded !== undefined ? cfg.sbHalfAnteShortHanded : prev.sbHalfAnteShortHanded,
          shortHandedThreshold: cfg.shortHandedThreshold || prev.shortHandedThreshold,
          smallBet: Number(cfg.smallBet) || prev.smallBet,
          bigBet: Number(cfg.bigBet) || prev.bigBet,
          flMaxRaises: Number(cfg.flMaxRaises) || prev.flMaxRaises,
          lateRegEnabled: cfg.lateRegEnabled !== false,
          lateRegLevel: cfg.lateRegLevel || prev.lateRegLevel,
          tournamentFormat: cfg.tournamentFormat || prev.tournamentFormat,
          maxReEntries: cfg.maxReEntries ?? prev.maxReEntries,
          startingStack: cfg.startingStack || prev.startingStack,
          rebuyPrice: cfg.rebuyPrice,
          rebuyChips: cfg.rebuyChips,
          allowAddOn: cfg.allowAddOn,
          addOnPrice: cfg.addOnPrice,
          addOnChips: cfg.addOnChips,
          bountyConfig: cfg.bountyConfig || prev.bountyConfig,
          pendingLevelIdx: Math.min(prev.pendingLevelIdx || 0, Math.max(0, newSchedule.length - 1)),
          tLevel: Math.min(prev.tLevel || 0, Math.max(0, newSchedule.length - 1)),
          clockConfig: cfg.clockConfig || prev.clockConfig,
        };
        if (cfg.firstButton && cfg.firstButton !== 'random') {
          const chosenSeat = Number(cfg.firstButton);
          if (updated.players.some((p) => p.seat === chosenSeat)) {
            updated.buttonSeat = chosenSeat;
          }
        }
        if (updated.actionHistory && updated.actionHistory.length === 0 && updated.street === 'preflop') {
          updated = recomputeBlindsForLevel(updated, updated.smallBlind, updated.bigBlind, updated.anteAmount);
        }
        return updated;
      });
      setShowSetup(false);
      return;
    }

    recordedHandNumbers.current.clear();
    const validPlayers = cfg.players.filter((p) => p.occupied !== false);
    const pool = validPlayers.length ? validPlayers : cfg.players;
    let btn;
    if (cfg.firstButton === 'random' || cfg.firstButton == null) {
      const randIdx = Math.floor(Math.random() * pool.length);
      btn = pool[randIdx].seat;
    } else {
      const chosenSeat = Number(cfg.firstButton);
      const exists = pool.some((p) => p.seat === chosenSeat);
      btn = exists ? chosenSeat : pool[0].seat;
    }
    const newHand = initLevelTimer(startHand(cfg, btn, 1), cfg.levelConfig);
    setHand(newHand);
    const initFrozen = {};
    cfg.players.forEach((p) => { initFrozen[p.seat] = p.stack; });
    setFrozenStacks(initFrozen);
    setHistory([]);
    setShowSetup(false);
    resetHoleCards();
  };

  const updateFrozenStacks = (awardedHand) => {
    if (!awardedHand || !awardedHand.players) return;
    const snap = {};
    awardedHand.players.forEach((p) => { snap[p.seat] = p.stack; });
    setFrozenStacks(snap);
  };

  const handleAction = (type, amount) => {
    setCalledClockActive(false);
    const next = applyAction(hand, hand.currentPlayer, type, amount);
    if (next && next.error) { setActionError(next.error); return; }
    setActionError('');
    pushHistory(hand);
    if (next.phase === 'ended') {
      const nf = next.players.filter((p) => p.status !== 'folded');
      if (nf.length === 1) {
        const pots = computePots(next.players, bbaPotOpts(next));
        const winners = {};
        pots.forEach((pot, i) => { winners[i] = nf[0].id; });
        const awarded = awardPots(next, winners, { holeCards });
        updateFrozenStacks(awarded);
        setHand(awarded);
        advanceAfterAward(awarded);
      } else {
        setHand(next);
      }
    } else {
      setHand(next);
    }
  };

  const handleRecordOutOfTurn = (playerId, kind, amount) => {
    if (playerId == null || !kind) return;
    pushHistory(hand);
    setHand(recordOutOfTurn(hand, playerId, kind, amount));
  };

  const handleFoldOutOfTurn = (playerId) => {
    if (playerId == null) return;
    const savedTurn = hand.currentPlayer;
    const next = applyAction(hand, playerId, 'fold');
    if (next && next.error) { setActionError(next.error); return; }
    if (bettingFrozen(next)) {
      next.currentPlayer = -1;
    } else if (savedTurn >= 0 && next.players[savedTurn] && next.players[savedTurn].status === 'active' && next.players[savedTurn].stack > 0) {
      next.currentPlayer = savedTurn;
    } else {
      next.currentPlayer = next.players.findIndex((p) => p.status === 'active' && p.stack > 0);
    }
    setActionError('');
    pushHistory(hand);
    setHand(next);
  };

  const handleDeal = (cards) => {
    const res = dealNextStreet(hand, cards);
    if (res.error) return res;
    pushHistory(hand);
    setHand(res.hand);
    return {};
  };

  const handleDealHidden = () => {
    const res = dealNextStreet(hand, [], true);
    if (res.error) return res;
    pushHistory(hand);
    setHand(res.hand);
    return {};
  };

  const handleFillBoard = (cards) => {
    const res = fillBoard(hand, cards);
    if (res.error) return res;
    pushHistory(hand);
    setHand(res.hand);
    return {};
  };

  const handleDealBoard = (boardIndex, cards) => {
    setHand((prev) => {
      if (!prev) return prev;
      pushHistory(prev);
      const h = clone(prev);
      if (boardIndex === 1) {
        const existing = (h.communityCards || []).filter((c) => !c.hidden);
        h.communityCards = [...existing, ...cards];
        if (h.communityCards.length >= 5) {
          h.street = 'river';
        } else if (h.communityCards.length >= 4) {
          h.street = 'turn';
        } else if (h.communityCards.length >= 3) {
          h.street = 'flop';
        }
      } else if (boardIndex === 2) {
        const existing = (h.boardB || []).filter((c) => !c.hidden);
        h.boardB = [...existing, ...cards];
      } else if (boardIndex === 3) {
        const existing = (h.boardC || []).filter((c) => !c.hidden);
        h.boardC = [...existing, ...cards];
      }

      const aLen = (h.communityCards || []).filter((c) => !c.hidden).length;
      const bLen = (h.boardB || []).filter((c) => !c.hidden).length;
      const is3x = (Number(h.runTimes) >= 3) || (Number(h.bombBoards) >= 3);
      const cLen = is3x ? (h.boardC || []).filter((c) => !c.hidden).length : 5;

      if (aLen >= 5 && bLen >= 5 && cLen >= 5) {
        h.phase = 'ended';
        h.currentPlayer = -1;
        h.street = 'river';
        h.message = 'Hand complete – award the pots to finish.';
      } else {
        h.message = `Board ${boardIndex} updated.`;
      }

      return h;
    });
    return {};
  };

  const handleSetBoardCards = (boardIndex, cards) => {
    setHand((prev) => {
      if (!prev) return prev;
      pushHistory(prev);
      const h = clone(prev);
      if (boardIndex === 1) {
        h.communityCards = cards;
        if (cards.length >= 5) h.street = 'river';
        else if (cards.length >= 4) h.street = 'turn';
        else if (cards.length >= 3) h.street = 'flop';
      } else if (boardIndex === 2) {
        h.boardB = cards;
      } else if (boardIndex === 3) {
        h.boardC = cards;
      }

      const aLen = (h.communityCards || []).filter((c) => !c.hidden).length;
      const bLen = (h.boardB || []).filter((c) => !c.hidden).length;
      const isMultiRun = Number(h.runTimes) >= 2;
      const is3x = (Number(h.runTimes) >= 3) || (Number(h.bombBoards) >= 3);
      const cLen = is3x ? (h.boardC || []).filter((c) => !c.hidden).length : 5;

      const allComplete = is3x ? (aLen >= 5 && bLen >= 5 && cLen >= 5) : isMultiRun ? (aLen >= 5 && bLen >= 5) : (aLen >= 5);
      if (allComplete) {
        h.phase = 'ended';
        h.currentPlayer = -1;
        h.street = 'river';
        h.message = 'Hand complete – award the pots to finish.';
      }

      return h;
    });
  };

  const handleRunIt = (times) => {
    setHand((prev) => {
      if (!prev) return prev;
      const is3x = Number(times) === 3;
      const bCount = is3x ? 3 : 2;
      const curA = prev.communityCards || [];
      const bB = curA.map((c) => ({ ...c }));
      const bC = is3x ? curA.map((c) => ({ ...c })) : [];
      return {
        ...prev,
        doubleBoard: true,
        bombBoards: bCount,
        runTimes: Number(times),
        runItSelected: Number(times),
        boardB: bB,
        boardC: is3x ? bC : [],
      };
    });
  };

  const sevenTwoActive = (h) => !!(h?.sideGames?.sevenTwo);

  const sevenTwoQualifyingWinner = (awarded) => {
    if (!sevenTwoActive(awarded)) return null;
    const sg = awarded.sideGames || {};
    const tenBB = (Number(awarded.bigBlind) || 0) * 10;
    const mainWinners = awarded.winners.filter((w) => w.potIndex === 0 && w.board !== 'b');
    if (mainWinners.length !== 1) return null;
    const wid = mainWinners[0].playerId;
    const hole = holeCards[wid];
    if (!hole || hole.length < 2) return null;
    const amt = rewardFor(sg.sevenTwoRewards, hole, tenBB, tenBB);
    if (amt == null || amt <= 0) return null;
    return { playerId: wid, amount: amt };
  };

  const advanceAfterAward = (awarded) => {
    updateFrozenStacks(awarded);
    recordHand(awarded);
    if (sevenTwoActive(awarded)) {
      const nonFolded = awarded.players.filter((p) => p.status !== 'folded');
      if (nonFolded.length === 1 && !(holeCards[nonFolded[0].id] && holeCards[nonFolded[0].id].length >= 2)) {
        setSevenTwoFoldWinner(nonFolded[0].id);
        setBonusApplied(false);
        return;
      }
      const q = sevenTwoQualifyingWinner(awarded);
      if (q) {
        pushHistory(awarded);
        const bonusAwarded = awardPots(awarded, {}, { bonuses: [q], holeCards });
        updateFrozenStacks(bonusAwarded);
        setHand(bonusAwarded);
        setBonusApplied(true);
        setSevenTwoFoldWinner(null);
        return;
      }
      setSevenTwoFoldWinner(null);
      setBonusApplied(false);
    }
  };

  const handleSevenTwoAward = (bonus) => {
    if (hand && bonus) {
      pushHistory(hand);
      const bonusAwarded = awardPots(hand, {}, { bonuses: [bonus], holeCards });
      updateFrozenStacks(bonusAwarded);
      setHand(bonusAwarded);
    }
    setBonusApplied(true);
  };

  const handleSevenTwoSkip = () => {
    setBonusApplied(true);
  };

  const handleConfirmBombPot = ({ variant: bVariant, boardCount, anteAmount, immediate }) => {
    const patch = {
      bombPot: true,
      bombAmount: anteAmount,
      bombBoards: boardCount,
      doubleBoard: boardCount >= 2,
      variant: bVariant || 'plo6',
      baseVariant: hand?.baseVariant || hand?.variant || config?.variant || 'holdem',
      baseDoubleBoard: hand?.baseDoubleBoard !== undefined ? hand?.baseDoubleBoard : (hand?.doubleBoard ?? false),
    };
    if (immediate && hand) {
      const remaining = hand.players
        .filter((p) => p.status !== 'busted')
        .map((p) => {
          const restoredStack = p.initialStack != null
            ? p.initialStack
            : (Number(p.stack || 0) + Number(p.totalBet || 0));
          return {
            ...p,
            stack: restoredStack,
            currentBet: 0,
            totalBet: 0,
            status: 'active',
            lastAction: null,
            hasActed: false,
          };
        })
        .filter((p) => p.stack > 0);
      const nextButtonSeat = hand.buttonSeat || remaining[0]?.seat || 1;
      const bHand = startHand(
        {
          ...config,
          ...hand,
          players: remaining,
          ...patch,
        },
        nextButtonSeat,
        hand.handNumber || 1
      );
      setHand(bHand);
      setHoleCards({});
      setHistory([]);
      setRunTimesApplied(1);
      setRunTimesInput('2');
    } else {
      setHand((prev) => (prev ? { ...prev, nextHandBombPot: patch } : null));
    }
  };

  const handleApplyRunTimes = () => {
    const times = Math.max(1, Math.min(3, Number(runTimesInput) || 2));
    setRunTimesApplied(times);
    setHand((prev) => {
      if (!prev) return prev;
      const h = clone(prev);
      h.runTimes = times;
      h.doubleBoard = times >= 2;
      if (times >= 2 && (!h.boardB || !h.boardB.length)) {
        h.boardB = [{ hidden: true }, { hidden: true }, { hidden: true }];
      }
      if (times >= 3 && (!h.boardC || !h.boardC.length)) {
        h.boardC = [{ hidden: true }, { hidden: true }, { hidden: true }];
      }
      return h;
    });
  };

  const handleSaveTemporaryPlan = (newPlan) => {
    setHand((prev) => {
      if (!prev) return prev;
      const list = [...(prev.temporaryGames || []).filter((p) => p.id !== newPlan.id), newPlan];
      if (newPlan.scheduleType === 'this_hand') {
        return {
          ...prev,
          baseVariant: prev.baseVariant || prev.variant,
          baseDoubleBoard: prev.baseDoubleBoard !== undefined ? prev.baseDoubleBoard : (prev.doubleBoard ?? false),
          baseGameType: prev.baseGameType || prev.gameType || 'no_limit',
          baseBombPot: prev.baseBombPot !== undefined ? prev.baseBombPot : (prev.bombPot ?? false),
          baseBombBoards: prev.baseBombBoards || (prev.bombBoards || 1),
          baseSmallBlind: prev.baseSmallBlind !== undefined ? prev.baseSmallBlind : prev.smallBlind,
          baseBigBlind: prev.baseBigBlind !== undefined ? prev.baseBigBlind : prev.bigBlind,
          variant: newPlan.variant,
          gameType: newPlan.gameType || prev.gameType,
          smallBlind: newPlan.smallBlind ?? prev.smallBlind,
          bigBlind: newPlan.bigBlind ?? prev.bigBlind,
          doubleBoard: !!newPlan.doubleBoard,
          bombPot: !!newPlan.isBombPot,
          bombBoards: newPlan.bombBoards || (newPlan.doubleBoard ? 2 : 1),
          bombAmount: newPlan.bombAmount || prev.bombAmount || (newPlan.bigBlind ? newPlan.bigBlind * 5 : prev.bigBlind * 5),
          isTemporaryGame: true,
          temporaryGameTitle: newPlan.title,
          temporaryGames: list,
        };
      }
      return { ...prev, temporaryGames: list };
    });
  };

  const handleDeleteTemporaryPlan = (planId) => {
    setHand((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        temporaryGames: (prev.temporaryGames || []).filter((p) => p.id !== planId),
      };
    });
  };

  const handleRevertToBaseGame = () => {
    setHand((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        variant: prev.baseVariant || config?.variant || 'holdem',
        doubleBoard: prev.baseDoubleBoard !== undefined ? prev.baseDoubleBoard : Boolean(config?.doubleBoard),
        gameType: prev.baseGameType || config?.gameType || 'no_limit',
        bombPot: prev.baseBombPot !== undefined ? prev.baseBombPot : Boolean(config?.bombPot),
        bombBoards: prev.baseBombBoards || ((prev.baseDoubleBoard ?? config?.doubleBoard) ? 2 : 1),
        smallBlind: prev.baseSmallBlind !== undefined ? prev.baseSmallBlind : (config?.smallBlind ?? prev.smallBlind),
        bigBlind: prev.baseBigBlind !== undefined ? prev.baseBigBlind : (config?.bigBlind ?? prev.bigBlind),
        isTemporaryGame: false,
        temporaryGameTitle: null,
      };
    });
  };

  const proceedToNextHand = () => {
    if (hand && hand.phase === 'awarded') {
      updateFrozenStacks(hand);
      recordHand(hand);
    }
    let currentHand = hand;
    let nextBombPot = null;
    if (hand && hand.nextHandBombPot) {
      nextBombPot = hand.nextHandBombPot;
    }

    const nextHandNum = (currentHand?.handNumber || 1) + 1;
    const nextPlan = findPlanForHand(nextHandNum, currentHand?.temporaryGames || []);

    if (nextPlan) {
      currentHand = {
        ...currentHand,
        baseVariant: currentHand.baseVariant || currentHand.variant,
        baseDoubleBoard: currentHand.baseDoubleBoard !== undefined ? currentHand.baseDoubleBoard : Boolean(currentHand.doubleBoard),
        baseGameType: currentHand.baseGameType || currentHand.gameType || 'no_limit',
        baseBombPot: currentHand.baseBombPot !== undefined ? currentHand.baseBombPot : Boolean(currentHand.bombPot),
        baseBombBoards: currentHand.baseBombBoards || (currentHand.bombBoards || 1),
        baseSmallBlind: currentHand.baseSmallBlind !== undefined ? currentHand.baseSmallBlind : currentHand.smallBlind,
        baseBigBlind: currentHand.baseBigBlind !== undefined ? currentHand.baseBigBlind : currentHand.bigBlind,
        variant: nextPlan.variant,
        gameType: nextPlan.gameType || currentHand.gameType || 'no_limit',
        smallBlind: nextPlan.isBombPot ? 0 : (nextPlan.smallBlind ?? currentHand.smallBlind),
        bigBlind: nextPlan.isBombPot ? 0 : (nextPlan.bigBlind ?? currentHand.bigBlind),
        anteAmount: nextPlan.variant === 'short_deck' ? (nextPlan.anteAmount || 1) : currentHand.anteAmount,
        doubleBoard: !!nextPlan.doubleBoard,
        bombPot: !!nextPlan.isBombPot,
        bombBoards: nextPlan.bombBoards || (nextPlan.doubleBoard ? 2 : 1),
        bombAmount: nextPlan.bombAmount || currentHand.bombAmount || (nextPlan.bigBlind ? nextPlan.bigBlind * 5 : currentHand.bigBlind * 5),
        isTemporaryGame: true,
        temporaryGameTitle: nextPlan.title,
        temporaryGameId: nextPlan.id,
        runTimes: 1,
        runItSelected: null,
        boardB: [],
        boardC: [],
      };
    } else if (nextBombPot) {
      currentHand = {
        ...currentHand,
        nextHandBombPot: nextBombPot,
        runTimes: 1,
        runItSelected: null,
      };
    } else if (currentHand && (currentHand.bombPot || currentHand.isTemporaryGame)) {
      currentHand = {
        ...currentHand,
        bombPot: currentHand.baseBombPot !== undefined ? currentHand.baseBombPot : Boolean(config?.bombPot),
        doubleBoard: currentHand.baseDoubleBoard !== undefined ? currentHand.baseDoubleBoard : Boolean(config?.doubleBoard),
        boardB: [],
        boardC: [],
        bombBoards: currentHand.baseBombBoards || ((currentHand.baseDoubleBoard ?? config?.doubleBoard) ? 2 : 1),
        variant: currentHand.baseVariant || config?.variant || 'holdem',
        gameType: currentHand.baseGameType || config?.gameType || 'no_limit',
        smallBlind: currentHand.baseSmallBlind !== undefined ? currentHand.baseSmallBlind : (config?.smallBlind ?? currentHand.smallBlind),
        bigBlind: currentHand.baseBigBlind !== undefined ? currentHand.baseBigBlind : (config?.bigBlind ?? currentHand.bigBlind),
        isTemporaryGame: false,
        temporaryGameTitle: null,
        runTimes: 1,
        runItSelected: null,
      };
    } else if (currentHand) {
      currentHand = {
        ...currentHand,
        doubleBoard: currentHand.baseDoubleBoard !== undefined ? currentHand.baseDoubleBoard : Boolean(config?.doubleBoard),
        boardB: [],
        boardC: [],
        bombBoards: (currentHand.baseDoubleBoard ?? config?.doubleBoard) ? 2 : 1,
        runTimes: 1,
        runItSelected: null,
      };
    }
    const res = advanceToNextHand(currentHand);
    setHistory([]);
    if (res.gameOver) {
      setGameOver(res.remaining[0]);
      setHand(null);
    } else {
      const snap = {};
      res.hand.players.forEach((p) => {
        snap[p.seat] = p.initialStack != null ? p.initialStack : p.stack;
      });
      setFrozenStacks(snap);
      setHand(res.hand);
    }
    resetHoleCards();
    setBonusApplied(false);
    setSevenTwoFoldWinner(null);
    setRunTimesApplied(1);
    setRunTimesInput('2');
  };

  const handleEndHand = () => {
    if (!hand || hand.phase === 'awarded') return;
    const ended = endHand(hand);
    pushHistory(hand);
    const nf = ended.players.filter((p) => p.status !== 'folded');
    if (nf.length === 1) {
      const pots = computePots(ended.players, bbaPotOpts(ended));
      const winners = {};
      pots.forEach((pot, i) => { winners[i] = nf[0].id; });
      const awarded = awardPots(ended, winners, { holeCards });
      updateFrozenStacks(awarded);
      setHand(awarded);
      advanceAfterAward(awarded);
      return;
    }
    const w = tryAutoWinners(ended, holeCards);
    if (w) {
      const awarded = awardPots(ended, w.winnersA, { winnersB: w.winnersB, winnersC: w.winnersC, holeCards });
      updateFrozenStacks(awarded);
      setHand(awarded);
      advanceAfterAward(awarded);
    } else {
      updateFrozenStacks(ended);
      setHand(ended);
      setShowEnd(true);
    }
  };

  const handleAward = (winners, opts) => {
    pushHistory(hand);
    const awarded = awardPots(hand, winners, opts);
    updateFrozenStacks(awarded);
    setHand(awarded);
    setShowEnd(false);
    advanceAfterAward(awarded);
  };

  const handleAwardMysteryBounty = (amount) => {
    if (!hand || !hand.pendingMysteryBounties || !hand.pendingMysteryBounties.length) return;
    const item = hand.pendingMysteryBounties[0];
    const amt = Number(amount) || 0;
    const huntersCount = (item.hunterIds && item.hunterIds.length) || 1;
    const share = amt / huntersCount;

    setHand((prev) => {
      if (!prev) return prev;
      const updatedPlayers = prev.players.map((p) => {
        if (item.hunterIds && item.hunterIds.includes(p.id)) {
          return {
            ...p,
            bountiesCount: (p.bountiesCount || 0) + 1,
            bountyEarnings: (p.bountyEarnings || 0) + share,
          };
        }
        return p;
      });

      const updatedAwards = [
        ...(prev.bountyAwards || []),
        ...item.hunterIds.map((hid, idx) => ({
          victimId: item.victimId,
          victimName: item.victimName,
          hunterId: hid,
          hunterName: item.hunterNames[idx] || `Hunter ${hid}`,
          amount: share,
          isMystery: true,
          potIndex: item.potIndex,
        })),
      ];

      const winnerNames = item.hunterNames.join(' & ');
      const note = `Mystery Bounty: ${winnerNames} drew ${money(amt, prev.currency)} eliminating ${item.victimName}${huntersCount > 1 ? ` (${money(share, prev.currency)} each)` : ''}`;

      return {
        ...prev,
        players: updatedPlayers,
        bountyAwards: updatedAwards,
        pendingMysteryBounties: (prev.pendingMysteryBounties || []).slice(1),
        sideNotes: [...(prev.sideNotes || []), note],
      };
    });
  };

  const handleDismissMysteryBounty = () => {
    setHand((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pendingMysteryBounties: (prev.pendingMysteryBounties || []).slice(1),
      };
    });
  };

  const handleUndo = () => {
    if (!history.length) return;
    let prev = history[history.length - 1];
    const timerFields = [
      'tLevel', 'inBreak', 'levelStartEpoch', 'levelHandsCompleted',
      'pendingLevelIdx', 'pausedMs', 'pauseStart', 'pendingRace',
    ];
    const preserved = {};
    timerFields.forEach((f) => { if (hand && hand[f] !== undefined) preserved[f] = hand[f]; });

    // If undoing from awarded phase to fix a mistyped river card:
    if (hand && hand.phase === 'awarded') {
      const cCards = (prev.communityCards || []).filter((c) => !c.hidden);
      if (cCards.length >= 5) {
        prev = {
          ...prev,
          phase: 'playing',
          street: 'turn',
          communityCards: cCards.slice(0, 4),
          winners: null,
          pots: prev.pots ? prev.pots.map((p) => ({ ...p, winners: [] })) : prev.pots,
        };
      }
    }

    setHand({ ...prev, ...preserved });
    setHistory(history.slice(0, -1));
    setShowEnd(false);
    setEquity(null);
  };

  // Global Ctrl+Z / Cmd+Z Undo Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;
      if (isInput) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (history.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [history.length, hand]);

  const handleHoleChange = (pid, cards) => {
    setHoleCards((prev) => {
      const next = { ...prev };
      if (cards) next[pid] = cards; else delete next[pid];
      return next;
    });
  };

  const handlePickDiscard = (pid, idx) => setDiscards((prev) => ({ ...prev, [pid]: idx }));
  const handleConfirmDiscard = () => {
    const nf = hand.players.filter((p) => p.status !== 'folded');
    setHoleCards((prev) => {
      const next = {};
      nf.forEach((p) => {
        const cards = prev[p.id] || [];
        const di = discards[p.id];
        next[p.id] = di != null ? cards.filter((_, i) => i !== di) : cards;
      });
      return next;
    });
    setHand((prev) => ({ ...prev, cpDiscarded: true }));
    setDiscards({});
  };

  useEffect(() => {
    if (!hand || hand.phase === 'awarded') { setEquity(null); return; }
    const nf = hand.players.filter((p) => p.status !== 'folded');
    if (nf.length < 2 || !nf.some((p) => p.status === 'allin')) { setEquity(null); return; }
    if (hand.currentPlayer !== -1) { setEquity(null); return; }
    const variant = hand.variant || 'nlh';
    const meta = variantMeta(variant);
    const holes = nf.map((p) => holeCards[p.id]);
    if (holes.some((h) => !h || !holeCardsComplete(hand, h))) { setEquity(null); return; }
    const drawSize = holes[0].length;
    const t = setTimeout(() => {
      const iters = meta.group === 'omaha' ? (meta.holeSize <= 4 ? 5000 : 3000) : 20000;
      const byId = {};
      let splitPct = 0;
      const isMultiRun = Number(hand.runTimes) >= 2;
      const isTripleRun = Number(hand.runTimes) >= 3;
      const isTripleBomb = (Number(hand.bombBoards) >= 3) || (hand.boardC && hand.boardC.length > 0);

      if (isMultiRun) {
        // Multi-run (Run it 2x / 3x): Live equity is for the CURRENT BOARD ONLY!
        const cardsA = (hand.communityCards || []).filter((c) => c && !c.hidden);
        const cardsB = (hand.boardB || []).filter((c) => c && !c.hidden);
        const cardsC = (hand.boardC || []).filter((c) => c && !c.hidden);

        let activeBoard = cardsA;
        let deadCards = [];
        let currentBoardIndex = 1;

        if (cardsA.length < 5) {
          activeBoard = cardsA;
          deadCards = [];
          currentBoardIndex = 1;
        } else if (cardsB.length < 5) {
          activeBoard = cardsB;
          deadCards = cardsA;
          currentBoardIndex = 2;
        } else if (isTripleRun && cardsC.length < 5) {
          activeBoard = cardsC;
          deadCards = [...cardsA, ...cardsB];
          currentBoardIndex = 3;
        } else {
          // All boards complete: Show final board win percentages at the end!
          const boardWinPcts = getMultipleBoardWinPercentages(hand, holeCards);
          if (boardWinPcts) {
            setEquity({ byId: boardWinPcts, split: 0, currentBoardIndex: 'final', isFinal: true });
            return;
          }
          activeBoard = isTripleRun ? cardsC : cardsB;
        }

        const res = calcEquity(holes, activeBoard, iters, variant, drawSize, deadCards);
        nf.forEach((p, i) => { byId[p.id] = res.results[i].win; });
        splitPct = res.split;
        setEquity({ byId, split: splitPct, currentBoardIndex, isFinal: false });
      } else if (isTripleBomb) {
        const resA = calcEquity(holes, hand.communityCards, iters, variant, drawSize);
        const resB = calcEquity(holes, hand.boardB || [], iters, variant, drawSize);
        const resC = calcEquity(holes, hand.boardC || [], iters, variant, drawSize);
        nf.forEach((p, i) => { byId[p.id] = (resA.results[i].win + resB.results[i].win + resC.results[i].win) / 3; });
        splitPct = (resA.split + resB.split + resC.split) / 3;
        setEquity({ byId, split: splitPct });
      } else if (hand.doubleBoard) {
        const resA = calcEquity(holes, hand.communityCards, iters, variant, drawSize);
        const resB = calcEquity(holes, hand.boardB || [], iters, variant, drawSize);
        nf.forEach((p, i) => { byId[p.id] = (resA.results[i].win + resB.results[i].win) / 2; });
        splitPct = (resA.split + resB.split) / 2;
        setEquity({ byId, split: splitPct });
      } else {
        const res = calcEquity(holes, hand.communityCards, iters, variant, drawSize);
        nf.forEach((p, i) => { byId[p.id] = res.results[i].win; });
        splitPct = res.split;
        setEquity({ byId, split: splitPct });
      }
    }, 20);
    return () => clearTimeout(t);
  }, [hand, holeCards]);

  useEffect(() => {
    if (!hand || hand.mode !== 'tournament') return;
    if (hand.phase !== 'playing') return;
    if (hand.inBreak) return;
    if (hand.actionHistory && hand.actionHistory.length > 0) return;
    const sched = hand.blindSchedule || [];
    if (!sched.length) return;
    const target = hand.pendingLevelIdx ?? hand.tLevel ?? 0;
    let idx = target;
    while (idx < sched.length && (sched[idx]?.type === 'break' || sched[idx]?.type === 'color_up')) idx++;
    if (idx >= sched.length) return;
    if (idx === (hand.blindLevel || 0)) return;
    const lvl = sched[idx];
    if (!lvl || lvl.type === 'break' || lvl.type === 'color_up') return;
    const bbVal = parseAmount(lvl.bigBlind) ?? Number(lvl.bigBlind) ?? 0;
    const sbVal = parseAmount(lvl.smallBlind) ?? Number(lvl.smallBlind) ?? 0;
    if (bbVal <= 0 || sbVal <= 0) return;
    const ante = calcAnteForType(hand.anteType, bbVal, lvl.ante);
    const newSB = sbVal;
    const newBB = bbVal;
    if (newSB === hand.smallBlind && newBB === hand.bigBlind && ante === hand.anteAmount) return;
    setHand(recomputeBlindsForLevel(hand, newSB, newBB, ante));
  }, [hand]);

  useEffect(() => {
    if (!hand || hand.phase === 'awarded') return;
    if (hand.currentPlayer !== -1) return;
    if (hand._refundsApplied) return;
    const nf = hand.players.filter((p) => p.status !== 'folded');
    if (!nf.some((p) => p.status === 'allin')) return;
    setHand(refundUncontestedPots(hand));
  }, [hand]);

  useEffect(() => {
    if (!hand || hand.phase === 'awarded') return;
    if (hand.currentPlayer !== -1) return;
    const nf = hand.players.filter((p) => p.status !== 'folded');
    if (nf.length < 2) return;
    const w = tryAutoWinners(hand, holeCards);
    if (!w) return;
    pushHistory(hand);
    const awarded = awardPots(hand, w.winnersA, { winnersB: w.winnersB, winnersC: w.winnersC, holeCards });
    updateFrozenStacks(awarded);
    setHand(awarded);
    if (sevenTwoActive(awarded)) {
      const q = sevenTwoQualifyingWinner(awarded);
      if (q) {
        setHand(awardPots(awarded, {}, { bonuses: [q], holeCards }));
        setBonusApplied(true);
      }
    }
  }, [hand, holeCards]);

  useEffect(() => {
    if (!hand || hand.phase !== 'playing') return;
    if (hand.currentPlayer < 0) return;
    const cp = hand.players[hand.currentPlayer];
    if (!cp || cp.status !== 'active') return;
    const oot = Array.isArray(hand.ootActions) && hand.ootActions.find((o) => o.playerId === cp.id && o.street === hand.street);
    if (!oot) return;
    if (oot.kind === 'passive') {
      const toCall = hand.currentBet - cp.currentBet;
      if (toCall === 0 || cp.stack >= toCall) {
        const type = toCall === 0 ? 'check' : 'call';
        const t = setTimeout(() => {
          pushHistory(hand);
          setHand(applyAction(hand, hand.currentPlayer, type));
        }, 350);
        return () => clearTimeout(t);
      }
      return;
    }
    if (oot.kind === 'aggressive' && oot.amount && Number(oot.amount) > 0) {
      const amt = Number(oot.amount);
      const minRaise = hand.currentBet === 0
        ? hand.bigBlind
        : (hand.street === 'preflop' && (!hand.raiseLevel || hand.raiseLevel <= 1))
        ? Math.max(hand.currentBet * 2, hand.currentBet + (hand.lastRaiseAmount || hand.bigBlind))
        : hand.currentBet + (hand.lastRaiseAmount || hand.bigBlind);
      if (amt >= minRaise && amt <= cp.currentBet + cp.stack) {
        const t = setTimeout(() => {
          pushHistory(hand);
          setHand(applyAction(hand, hand.currentPlayer, hand.currentBet > 0 ? 'raise' : 'bet', amt));
        }, 350);
        return () => clearTimeout(t);
      }
    }
  }, [hand]);

  const handleBlindLevel = (sb, bb, ante) => {
    pushHistory(hand);
    setHand((prev) => {
      const sched = Array.isArray(prev.blindSchedule) ? prev.blindSchedule.slice() : [];
      const atLast = !sched.length || (prev.blindLevel || 0) >= sched.length - 1;
      if (atLast) {
        sched.push({
          type: 'level',
          smallBlind: sb,
          bigBlind: bb,
          ante: calcAnteForType(prev.anteType, bb, ante),
        });
        return { ...prev, blindSchedule: sched };
      }
      const levelIdx = Math.min((prev.blindLevel || 0) + 1, sched.length - 1);
      return {
        ...prev,
        blindSchedule: sched,
        smallBlind: sb, bigBlind: bb, anteAmount: ante, blindLevel: levelIdx,
        tLevel: levelIdx,
        pendingLevelIdx: levelIdx,
        inBreak: false,
        levelStartEpoch: Date.now(),
        levelHandsCompleted: 0,
      };
    });
  };

  const handleChipRace = (adjustments) => {
    pushHistory(hand);
    setHand((prev) => {
      const players = prev.players.map((p) => ({
        ...p,
        stack: Math.max(0, p.stack + (adjustments[p.id] || 0)),
      }));
      const remaining = (prev.pendingMissedRaces || []).slice(1);
      const schedule = prev.blindSchedule || [];
      let nextIdx = (prev.tLevel || 0) + 1;
      while (nextIdx < schedule.length && (schedule[nextIdx]?.type === 'break' || schedule[nextIdx]?.type === 'color_up')) nextIdx++;
      const nextLevel = schedule[nextIdx];
      const isStandaloneRace = !prev.inBreak;

      const base = {
        ...prev,
        players,
        pendingRace: null,
        pendingMissedRaces: remaining.length > 0 ? remaining : null,
      };

      if (isStandaloneRace) {
        base.pauseStart = null;
        base.tLevel = nextIdx < schedule.length ? nextIdx : prev.tLevel;
        base.pendingLevelIdx = nextIdx < schedule.length ? nextIdx : prev.tLevel;
        base.levelStartEpoch = Date.now();
        base.levelHandsCompleted = 0;
        if (nextLevel && nextLevel.type !== 'break' && nextLevel.type !== 'color_up') {
          const nextBB = parseAmount(nextLevel.bigBlind) ?? Number(nextLevel.bigBlind) ?? 0;
          const nextSB = parseAmount(nextLevel.smallBlind) ?? Number(nextLevel.smallBlind) ?? 0;
          const ante = calcAnteForType(prev.anteType, nextBB, nextLevel.ante);
          base.smallBlind = nextSB;
          base.bigBlind = nextBB;
          base.anteAmount = ante;
          base.blindLevel = nextIdx;
        }
      }
      return base;
    });
    setShowRaceOverride(null);
  };

  const handlePauseTimer = () => {
    setHand((prev) => pauseLevelTimer(prev));
    setNow(Date.now());
  };
  const handleResumeTimer = () => {
    setHand((prev) => resumeLevelTimer(prev));
    setNow(Date.now());
  };
  const timerPaused = !!hand?.pauseStart;

  const handleNudgeTimer = (deltaMs) => {
    setHand((prev) => nudgeLevelTimer(prev, deltaMs));
    setNow(Date.now());
  };
  const timerCanNudge = hand?.mode === 'tournament' && (hand?.levelConfig?.method || 'minutes') === 'minutes';

  const handleResumeFromBreak = () => {
    setShowBreak(false);
    setHand((prev) => {
      if (!prev.inBreak && (prev.pendingMissedRaces || []).length > 0) {
        return resumeLevelTimer({ ...prev, pendingMissedRaces: null, pendingRace: null });
      }
      const schedule = prev.blindSchedule || [];
      let nextIdx = (prev.tLevel || 0) + 1;
      while (nextIdx < schedule.length && (schedule[nextIdx]?.type === 'break' || schedule[nextIdx]?.type === 'color_up')) nextIdx++;
      const nextLevel = schedule[nextIdx];
      const base = {
        ...prev,
        inBreak: false,
        pauseStart: null,
        tLevel: nextIdx < schedule.length ? nextIdx : (prev.tLevel || 0) + 1,
        pendingLevelIdx: nextIdx < schedule.length ? nextIdx : (prev.tLevel || 0) + 1,
        levelStartEpoch: Date.now(),
        levelHandsCompleted: 0,
        pendingRace: null,
      };
      if (nextLevel && nextLevel.type !== 'break' && nextLevel.type !== 'color_up') {
        const nextBB = parseAmount(nextLevel.bigBlind) ?? Number(nextLevel.bigBlind) ?? 0;
        const nextSB = parseAmount(nextLevel.smallBlind) ?? Number(nextLevel.smallBlind) ?? 0;
        const ante = calcAnteForType(prev.anteType, nextBB, nextLevel.ante);
        base.smallBlind = nextSB;
        base.bigBlind = nextBB;
        base.anteAmount = ante;
        base.blindLevel = nextIdx;
      }
      return base.blindsPosted === false ? postBlinds(base) : base;
    });
  };

  const handleNextLevelClick = () => {
    const sched = hand.blindSchedule;
    const atLast = !sched?.length || (hand.blindLevel || 0) >= sched.length - 1;
    setPreplannerLevel(atLast);
    if (sched?.length && !atLast) {
      const nextIdx = Math.min((hand.blindLevel || 0) + 1, sched.length - 1);
      const lvl = sched[nextIdx];
      setBlindsPrefill({
        smallBlind: lvl.smallBlind,
        bigBlind: lvl.bigBlind,
        anteAmount: calcAnteForType(hand.anteType, lvl.bigBlind, lvl.ante),
      });
    } else {
      const suggestion = suggestNextBlinds(sched || [], hand.chipDenominations || []);
      setBlindsPrefill({
        smallBlind: suggestion.smallBlind,
        bigBlind: suggestion.bigBlind,
        anteAmount: calcAnteForType(hand.anteType, suggestion.bigBlind, 0),
      });
    }
    setShowBlinds(true);
  };

  const handleSetLevel = ({ tLevel, inBreak, isColorUp, levelStartEpoch, levelHandsCompleted, pendingLevelIdx, missedRaces, pendingRace }) => {
    setHand((prev) => {
      const schedule = prev.blindSchedule || [];
      let targetIdx = pendingLevelIdx;
      while (targetIdx < schedule.length && (schedule[targetIdx]?.type === 'break' || schedule[targetIdx]?.type === 'color_up')) targetIdx++;
      const targetLevel = schedule[targetIdx];
      const noAction = !(prev.actionHistory && prev.actionHistory.length > 0);
      const isPaused = (missedRaces && missedRaces.length > 0) || isColorUp;
      const base = {
        ...prev,
        tLevel,
        inBreak,
        isColorUp: !!isColorUp,
        levelStartEpoch,
        levelHandsCompleted,
        pendingLevelIdx: targetIdx,
        pauseStart: isPaused ? Date.now() : null,
        pausedMs: isPaused ? 0 : prev.pausedMs,
      };
      if (pendingRace) {
        base.pendingRace = pendingRace;
      }
      if (missedRaces && missedRaces.length > 0) {
        base.pendingMissedRaces = missedRaces;
      }
      if (inBreak && !base.pendingRace) {
        const brk = schedule[tLevel];
        const rc = brk?.race;
        const retiredNum = parseAmount(rc?.retired) ?? Number(rc?.retired);
        const replacementNum = parseAmount(rc?.replacement) ?? Number(rc?.replacement);
        if (rc && retiredNum > 0 && replacementNum > 0) {
          base.pendingRace = { ...rc, retired: retiredNum, replacement: replacementNum, tLevel };
        }
      }
      if (noAction && !inBreak && targetLevel && targetLevel.type !== 'break' && targetLevel.type !== 'color_up') {
        const targetBB = parseAmount(targetLevel.bigBlind) ?? Number(targetLevel.bigBlind) ?? 0;
        const targetSB = parseAmount(targetLevel.smallBlind) ?? Number(targetLevel.smallBlind) ?? 0;
        const ante = calcAnteForType(prev.anteType, targetBB, targetLevel.ante);
        base.smallBlind = targetSB;
        base.bigBlind = targetBB;
        base.anteAmount = ante;
        base.blindLevel = targetIdx;
        return recomputeBlindsForLevel(base, targetSB, targetBB, ante);
      }
      return base;
    });
    setNow(Date.now());
  };

  const handleRebuy = (pid, amt, isAddOn = false) => {
    setHand((prev) => {
      const updatedPlayers = (prev.players || []).map((p) => {
        if (p.id === pid) {
          return {
            ...p,
            rebuys: isAddOn ? (p.rebuys || 0) : ((p.rebuys || 0) + 1),
            addOns: isAddOn ? ((p.addOns || 0) + 1) : (p.addOns || 0),
          };
        }
        return p;
      });
      return {
        ...prev,
        players: updatedPlayers,
        pendingAdjust: { ...(prev.pendingAdjust || {}), [pid]: ((prev.pendingAdjust || {})[pid] || 0) + amt },
      };
    });
  };

  const handleLateEntry = (nm, stk, seat, leftOfPlayerId) => {
    setHand((prev) => {
      let finalSeat = seat ? Number(seat) : null;
      if (!finalSeat && leftOfPlayerId != null) {
        const targetIdx = prev.players.findIndex((p) => p.id === leftOfPlayerId || p.seat === leftOfPlayerId);
        if (targetIdx >= 0) {
          finalSeat = prev.players[targetIdx].seat + 0.5;
        }
      }
      if (!finalSeat) {
        const occupied = new Set(prev.players.map((p) => p.seat));
        for (let s = 1; s <= 20; s++) {
          if (!occupied.has(s)) { finalSeat = s; break; }
        }
      }
      const name = nm || `Player ${Math.floor(finalSeat)}`;
      return { ...prev, pendingPlayers: [...(prev.pendingPlayers || []), { name, seat: finalSeat, stack: stk }] };
    });
    setShowLateEntry(false);
  };

  const handleReentry = (name, seat) => {
    setHand((prev) => {
      const stk = prev.startingStack || 100 * prev.bigBlind;
      const elim = (prev.eliminatedPlayers || []).find((e) => e.name === name);
      const newReentries = (elim?.reentries || 0) + 1;
      return {
        ...prev,
        pendingPlayers: [...(prev.pendingPlayers || []), { name, seat, stack: stk, reentries: newReentries }],
      };
    });
    setShowReentry(false);
  };

  const handleResume = () => {
    const saved = savedSession;
    if (!saved) return;
    if (saved.director) {
      mttStore.loadTournament(saved.director);
      navigate('/director');
      return;
    }
    if (!saved.hand) return;
    const cfg = saved.config || null;
    setConfig(cfg);
    const restoredHand = saved.hand.levelConfig ? saved.hand : { ...saved.hand, levelConfig: cfg?.levelConfig || undefined, levelStartEpoch: saved.hand.levelStartEpoch || Date.now(), levelHandsCompleted: saved.hand.levelHandsCompleted || 0, levelCount: saved.hand.levelCount || Math.max(1, (saved.hand.players || []).length) };
    setHand(restoredHand);
    setGameOver(saved.gameOver || null);
    setHoleCards(saved.holeCards || {});
    setDiscards({});
    setHistory([]);
    const resumeFrozen = {};
    (restoredHand.players || []).forEach((p) => { resumeFrozen[p.seat] = p.stack; });
    setFrozenStacks(resumeFrozen);
    sessionStore.set({ config: cfg, hand: saved.hand, gameOver: saved.gameOver || null });
    setSavedSession(null);
  };

  const handleResumeFromCode = async (code) => {
    if (code && code !== getShareCode()) setShareCode(code);
    const target = code || getShareCode();
    if (!target) return;
    try {
      const res = await loadSavedSession(target);
      if (!res) return;
      if (res.saved?.director) {
        mttStore.loadTournament(res.saved.director);
        navigate(`/director?code=${encodeURIComponent(target)}`);
        return;
      }
      const cfg = res.saved.config || null;
      setConfig(cfg);
      const restoredHand = res.saved.hand?.levelConfig ? res.saved.hand : { ...res.saved.hand, levelConfig: cfg?.levelConfig || undefined, levelStartEpoch: res.saved.hand?.levelStartEpoch || Date.now(), levelHandsCompleted: res.saved.hand?.levelHandsCompleted || 0, levelCount: res.saved.hand?.levelCount || Math.max(1, (res.saved.hand?.players || []).length) };
      setHand(restoredHand);
      setGameOver(res.saved.gameOver || null);
      setHoleCards(res.saved.holeCards || {});
      setDiscards({});
      setHistory([]);
      const resumeFrozen = {};
      (restoredHand.players || []).forEach((p) => { resumeFrozen[p.seat] = p.stack; });
      setFrozenStacks(resumeFrozen);
      sessionStore.set({ config: cfg, hand: restoredHand, gameOver: res.saved.gameOver || null });
      setSavedSession(null);
      setResumeChecked(true);
    } catch { /* ignored */ }
  };

  const handleSaveSession = () => {
    saveNow({ config, hand, gameOver, equity, hideAmounts, holeCards });
  };

  const handleDismissSavedGuest = async () => {
    setSavedSession(null);
    setSavedUpdatedAt(null);
    setResumeChecked(true);
    try {
      await discardSavedSession();
    } catch {}
    try {
      localStorage.removeItem('poker-live-state');
      localStorage.removeItem('poker-live-share-code');
      const raw = localStorage.getItem('poker_saved_sessions_store');
      if (raw) {
        const store = JSON.parse(raw);
        const filtered = {};
        Object.entries(store).forEach(([k, v]) => {
          if (v && v.hostId) filtered[k] = v;
        });
        localStorage.setItem('poker_saved_sessions_store', JSON.stringify(filtered));
      }
    } catch {}
    handleNewSession();
  };

  const handleNewSession = () => {
    setSavedSession(null);
    setSavedUpdatedAt(null);
    setResumeChecked(true);
    recordedHandNumbers.current.clear();
    sessionStore.reset();
    setConfig(null);
    setHand(null);
    setHistory([]);
    setGameOver(null);
    setShowSetup(true);
    resetHoleCards();
    setBonusApplied(false);
    setSevenTwoFoldWinner(null);
    setFrozenStacks({});
    setFreezeStacks(true);
  };

  const handleEndSessionSave = async () => {
    setEndingSession(true);
    try {
      await saveNow({ config, hand, gameOver, equity, hideAmounts, holeCards });
    } finally { setEndingSession(false); }
    setShowEndSession(false);
    resetToStart();
  };

  const handleEndSessionDiscard = async () => {
    setEndingSession(true);
    try {
      await discardSavedSession();
    } finally { setEndingSession(false); }
    setShowEndSession(false);
    resetToStart();
  };

  const resetToStart = () => {
    sessionStore.reset();
    recordedHandNumbers.current.clear();
    setConfig(null);
    setHand(null);
    setHistory([]);
    setGameOver(null);
    resetHoleCards();
    setBonusApplied(false);
    setSevenTwoFoldWinner(null);
    setSavedSession(null);
    setResumeChecked(false);
    setShowSetup(false);
    setFrozenStacks({});
    setFreezeStacks(true);
  };

  const variant = hand?.variant || 'nlh';
  const nonFolded = hand ? hand.players.filter((p) => p.status !== 'folded') : [];
  const activeCount = nonFolded.filter((p) => p.status === 'active').length;
  const showBreakdown = !hand || hand.phase !== 'playing' || (activeCount <= 1 && hand.currentPlayer === -1);
  let pots = [];
  let sidePots = [];
  let mainPot = 0;
  if (hand) {
    if (hand.phase === 'awarded' && hand.pots?.length) {
      pots = hand.pots; sidePots = pots.slice(1); mainPot = pots[0]?.amount ?? 0;
    } else if (showBreakdown) {
      pots = computePots(hand.players, bbaPotOpts(hand)); sidePots = pots.slice(1); mainPot = pots[0]?.amount ?? 0;
    } else {
      sidePots = []; mainPot = potTotal(hand);
    }
  }

  const activeWithChips = nonFolded.filter((p) => p.status !== 'allin' && p.stack > 0).length;
  const frozen = hand ? bettingFrozen(hand) : false;
  const isAllInAllPlayers = nonFolded.length >= 2 && frozen;
  const isRiverEnd = hand?.street === 'river' && (hand.currentPlayer === -1 || frozen);
  const showHoleEntry = hand && hand.phase !== 'awarded' && nonFolded.length >= 2 && (
    hand.phase === 'ended' ||
    (hand.currentPlayer === -1 && (isAllInAllPlayers || isRiverEnd)) ||
    (frozen && isAllInAllPlayers)
  );
  const showDiscardStep = hand && hand.variant === 'crazy_pineapple' && hand.cpNeedsDiscard && !hand.cpDiscarded && hand.currentPlayer === -1 && hand.phase !== 'awarded' && hand.communityCards.length >= 3 && nonFolded.length >= 2 && nonFolded.every((p) => holeCards[p.id] && holeCards[p.id].length === 3);
  const isCash = hand?.mode === 'cash';
  const lowGame = variantMeta(variant).group === 'low';

  const { highlightKeys, winningPlayerIds } = useMemo(() => {
    const keys = new Set();
    const winIds = new Set();
    if (!hand) return { highlightKeys: null, winningPlayerIds: winIds };

    if (hand.phase === 'awarded' && hand.winners) {
      hand.winners.forEach((w) => {
        winIds.add(w.playerId);
        const hole = holeCards[w.playerId];
        if (!hole) return;
        const board = w.board === 'b' ? (hand.boardB || []) : hand.communityCards;
        const cards = winningHandCards(hole, board, hand.variant);
        if (cards) cards.forEach((c) => keys.add(c.rank + c.suit));
      });
    } else {
      const auto = tryAutoWinners(hand, holeCards);
      if (auto && auto.winnersA) {
        Object.values(auto.winnersA).flat().forEach((pid) => {
          winIds.add(pid);
          const hole = holeCards[pid];
          if (!hole) return;
          const cards = winningHandCards(hole, hand.communityCards, hand.variant);
          if (cards) cards.forEach((c) => keys.add(c.rank + c.suit));
        });
        if (auto.winnersB) {
          Object.values(auto.winnersB).flat().forEach((pid) => {
            winIds.add(pid);
            const hole = holeCards[pid];
            if (!hole) return;
            const cards = winningHandCards(hole, hand.boardB || [], hand.variant);
            if (cards) cards.forEach((c) => keys.add(c.rank + c.suit));
          });
        }
      }
    }
    return {
      highlightKeys: keys.size ? keys : null,
      winningPlayerIds: winIds,
    };
  }, [hand, holeCards]);

  const activeSideGames = (() => {
    if (!hand) return [];
    const out = [];
    const sg = hand.sideGames || {};
    if (hand.mode === 'cash') {
      if (sg.killPot) out.push('Kill');
      if (sg.halfKill) out.push('Half-kill');
      if (hand.bombPot) out.push('Bomb');
      if (sg.sevenTwo) out.push('7-2');
      if (sg.standUp) out.push('Stand up');
    } else {
      if (sg.bounty || hand.bountyConfig?.bounty) out.push('Bounty');
      if (sg.mysteryBounty || hand.bountyConfig?.mysteryBounty) out.push('Mystery');
    }
    return out;
  })();

  if (gameOver) {
    return <GameOverScreen gameOver={gameOver} isCash={isCash} onNewSession={handleNewSession} />;
  }

  if (!hand) {
    if (!resumeChecked && !isAuthenticated) {
      return (
        <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
          <div className="w-8 h-8 border-4 border-[#2a2f37] border-t-slate-400 rounded-full animate-spin" />
        </div>
      );
    }
    if (showSetup) {
      return <SetupDialog initial={config} onSave={handleSave} onClose={() => setShowSetup(false)} />;
    }
    return (
      <StartScreen
        savedGuestSession={isAuthenticated ? null : savedSession}
        savedGuestUpdatedAt={savedUpdatedAt}
        onNewSession={handleNewSession}
        onResumeSession={isAuthenticated ? handleResumeFromCode : () => handleResume()}
        onDismissGuest={handleDismissSavedGuest}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] text-white">
      {isCompactMode ? (
        <div className="max-w-2xl mx-auto p-2 sm:p-4">
          <CompactModeView
            hand={hand}
            onAction={handleAction}
            onUndo={handleUndo}
            canUndo={history.length > 0}
            onExitCompact={() => setIsCompactMode(false)}
            hideAmounts={hideAmounts}
            onToggleHideAmounts={() => setHideAmounts((v) => !v)}
            onDeal={handleDeal}
            onDealBoard={handleDealBoard}
            onFillBoard={handleFillBoard}
            onDealHidden={handleDealHidden}
            onRunIt={handleRunIt}
            onNextHand={proceedToNextHand}
            now={now}
            actionClockSecondsLeft={actionClockSecondsLeft}
            actionClockType={actionClockType}
            handleCallClock={handleCallClock}
            onEndHand={handleEndHand}
            holeCards={holeCards}
            onHoleChange={handleHoleChange}
            equity={equity}
            onSetBoardCards={handleSetBoardCards}
            onOpenTempGameModal={() => setShowTempGameModal(true)}
          />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
          {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{formatSessionName(hand)}</h1>
            <span className="text-xs text-slate-500 uppercase">{GAME_TYPES[hand.gameType] || 'No Limit'}{hand.doubleBoard ? ' · Double board' : ''}{hand.bombPot ? ' · Bomb pot' : ''}</span>
            {hand.blindSchedule?.length > 0 && (
              <span className="text-xs text-slate-400">
                Level {scheduledLevelNumber(hand)}{hand.inBreak ? ' · Break' : ''}
              </span>
            )}
            {levelTimerState(hand, now).active && (() => {
              const st = levelTimerState(hand, now);
              const label = formatTimerLabel(st);
              return (
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg border ${
                  st.expired
                    ? 'bg-[#3a2020] border-[#c94c4c] text-rose-300'
                    : st.method === 'minutes' && (st.remainingMs || 0) <= 60000
                    ? 'bg-[#3a3320] border-[#8a7a3a] text-amber-300'
                    : 'bg-[#1e2a1e] border-[#4a5a4a] text-emerald-300'
                }`}>
                  {st.expired ? 'Level time' : 'Next level'}
                  <span className="ml-1.5 font-mono text-sm">{formatTimer(st)} {label}</span>
                </span>
              );
            })()}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsCompactMode(true)}
              className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm px-3 py-2 flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              title="Switch to Compact Mode (mobile-optimized, direct action buttons & keyboard shortcuts)"
            >
              <Minimize2 size={16} /> Compact Mode
            </button>
            <button onClick={handleUndo} disabled={!history.length} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer">
              <Undo2 size={16} /> Undo
            </button>
            <button onClick={() => setHideAmounts((v) => !v)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 flex items-center gap-1 cursor-pointer">
              {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />} {hideAmounts ? 'Show' : 'Hide'} amounts
            </button>
            <a href="/tv" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-sm px-3 py-2">TV view ↗</a>
            <button onClick={() => setShowShare(true)} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-sm px-3 py-2 flex items-center gap-1 cursor-pointer">
              <Share2 size={16} /> Share
            </button>
            <button onClick={handleSaveSession} disabled={saveStatus.saving} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-sm px-3 py-2 flex items-center gap-1 disabled:opacity-60 cursor-pointer">
              <Save size={16} /> {saveStatus.saving ? 'Saving…' : 'Save session'}
            </button>
            <Link to="/history" className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2">Hand history</Link>
            {isCash && (
              <Link to="/variant" className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2">Variant & side games</Link>
            )}
            {isCash && (
              <button
                type="button"
                onClick={() => setShowTempGameModal(true)}
                className={`rounded-lg text-sm px-3 py-2 font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors shadow ${
                  hand?.isTemporaryGame
                    ? 'bg-amber-950/80 border-amber-500 text-amber-200 animate-pulse'
                    : (hand?.temporaryGames || []).length > 0
                    ? 'bg-amber-950/40 border-amber-600/60 text-amber-300 hover:bg-amber-900/60'
                    : 'bg-[#2a2f37] hover:bg-[#363c45] text-slate-200 border-slate-700'
                }`}
                title="Temporarily change game or schedule temporary games (e.g. PLO6 Bomb pot every 5 hands)"
              >
                <Zap size={15} className="text-amber-400" />
                <span>Temp Game</span>
                {(hand?.temporaryGames || []).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-black font-mono">
                    {(hand?.temporaryGames || []).length}
                  </span>
                )}
              </button>
            )}
            {isCash && (
              <>
                <button onClick={() => setShowRebuy(true)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer">Rebuy / Cash out</button>
                <button onClick={() => setShowLateEntry(true)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer flex items-center gap-1.5">
                  <UserPlus size={15} className="text-emerald-400" />
                  Add player
                </button>
                <button
                  onClick={() => setShowBombPotModal(true)}
                  className="rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700/60 font-semibold text-sm px-3 py-2 cursor-pointer flex items-center gap-1.5 shadow"
                >
                  💣 Bomb pot
                </button>
              </>
            )}
            {!isCash && hand?.lateRegEnabled && (
              <button
                onClick={() => setShowLateEntry(true)}
                disabled={(hand.blindLevel || 0) + 1 > (hand.lateRegLevel || 0)}
                className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Late reg
              </button>
            )}
            {!isCash && hand?.tournamentFormat === 'reentry' && (
              <button
                onClick={() => setShowReentry(true)}
                disabled={!(hand.eliminatedPlayers || []).length}
                className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Re-entry
              </button>
            )}
            {!isCash && hand?.tournamentFormat === 'rebuy' && (
              <button
                onClick={() => setShowRebuy(true)}
                className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer"
              >
                Rebuy
              </button>
            )}
            <button onClick={() => setShowSetup(true)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer">
              Structure setup
            </button>
            {/* Clock system control button */}
            {!isCash && (hand?.clockConfig?.clockSystem === 'time_banks' ? (
              <button
                onClick={() => setShotClockEnabled((v) => !v)}
                className={`rounded-lg text-sm px-3 py-2 cursor-pointer flex items-center gap-1.5 transition-colors ${
                  shotClockEnabled
                    ? 'bg-amber-800 border border-amber-500 text-white shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#2a2f37] hover:bg-[#363c45] text-slate-300'
                }`}
                title="Turn on/off shot clock"
              >
                <Clock size={15} />
                Shot clock {shotClockEnabled ? 'ON' : 'OFF'}
              </button>
            ) : (
              <button
                onClick={handleCallClock}
                disabled={!hand || hand.phase !== 'playing' || hand.currentPlayer < 0}
                className={`rounded-lg text-sm px-3 py-2 cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  calledClockActive
                    ? 'bg-rose-800 border border-rose-500 text-white animate-pulse'
                    : 'bg-[#2a2f37] hover:bg-[#363c45] text-slate-300'
                }`}
                title="Call clock on active player"
              >
                <Clock size={15} />
                {calledClockActive ? `Clock: ${actionClockSecondsLeft}s` : 'Call clock'}
              </button>
            ))}
            {!isCash && (
              <button
                onClick={handleNextLevelClick}
                className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer"
              >
                {hand?.blindSchedule?.length && (hand.blindLevel || 0) >= hand.blindSchedule.length - 1 ? 'Pre-plan next' : 'Next level'}
              </button>
            )}
            {!isCash && hand?.blindSchedule?.length > 0 && (
              <button onClick={() => setShowSetLevel(true)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer">
                Set level
              </button>
            )}
            {!isCash && (
              <>
                {timerPaused ? (
                  <button onClick={handleResumeTimer} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-sm px-3 py-2 cursor-pointer">
                    Resume timer
                  </button>
                ) : (
                  <button onClick={handlePauseTimer} disabled={hand.levelConfig?.method !== 'minutes'} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    Pause timer
                  </button>
                )}
                <button onClick={() => handleNudgeTimer(60000)} disabled={!timerCanNudge} title="Rewind 1m" className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 disabled:opacity-40 cursor-pointer flex items-center gap-1">
                  <Rewind size={14} /> 1m
                </button>
                <button onClick={() => handleNudgeTimer(-60000)} disabled={!timerCanNudge} title="Forward 1m" className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 disabled:opacity-40 cursor-pointer flex items-center gap-1">
                  <FastForward size={14} /> 1m
                </button>
              </>
            )}
            <button onClick={handleEndHand} className="rounded-lg bg-[#c94c4c] hover:bg-[#d95959] text-sm px-3 py-2 cursor-pointer">
              End hand
            </button>
            <button onClick={() => setShowEndSession(true)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 flex items-center gap-1 cursor-pointer">
              <Power size={16} /> End session
            </button>
          </div>
        </div>

        {/* Break banner */}
        {hand.inBreak && (() => {
          const brk = (hand.blindSchedule || [])[hand.tLevel];
          const hasRace = !!(brk && brk.race && Number(brk.race.retired) > 0 && Number(brk.race.replacement) > 0);
          return (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#6b5a2a] bg-[#3a3320] px-4 py-3">
              <span className="text-sm font-semibold text-amber-200">Break</span>
              <span className="text-sm font-mono text-amber-300">{formatTimer(levelTimerState(hand, now))} {formatTimerLabel(levelTimerState(hand, now))}</span>
              <span className="text-xs text-amber-300/70">{hand.blindsPosted === false ? 'Blinds post when play resumes.' : 'Blinds update when the next hand starts.'}</span>
              {hasRace && (
                <button
                  onClick={() => setShowBreak(true)}
                  className="ml-auto rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-4 py-2 cursor-pointer"
                >
                  Run chip race
                </button>
              )}
              <button
                onClick={handleResumeFromBreak}
                className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm px-4 py-2 cursor-pointer"
              >
                Resume play →
              </button>
            </div>
          );
        })()}

        {/* Status bar */}
        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          <span>{hand.bombPot ? formatBlinds(hand) : `Blinds: ${formatBlinds(hand)}`}</span>
          <span>Street: {STREET_LABEL[hand.street]}</span>
          <span className={saveStatus.ok === false ? 'text-rose-300' : 'text-emerald-300/80'}>{saveStatus.saving ? 'Saving…' : saveStatus.ok === false ? 'Save failed' : saveStatus.at ? 'Auto-saved' : 'Auto-save on'}</span>
          <span>{nonFolded.length} players in</span>
          {activeSideGames.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {activeSideGames.map((s) => (
                <span key={s} className="rounded bg-[#2a2f37] border border-[#3a4a3a] px-2 py-0.5 text-[11px] text-emerald-300/90">{s}</span>
              ))}
            </span>
          )}
        </div>

        {/* Stacks Bar Header with Chip Count / Big Blinds selector */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Stacks</span>
          <div className="flex items-center gap-1 bg-[#1a1d22] border border-[#2a2f37] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setDisplayUnit('chips')}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                displayUnit === 'chips'
                  ? 'bg-[#363c45] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chips
            </button>
            <button
              type="button"
              onClick={() => setDisplayUnit('bb')}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                displayUnit === 'bb'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Big Blinds
            </button>
          </div>
        </div>
        <StacksBar
          hand={{ ...hand, displayUnit }}
          players={hand.players}
          positions={positions(hand)}
          currency={hand.currency}
          hideAmounts={hideAmounts}
          tableSize={hand.tableSize}
          freezeStacks={true}
          frozenStacks={frozenStacks}
          displayUnit={displayUnit}
        />

        {/* Poker Table Graphic */}
        <PokerTable
          hand={{ ...hand, displayUnit }}
          positions={positions(hand)}
          pot={mainPot}
          sidePots={sidePots}
          holeCards={holeCards}
          equity={equity}
          hideAmounts={hideAmounts}
          highlightKeys={highlightKeys}
          winningPlayerIds={winningPlayerIds}
          displayUnit={displayUnit}
          helpMode={false}
          clockSecondsLeft={actionClockSecondsLeft}
          clockActive={actionClockSecondsLeft != null}
          clockType={actionClockType}
          onUseTimeBank={handleUseTimeBank}
          onAdjustTimeBanks={handleAdjustTimeBanks}
        />

        {hand.phase !== 'awarded' ? (
          <>
            {!lowGame && (
              <CommunityCardInput
                hand={hand}
                onDeal={handleDeal}
                onDealHidden={handleDealHidden}
                onFillBoard={handleFillBoard}
                holeCards={holeCards}
                onRunIt={handleRunIt}
                onDealBoard={handleDealBoard}
              />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                {/* 1. Hole Cards */}
                {showHoleEntry && (
                  <AllInEquity hand={hand} nonFolded={nonFolded} holeCards={holeCards} onHoleChange={handleHoleChange} />
                )}
                {showDiscardStep && (
                  <DiscardStep players={nonFolded} holeCards={holeCards} discards={discards} onPick={handlePickDiscard} onConfirm={handleConfirmDiscard} />
                )}

                {/* 2. Action */}
                <ActionRecorder hand={hand} onAction={handleAction} onUndo={handleUndo} canUndo={history.length > 0} />

                {/* 3. Time Controls: Active Clock Banner & Dedicated Time Banks Bar */}
                {actionClockSecondsLeft != null && hand?.currentPlayer >= 0 && (
                  <div className="rounded-xl border border-slate-700 bg-[#161a22] p-3 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                        actionClockSecondsLeft > 10
                          ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                          : actionClockSecondsLeft > 5
                          ? 'bg-amber-950/90 border border-amber-500 text-amber-300 animate-pulse'
                          : 'bg-rose-950 border border-rose-500 text-rose-200 animate-bounce'
                      }`}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium">
                          {actionClockType === 'call_clock' ? 'Clock Called on' : 'Action on'}{' '}
                          <span className="text-white font-bold">{hand.players[hand.currentPlayer]?.name}</span>
                        </div>
                        {hand.clockConfig?.clockSystem === 'time_banks' && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>
                              Time banks: {hand.players[hand.currentPlayer]?.timeBanks ?? hand.clockConfig?.initialTimeBanks ?? 3} left
                            </span>
                            {hand.players[hand.currentPlayer]?.usedBanks > 0 && (
                              <span className="text-amber-300 font-semibold">
                                ({hand.players[hand.currentPlayer]?.usedBanks} used)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-black font-mono tracking-tight ${
                        actionClockSecondsLeft > 10
                          ? 'text-emerald-400'
                          : actionClockSecondsLeft > 5
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {actionClockSecondsLeft}s
                      </div>
                      {actionClockType === 'call_clock' ? (
                        <button
                          onClick={handleCallClock}
                          className="text-xs px-2.5 py-1 rounded-md bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUseTimeBank(hand.players[hand.currentPlayer]?.id)}
                          disabled={(hand.players[hand.currentPlayer]?.timeBanks ?? 3) <= 0}
                          className="text-xs px-2.5 py-1 rounded-md bg-[#2a2f37] hover:bg-[#363c45] text-amber-300 border border-amber-500/40 disabled:opacity-40 cursor-pointer"
                          title="Use a time bank now to extend time"
                        >
                          + Use Bank
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Dedicated Time Banks Tracker Bar */}
                {hand?.clockConfig?.clockSystem === 'time_banks' && (
                  <div className="rounded-xl border border-slate-700/80 bg-[#14181f] p-3 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-amber-400" />
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Player Time Banks
                        </span>
                        <span className="text-[11px] text-slate-400">
                          (+{hand.clockConfig?.timeBankAddSeconds || 30}s per chip)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Host +/- controls · Use bank during turn
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {hand.players.map((p, idx) => {
                        const isCurrent = hand.phase === 'playing' && hand.currentPlayer === idx;
                        const banksLeft = p.timeBanks ?? hand.clockConfig?.initialTimeBanks ?? 3;
                        const isFolded = p.status === 'folded';
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                              isCurrent
                                ? 'border-emerald-500/80 bg-[#122b1c] shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/60'
                                : isFolded
                                ? 'border-slate-800 bg-[#161a22]/60 opacity-60'
                                : 'border-[#2a323f] bg-[#1a202a]'
                            }`}
                          >
                            <span className="font-semibold text-slate-200 truncate max-w-[90px]" title={p.name}>
                              {p.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-black/50 text-amber-300 font-mono font-bold text-[11px] border border-amber-500/30">
                              {banksLeft} ⏳
                            </span>
                            {p.usedBanks > 0 && (
                              <span className="text-[9px] text-amber-400/80 font-medium">
                                ({p.usedBanks} used)
                              </span>
                            )}
                            {isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleUseTimeBank(p.id)}
                                disabled={banksLeft <= 0}
                                title={`Use 1 time bank (+${hand.clockConfig?.timeBankAddSeconds || 30}s)`}
                                className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-[10px] font-bold text-white shadow cursor-pointer"
                              >
                                Use
                              </button>
                            )}
                            <div className="flex items-center gap-0.5 ml-1 border-l border-slate-700 pl-1.5">
                              <button
                                type="button"
                                onClick={() => handleAdjustTimeBanks(p.id, -1)}
                                disabled={banksLeft <= 0}
                                title="Host: Deduct 1 time bank"
                                className="w-5 h-5 flex items-center justify-center rounded bg-[#252b35] hover:bg-[#333b49] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer font-bold"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustTimeBanks(p.id, 1)}
                                title="Host: Grant 1 time bank"
                                className="w-5 h-5 flex items-center justify-center rounded bg-[#252b35] hover:bg-[#333b49] text-slate-400 hover:text-white cursor-pointer font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Out of Turn Action */}
                <div className="pt-1">
                  <OutOfTurnRecorder hand={hand} onFoldOutOfTurn={handleFoldOutOfTurn} onRecordOutOfTurn={handleRecordOutOfTurn} />
                </div>
                {actionError && <div className="mt-2 text-sm text-rose-400">{actionError}</div>}
              </div>
              <ActionHistory history={hand.actionHistory} hideAmounts={hideAmounts} />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-[#4a5a4a] bg-[#1e2227] p-4">
            <div className="text-sm font-semibold text-emerald-300 mb-2">Pots awarded</div>
            {hand.pots.map((pot, i) => {
              const summary = formatPotOutcome(pot, i, hand.winners, hand.players, hand.currency);
              if (!summary) return null;
              return (
                <div key={i} className="text-sm text-slate-300">
                  {summary}
                </div>
              );
            })}
            {hand.sideNotes && hand.sideNotes.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-[#2a2f37] pt-2">
                {hand.sideNotes.map((n, i) => (
                  <div key={i} className="text-xs text-amber-300/90">{n}</div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 pt-2 border-t border-[#2a2f37]">
              <button
                onClick={proceedToNextHand}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-base px-6 py-2.5 shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center gap-2 transition-all"
              >
                <span>Next Hand</span>
                <span className="text-emerald-200">→</span>
              </button>
              <button
                onClick={handleUndo}
                disabled={!history.length}
                className="rounded-xl bg-[#2a2f37] hover:bg-[#363c45] text-slate-200 font-semibold text-sm px-4 py-2.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Undo river card or pot award in case the river was mistyped"
              >
                <Undo2 size={16} />
                <span>Undo (Fix Mistyped River)</span>
              </button>
            </div>
            {sevenTwoActive(hand) && !bonusApplied && (() => {
              const mainWinners = hand.winners.filter((w) => w.potIndex === 0 && w.board !== 'b');
              const pre = mainWinners.length === 1 && holeCards[mainWinners[0].playerId]?.length >= 2
                ? mainWinners[0].playerId : null;
              return (
                <SevenTwoAward
                  hand={hand}
                  holeCards={holeCards}
                  onAward={handleSevenTwoAward}
                  onSkip={handleSevenTwoSkip}
                  foldWinnerId={sevenTwoFoldWinner}
                  preselectId={pre}
                />
              );
            })()}
          </div>
        )}
      </div>
      )}

      {showSetup && (
        <SetupDialog initial={setupInitial} onSave={handleSave} onClose={() => setShowSetup(false)} />
      )}
      {showBlinds && hand && (
        <NextLevelDialog
          smallBlind={blindsPrefill ? blindsPrefill.smallBlind : hand.smallBlind}
          bigBlind={blindsPrefill ? blindsPrefill.bigBlind : hand.bigBlind}
          anteAmount={blindsPrefill ? blindsPrefill.anteAmount : hand.anteAmount}
          anteType={hand.anteType}
          players={hand.players}
          currency={hand.currency}
          chipDenominations={hand.chipDenominations}
          isPreplanner={preplannerLevel}
          onSave={handleBlindLevel}
          onChipRace={handleChipRace}
          onClose={() => { setShowBlinds(false); setBlindsPrefill(null); setPreplannerLevel(false); }}
        />
      )}
      {showEnd && hand && hand.phase === 'ended' && (
        <EndHandDialog
          hand={hand}
          pots={computePots(hand.players, bbaPotOpts(hand))}
          holeCards={holeCards}
          onHoleChange={handleHoleChange}
          onAward={handleAward}
          onClose={() => setShowEnd(false)}
        />
      )}
      {showRebuy && isCash && (
        <RebuyCashoutDialog hand={hand} onApply={handleRebuy} onClose={() => setShowRebuy(false)} />
      )}
      {showRebuy && !isCash && (
        <RebuyDialog
          players={hand.players}
          hand={hand}
          currentLevel={hand.blindLevel || 0}
          rebuyRules={hand.rebuyRules}
          rebuyChips={hand.rebuyChips || hand.startingStack}
          rebuyPrice={hand.rebuyPrice}
          allowAddOn={hand.allowAddOn}
          addOnChips={hand.addOnChips}
          addOnPrice={hand.addOnPrice}
          currency={hand.currency}
          onRebuy={handleRebuy}
          onAddOn={handleRebuy}
          onClose={() => setShowRebuy(false)}
        />
      )}
      {showReentry && (
        <ReentryDialog
          eliminatedPlayers={hand.eliminatedPlayers || []}
          maxReEntries={hand.maxReEntries || 0}
          tableSize={hand.tableSize}
          players={hand.players}
          startingStack={hand.startingStack}
          currency={hand.currency}
          onReentry={handleReentry}
          onClose={() => setShowReentry(false)}
        />
      )}
      {showBombPotModal && hand && (
        <BombPotDialog
          isOpen={showBombPotModal}
          bigBlind={hand.bigBlind || 2}
          currency={hand.currency || '$'}
          onConfirm={handleConfirmBombPot}
          onClose={() => setShowBombPotModal(false)}
        />
      )}
      {showLateEntry && (
        <LateEntryDialog
          tableSize={hand.tableSize}
          players={hand.players}
          startingStack={hand.startingStack}
          currency={hand.currency}
          currentLevel={hand.blindLevel || 0}
          lateRegLevel={hand.lateRegLevel}
          isCash={isCash}
          seatingMode={isCash ? 'players' : 'seats'}
          onAdd={handleLateEntry}
          onClose={() => setShowLateEntry(false)}
        />
      )}
      {showEndSession && (
        <EndSessionDialog
          saving={endingSession}
          onSave={handleEndSessionSave}
          onDiscard={handleEndSessionDiscard}
          onClose={() => setShowEndSession(false)}
        />
      )}
      {showShare && (
        <ShareDialog onClose={() => { setShowShare(false); setShareVersion((v) => v + 1); }} />
      )}
      {showBreak && hand && (
        <BreakDialog
          hand={hand}
          now={now}
          race={showRaceOverride}
          onChipRace={handleChipRace}
          onResume={handleResumeFromBreak}
          dismissOverride={showRaceOverride ? () => {
            setHand((prev) => {
              const remaining = (prev.pendingMissedRaces || []).slice(1);
              const schedule = prev.blindSchedule || [];
              let nextIdx = (prev.tLevel || 0) + 1;
              while (nextIdx < schedule.length && (schedule[nextIdx]?.type === 'break' || schedule[nextIdx]?.type === 'color_up')) nextIdx++;
              const nextLevel = schedule[nextIdx];
              const isStandaloneRace = !prev.inBreak;

              const base = {
                ...prev,
                pendingRace: null,
                pendingMissedRaces: remaining.length > 0 ? remaining : null,
              };

              if (isStandaloneRace) {
                base.pauseStart = null;
                base.tLevel = nextIdx < schedule.length ? nextIdx : prev.tLevel;
                base.pendingLevelIdx = nextIdx < schedule.length ? nextIdx : prev.tLevel;
                base.levelStartEpoch = Date.now();
                base.levelHandsCompleted = 0;
                if (nextLevel && nextLevel.type !== 'break' && nextLevel.type !== 'color_up') {
                  const nextBB = parseAmount(nextLevel.bigBlind) ?? Number(nextLevel.bigBlind) ?? 0;
                  const nextSB = parseAmount(nextLevel.smallBlind) ?? Number(nextLevel.smallBlind) ?? 0;
                  const ante = calcAnteForType(prev.anteType, nextBB, nextLevel.ante);
                  base.smallBlind = nextSB;
                  base.bigBlind = nextBB;
                  base.anteAmount = ante;
                  base.blindLevel = nextIdx;
                }
              }
              return base;
            });
            setShowRaceOverride(null);
            setShowBreak(false);
          } : null}
          onClose={() => { setShowBreak(false); setShowRaceOverride(null); }}
        />
      )}
      {showSetLevel && hand && (
        <SetLevelDialog
          hand={hand}
          onApply={handleSetLevel}
          onClose={() => setShowSetLevel(false)}
        />
      )}
      {hand?.pendingMysteryBounties && hand.pendingMysteryBounties.length > 0 && (
        <MysteryBountyDialog
          item={hand.pendingMysteryBounties[0]}
          currency={hand.currency}
          onAward={handleAwardMysteryBounty}
          onDismiss={handleDismissMysteryBounty}
        />
      )}

      {/* Temporary Game Scheduling Modal */}
      <TemporaryGameModal
        isOpen={showTempGameModal}
        onClose={() => setShowTempGameModal(false)}
        currentHandNumber={hand?.handNumber || 1}
        currentHand={hand}
        existingPlans={hand?.temporaryGames || []}
        onSavePlan={handleSaveTemporaryPlan}
        onDeletePlan={handleDeleteTemporaryPlan}
        onRevertToBaseGame={handleRevertToBaseGame}
      />
    </div>
  );
}
