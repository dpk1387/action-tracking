import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import SetupDialog from '@/components/poker/SetupDialog';
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
import HelpHover from '@/components/HelpHover';
import SetLevelDialog from '@/components/poker/SetLevelDialog';
import { Undo2, Eye, EyeOff, Share2, Save, Power, Rewind, FastForward, Snowflake, HelpCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { sessionStore } from '@/lib/sessionStore';
import { useAuth } from '@/lib/AuthContext';
import {
  publishLive, getShareCode, setShareCode, ensureSaveCode, saveNow, loadSavedSession,
  discardSavedSession, getSaveStatus, subscribeSaveStatus,
} from '@/lib/liveSync';
import {
  startHand, applyAction, dealNextStreet, fillBoard, endHand, computePots, awardPots,
  positionForSeat, getButtonIndex, money, potTotal, STREET_LABEL, calcEquity, VARIANTS, GAME_TYPES, variantMeta, tryAutoWinners, winningHandCards, refundUncontestedPots, effectiveHoleSize, holeCardsComplete, recomputeBlindsForLevel, postBlinds, bbaPotOpts, recordOutOfTurn, formatBlinds,
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
  const [freezeStacks, setFreezeStacks] = useState(false);
  const [helpMode, setHelpMode] = useState(false);
  const [frozenStacks, setFrozenStacks] = useState({});
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

  const offeredRaceRef = useRef(null);
  const recordedHandNumbers = useRef(new Set());
  const { isAuthenticated } = useAuth();
  const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);

  useEffect(() => { sessionStore.set({ config, hand, gameOver }); }, [config, hand, gameOver]);

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
    if (!hand || !hand.inBreak || !hand.pendingRace) return;
    if (hand.phase !== 'awarded') return;
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
        position: positionForSeat(h.players.length, bi, i),
      })),
    });
  };

  const positions = (h) => {
    if (!h) return [];
    const n = h.players.length;
    const bi = getButtonIndex(h);
    return h.players.map((_, i) => positionForSeat(n, bi, i));
  };

  const resetHoleCards = () => { setHoleCards({}); setEquity(null); };
  const pushHistory = (h) => setHistory((prev) => [...prev, h]);

  const handleSave = (cfg) => {
    setConfig(cfg);
    if (hand) {
      const newSchedule = cfg.blindSchedule || [];
      setConfig(cfg);
      setHand((prev) => ({
        ...prev,
        blindSchedule: newSchedule,
        levelConfig: cfg.levelConfig || prev.levelConfig,
        chipDenominations: cfg.chipDenominations || prev.chipDenominations,
        currency: cfg.currency || prev.currency,
        gameType: cfg.gameType || prev.gameType,
        doubleBoard: !!cfg.doubleBoard,
        allowStraddle: !!cfg.allowStraddle,
        allowMultiStraddle: !!cfg.allowMultiStraddle,
        mandatoryStraddle: !!cfg.mandatoryStraddle,
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
        pendingLevelIdx: Math.min(prev.pendingLevelIdx || 0, Math.max(0, newSchedule.length - 1)),
        tLevel: Math.min(prev.tLevel || 0, Math.max(0, newSchedule.length - 1)),
      }));
      setShowSetup(false);
      return;
    }

    recordedHandNumbers.current.clear();
    const sorted = cfg.players.slice().sort((a, b) => a.seat - b.seat);
    const btn = sorted[0].seat;
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
    if (savedTurn >= 0 && next.players[savedTurn] && next.players[savedTurn].status === 'active') {
      next.currentPlayer = savedTurn;
    } else {
      next.currentPlayer = next.players.findIndex((p) => p.status === 'active');
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

  const proceedToNextHand = () => {
    if (hand && hand.phase === 'awarded') {
      updateFrozenStacks(hand);
      recordHand(hand);
    }
    const res = advanceToNextHand(hand);
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
      const awarded = awardPots(ended, w.winnersA, { winnersB: w.winnersB, holeCards });
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

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    const timerFields = [
      'tLevel', 'inBreak', 'levelStartEpoch', 'levelHandsCompleted',
      'pendingLevelIdx', 'pausedMs', 'pauseStart', 'pendingRace',
    ];
    const preserved = {};
    timerFields.forEach((f) => { if (hand && hand[f] !== undefined) preserved[f] = hand[f]; });
    setHand({ ...prev, ...preserved });
    setHistory(history.slice(0, -1));
    setShowEnd(false);
    setEquity(null);
  };

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
      if (hand.doubleBoard) {
        const resA = calcEquity(holes, hand.communityCards, iters, variant, drawSize);
        const resB = calcEquity(holes, hand.boardB, iters, variant, drawSize);
        nf.forEach((p, i) => { byId[p.id] = (resA.results[i].win + resB.results[i].win) / 2; });
        splitPct = (resA.split + resB.split) / 2;
      } else {
        const res = calcEquity(holes, hand.communityCards, iters, variant, drawSize);
        nf.forEach((p, i) => { byId[p.id] = res.results[i].win; });
        splitPct = res.split;
      }
      setEquity({ byId, split: splitPct });
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
    while (idx < sched.length && sched[idx]?.type === 'break') idx++;
    if (idx >= sched.length) return;
    if (idx === (hand.blindLevel || 0)) return;
    const lvl = sched[idx];
    if (!lvl || lvl.type === 'break') return;
    const ante = hand.anteType === 'bba'
      ? Number(lvl.bigBlind)
      : (lvl.ante != null && lvl.ante !== '' ? Number(lvl.ante) : 0);
    const newSB = Number(lvl.smallBlind);
    const newBB = Number(lvl.bigBlind);
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
    const awarded = awardPots(hand, w.winnersA, { winnersB: w.winnersB, holeCards });
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
      const minRaise = hand.currentBet === 0 ? hand.bigBlind : hand.currentBet + (hand.lastRaiseAmount || hand.bigBlind);
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
          ante: prev.anteType === 'bba' ? bb : ante,
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
      const wasLastMissed = (prev.pendingMissedRaces || []).length > 0 && remaining.length === 0;
      const unpause = wasLastMissed ? resumeLevelTimer({
        ...prev,
        players,
        pendingRace: null,
        pendingMissedRaces: null,
      }) : null;
      return unpause || {
        ...prev,
        players,
        pendingRace: null,
        pendingMissedRaces: remaining.length > 0 ? remaining : null,
      };
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
      while (nextIdx < schedule.length && schedule[nextIdx]?.type === 'break') nextIdx++;
      const nextLevel = schedule[nextIdx];
      const base = {
        ...prev,
        inBreak: false,
        tLevel: nextIdx < schedule.length ? nextIdx : (prev.tLevel || 0) + 1,
        pendingLevelIdx: nextIdx < schedule.length ? nextIdx : (prev.tLevel || 0) + 1,
        levelStartEpoch: Date.now(),
        levelHandsCompleted: 0,
        pendingRace: null,
      };
      if (nextLevel && nextLevel.type !== 'break') {
        const ante = prev.anteType === 'bba'
          ? Number(nextLevel.bigBlind)
          : (nextLevel.ante != null && nextLevel.ante !== '' ? Number(nextLevel.ante) : 0);
        base.smallBlind = Number(nextLevel.smallBlind);
        base.bigBlind = Number(nextLevel.bigBlind);
        base.anteAmount = prev.anteType === 'bba' ? Number(nextLevel.bigBlind) : ante;
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
        anteAmount: hand.anteType === 'bba' ? lvl.bigBlind : (lvl.ante || 0),
      });
    } else {
      const suggestion = suggestNextBlinds(sched || [], hand.chipDenominations || []);
      setBlindsPrefill({
        smallBlind: suggestion.smallBlind,
        bigBlind: suggestion.bigBlind,
        anteAmount: hand.anteType === 'bba' ? suggestion.bigBlind : (hand.anteType === 'traditional' ? suggestAnte(suggestion.bigBlind) : 0),
      });
    }
    setShowBlinds(true);
  };

  const handleSetLevel = ({ tLevel, inBreak, levelStartEpoch, levelHandsCompleted, pendingLevelIdx, missedRaces }) => {
    setHand((prev) => {
      const schedule = prev.blindSchedule || [];
      let targetIdx = pendingLevelIdx;
      while (targetIdx < schedule.length && schedule[targetIdx]?.type === 'break') targetIdx++;
      const targetLevel = schedule[targetIdx];
      const noAction = !(prev.actionHistory && prev.actionHistory.length > 0);
      const base = {
        ...prev,
        tLevel,
        inBreak,
        levelStartEpoch,
        levelHandsCompleted,
        pendingLevelIdx,
        pauseStart: missedRaces && missedRaces.length > 0 ? Date.now() : null,
        pausedMs: missedRaces && missedRaces.length > 0 ? 0 : prev.pausedMs,
      };
      if (missedRaces && missedRaces.length > 0) {
        base.pendingMissedRaces = missedRaces;
      }
      if (inBreak) {
        const brk = schedule[tLevel];
        const rc = brk?.race;
        if (rc && Number(rc.retired) > 0 && Number(rc.replacement) > 0) {
          base.pendingRace = { ...rc, tLevel };
        }
      }
      if (noAction && !inBreak && targetLevel && targetLevel.type !== 'break') {
        const ante = prev.anteType === 'bba'
          ? Number(targetLevel.bigBlind)
          : (targetLevel.ante != null && targetLevel.ante !== '' ? Number(targetLevel.ante) : 0);
        base.smallBlind = Number(targetLevel.smallBlind);
        base.bigBlind = Number(targetLevel.bigBlind);
        base.anteAmount = prev.anteType === 'bba' ? Number(targetLevel.bigBlind) : ante;
        base.blindLevel = targetIdx;
        return recomputeBlindsForLevel(base, Number(targetLevel.smallBlind), Number(targetLevel.bigBlind), ante);
      }
      return base;
    });
    setNow(Date.now());
  };

  const handleRebuy = (pid, amt) => {
    setHand((prev) => ({
      ...prev,
      pendingAdjust: { ...(prev.pendingAdjust || {}), [pid]: ((prev.pendingAdjust || {})[pid] || 0) + amt },
    }));
  };

  const handleLateEntry = (nm, stk, seat) => {
    setHand((prev) => {
      const name = nm || `Player ${seat}`;
      return { ...prev, pendingPlayers: [...(prev.pendingPlayers || []), { name, seat, stack: stk }] };
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
    if (!saved || !saved.hand) return;
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
      const cfg = res.saved.config || null;
      setConfig(cfg);
      const restoredHand = res.saved.hand.levelConfig ? res.saved.hand : { ...res.saved.hand, levelConfig: cfg?.levelConfig || undefined, levelStartEpoch: res.saved.hand.levelStartEpoch || Date.now(), levelHandsCompleted: res.saved.hand.levelHandsCompleted || 0, levelCount: res.saved.hand.levelCount || Math.max(1, (res.saved.hand.players || []).length) };
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

  const handleNewSession = () => {
    setSavedSession(null);
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
    setFreezeStacks(false);
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
    setFreezeStacks(false);
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

  const showHoleEntry = hand && hand.phase !== 'awarded' && nonFolded.length >= 2 && hand.currentPlayer === -1;
  const showDiscardStep = hand && hand.variant === 'crazy_pineapple' && hand.cpNeedsDiscard && !hand.cpDiscarded && hand.currentPlayer === -1 && hand.phase !== 'awarded' && hand.communityCards.length >= 3 && nonFolded.length >= 2 && nonFolded.every((p) => holeCards[p.id] && holeCards[p.id].length === 3);
  const isCash = hand?.mode === 'cash';
  const lowGame = variantMeta(variant).group === 'low';

  const highlightKeys = useMemo(() => {
    if (!hand || hand.phase !== 'awarded') return null;
    const set = new Set();
    hand.winners.forEach((w) => {
      const hole = holeCards[w.playerId];
      if (!hole) return;
      const board = w.board === 'b' ? (hand.boardB || []) : hand.communityCards;
      const cards = winningHandCards(hole, board, hand.variant);
      if (cards) cards.forEach((c) => set.add(c.rank + c.suit));
    });
    return set.size ? set : null;
  }, [hand, holeCards]);

  const activeSideGames = (() => {
    if (!hand) return [];
    const out = [];
    const sg = hand.sideGames || {};
    if (sg.killPot) out.push('Kill');
    if (sg.halfKill) out.push('Half-kill');
    if (hand.bombPot) out.push('Bomb');
    if (sg.sevenTwo) out.push('7-2');
    if (sg.bounty) out.push('Bounty');
    if (sg.mysteryBounty) out.push('Mystery');
    if (sg.standUp) out.push('Stand up');
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
        onDismissGuest={handleNewSession}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] text-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Live Hand #{hand.handNumber}</h1>
            <HelpHover sections={[
              { title: 'Timer & levels', body: 'The countdown shows time left in the current blind level. Pause, rewind (–1m), or fast-forward (+1m) with the buttons. Blinds change at the start of the next hand.' },
              { title: 'Session & sharing', body: '"Save session" stores this game. "Share" opens a spectator link. "TV view" opens a full-screen display for monitors.' },
              { title: 'Visibility', body: '"Hide amounts" hides all chip stacks and pot totals from the table view.' },
              { title: 'Side games', body: 'Tags like Kill, Bomb, 7-2, Bounty, Stand up show when side games are active. Configure them on the Variant & side games page.' },
            ]} />
            <span className="text-xs text-slate-500 uppercase">{VARIANTS[variant]?.label || "Hold'em"} · {GAME_TYPES[hand.gameType] || 'No Limit'}{hand.doubleBoard ? ' · Double board' : ''}{hand.bombPot ? ' · Bomb pot' : ''}</span>
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
            <Link to="/variant" className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2">Variant & side games</Link>
            {isCash && (
              <>
                <button onClick={() => setShowRebuy(true)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer">Rebuy / Cash out</button>
                <button onClick={() => setShowLateEntry(true)} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 cursor-pointer">Late entry</button>
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
            <button
              onClick={() => setHelpMode((v) => !v)}
              className={`rounded-lg text-sm px-3 py-2 cursor-pointer flex items-center gap-1.5 transition-colors ${
                helpMode
                  ? 'bg-emerald-800 border border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                  : 'bg-[#2a2f37] hover:bg-[#363c45] text-slate-300'
              }`}
            >
              <HelpCircle size={15} />
              Help Mode {helpMode ? 'ON' : 'OFF'}
            </button>
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
          <span>Blinds: {formatBlinds(hand)}</span>
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

        {/* Stacks Bar */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Stacks</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelpMode((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                helpMode
                  ? 'bg-emerald-900/60 border border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                  : 'bg-[#2a2f37] border border-[#2a2f37] text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle size={12} />
              Help Mode: {helpMode ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setFreezeStacks((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                freezeStacks
                  ? 'bg-sky-900/50 border border-sky-700 text-sky-300'
                  : 'bg-[#2a2f37] border border-[#2a2f37] text-slate-400 hover:text-slate-200'
              }`}
            >
              {freezeStacks ? <Snowflake size={12} /> : <Eye size={12} />}
              {freezeStacks ? 'Frozen' : 'Live'}
            </button>
          </div>
        </div>
        <StacksBar
          hand={hand}
          players={hand.players}
          positions={positions(hand)}
          currency={hand.currency}
          hideAmounts={hideAmounts}
          tableSize={hand.tableSize}
          freezeStacks={freezeStacks}
          frozenStacks={frozenStacks}
        />

        {/* Poker Table Graphic */}
        <PokerTable
          hand={hand}
          positions={positions(hand)}
          pot={mainPot}
          sidePots={sidePots}
          holeCards={holeCards}
          equity={equity}
          hideAmounts={hideAmounts}
          highlightKeys={highlightKeys}
          helpMode={helpMode}
        />

        {hand.phase !== 'awarded' ? (
          <>
            {showHoleEntry && (
              <AllInEquity hand={hand} nonFolded={nonFolded} holeCards={holeCards} onHoleChange={handleHoleChange} />
            )}
            {showDiscardStep && (
              <DiscardStep players={nonFolded} holeCards={holeCards} discards={discards} onPick={handlePickDiscard} onConfirm={handleConfirmDiscard} />
            )}
            {!lowGame && (
              <CommunityCardInput hand={hand} onDeal={handleDeal} onDealHidden={handleDealHidden} onFillBoard={handleFillBoard} holeCards={holeCards} />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <ActionRecorder hand={hand} onAction={handleAction} />
                <div className="mt-2">
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
              const ws = hand.winners.filter((w) => w.potIndex === i);
              if (!ws.length) return null;
              const names = ws.map((w) => hand.players.find((p) => p.id === w.playerId)?.name).join(' & ');
              return (
                <div key={i} className="text-sm text-slate-300">
                  {i === 0 ? 'Main pot' : `Side pot ${i}`}: {names} {ws.length > 1 ? 'split' : 'wins'} {money(pot.amount, hand.currency)}
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

      {showSetup && (
        <SetupDialog initial={config} onSave={handleSave} onClose={() => setShowSetup(false)} />
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
      {showLateEntry && (
        <LateEntryDialog
          tableSize={hand.tableSize}
          players={hand.players}
          startingStack={hand.startingStack}
          currency={hand.currency}
          currentLevel={hand.blindLevel || 0}
          lateRegLevel={hand.lateRegLevel}
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
              const wasLastMissed = (prev.pendingMissedRaces || []).length > 0 && remaining.length === 0;
              const unpause = wasLastMissed ? resumeLevelTimer({
                ...prev,
                pendingRace: null,
                pendingMissedRaces: null,
              }) : null;
              return unpause || {
                ...prev,
                pendingRace: null,
                pendingMissedRaces: remaining.length > 0 ? remaining : null,
              };
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
    </div>
  );
}
