import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, History, Layers, ListTree, LogOut, Settings, SkipForward, Trophy } from 'lucide-react';
import { applyAction, awardPots, calcEquity, computePots, dealNextStreet, fillBoard, refundUncontestedPots, startHand, tryAutoWinners } from '@/lib/poker';
import { generateGoDeck } from '@/lib/goMode';
import {
  GAME_TYPES,
  betShortcuts,
  displayBet,
  displayStack,
  minChipForBlinds,
  roundToNearest,
  roundUpTo,
} from '@/lib/tableRules';
import {
  BOT_DIFFICULTIES,
  BOT_SPEEDS,
  BOT_STYLES,
  STYLE_SHORT,
  blindLevelsForSpeed,
  decideBotAction,
  formatBlindLevel,
  handsPerLevel,
  assignStyles,
  nextBlindSeats,
  parseStyleSpec,
  resolveStyle,
  thinkDelay,
} from '@/lib/bots';
import { getBotsSession, upsertBotsSession } from '@/lib/botsSessionsStore';
import { isAggressiveAction, simulateStyleStats } from '@/lib/botStats';
import HandHistoryCard from '@/components/poker/HandHistoryCard';

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED_SUITS = { h: true, d: true };
const RANK_VALUE = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUIT_VALUE = { s: 4, h: 3, d: 2, c: 1 };
const STACK_PRESETS = [25, 50, 100, 150, 200];

function cardText(card) {
  if (!card) return '';
  return `${card.rank === 'T' ? '10' : card.rank}${SUIT_SYMBOL[card.suit] || card.suit}`;
}

function sortHole(cards) {
  if (!Array.isArray(cards)) return [];
  return [...cards].sort((a, b) => {
    const rd = (RANK_VALUE[b?.rank] || 0) - (RANK_VALUE[a?.rank] || 0);
    return rd !== 0 ? rd : (SUIT_VALUE[b?.suit] || 0) - (SUIT_VALUE[a?.suit] || 0);
  });
}

const ACTION_LABEL = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', allin: 'All-in', sb: 'SB', bb: 'BB' };

function CardChip({ card, fourColor = false, delay = 0 }) {
  if (!card) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-10 sm:w-8 sm:h-11 rounded-md bg-[#0f1319] border border-slate-700/70" />
    );
  }
  const red = RED_SUITS[card.suit];
  const color = !fourColor
    ? (red ? 'text-rose-600' : 'text-slate-900')
    : card.suit === 'h' ? 'text-rose-600'
      : card.suit === 'd' ? 'text-sky-600'
        : card.suit === 'c' ? 'text-emerald-600'
          : 'text-slate-900';
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-10 sm:w-8 sm:h-11 rounded-md bg-white border border-slate-300 shadow-sm text-sm font-black leading-none"
      style={{ animation: 'lcDealIn 200ms ease-out both', animationDelay: `${delay}ms` }}
    >
      <span className={color}>{cardText(card)}</span>
    </span>
  );
}

function formatChips(n, unit, bigBlind) {
  const v = Math.round(Number(n) || 0);
  if (unit === 'bb') {
    const bb = Number(bigBlind) || 1;
    return `${(v / bb).toFixed(v % bb === 0 ? 0 : 1)} bb`;
  }
  return v.toLocaleString('en-US');
}

const STYLE_CHOICES = BOT_STYLES.filter((s) => s.id !== 'random');

/** Seat-order positions (SB, BB, …, CO, BTN) for a hand's players. */
function positionLabels(hand) {
  const dealt = [...(hand.players || [])].sort((a, b) => a.seat - b.seat);
  if (!dealt.length) return {};
  const start = Math.max(0, dealt.findIndex((p) => p.seat === hand.sbSeat));
  const order = [...dealt.slice(start), ...dealt.slice(0, start)];
  const n = order.length;
  const labels = {};
  order.forEach((p, i) => {
    if (i === 0) labels[p.name] = n === 2 ? 'BTN' : 'SB';
    else if (i === 1) labels[p.name] = 'BB';
    else if (i === n - 1) labels[p.name] = 'BTN';
    else if (i === n - 2) labels[p.name] = 'CO';
    else labels[p.name] = `MP${i - 1}`;
  });
  return labels;
}

/** Snapshot of one finished hand, shaped like Action Tracking hand records. */
function buildHandRecord(hand, awarded, holes, levelLabel) {
  const positions = positionLabels(hand);
  const holeCards = {};
  hand.players.forEach((p) => { holeCards[p.id] = holes[p.id] || []; });
  return {
    id: `${awarded.handNumber}-${Date.now()}`,
    handNumber: awarded.handNumber,
    level: levelLabel,
    smallBlind: awarded.smallBlind,
    bigBlind: awarded.bigBlind,
    anteType: 'bba',
    anteAmount: awarded.anteAmount,
    currency: '',
    players: hand.players.map((p) => {
      const end = awarded.players.find((x) => x.seat === p.seat);
      return {
        id: p.id,
        name: p.name,
        position: positions[p.name] || '',
        stack: p.initialStack ?? p.stack,
        initialStack: p.initialStack ?? p.stack,
        endStack: end ? end.stack : p.stack,
        totalBet: p.totalBet || 0,
      };
    }),
    positions,
    holeCards,
    communityCards: (awarded.communityCards || []).filter((c) => c && !c.hidden),
    actions: (hand.actionHistory || []).map((a) => ({
      street: a.street,
      player: a.player,
      action: a.action,
      chips: a.chips,
      isAggressive: isAggressiveAction(a),
      raiseLevel: a.raiseLevel,
    })),
    winners: (awarded.winners || []).map((w) => ({ potIndex: w.potIndex, playerId: w.playerId, amount: w.amount })),
  };
}

const DEFAULT_SETUP = {
  gameType: 'online',
  difficulty: 'medium',
  seats: 6,
  stackBb: 100,
  speed: 'regular',
  styleSpecs: {},
};

export default function BotsMode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [setup, setSetup] = useState(null);
  const [setupDraft, setSetupDraft] = useState(DEFAULT_SETUP);
  const [game, setGame] = useState(null);
  const [hand, setHand] = useState(null);
  const [holes, setHoles] = useState({});
  const [history, setHistory] = useState([]);
  const [handRecords, setHandRecords] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [botStats, setBotStats] = useState(null);
  const [setupError, setSetupError] = useState(null);
  const [equity, setEquity] = useState(null);
  const [unit, setUnit] = useState('chips');
  const [fourColor, setFourColor] = useState(false);
  const [levelSeconds, setLevelSeconds] = useState(0);
  const [champion, setChampion] = useState(null);
  const [heroBusted, setHeroBusted] = useState(false);
  const [sessionOutcome, setSessionOutcome] = useState(null);
  const [raiseTo, setRaiseTo] = useState('');
  const [flash, setFlash] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const deckRef = useRef([]);
  const raiseInputRef = useRef(null);
  const gameRef = useRef(null);
  const handRef = useRef(null);
  const sessionIdRef = useRef(null);
  const sessionStartRef = useRef(0);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { handRef.current = hand; }, [hand]);

  const levels = useMemo(() => blindLevelsForSpeed(setup?.speed || setupDraft.speed), [setup?.speed, setupDraft.speed]);

  // Level clock (informational; blinds advance by hands played, per structure setup)
  useEffect(() => {
    if (!game || champion || heroBusted) return;
    const id = setInterval(() => setLevelSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [game, champion, heroBusted]);

  // Resume a saved session (home screen "Resume" opens /bots?s=<id>).
  useEffect(() => {
    const id = searchParams.get('s');
    if (!id) { setHydrated(true); return; }
    const saved = getBotsSession(id);
    if (!saved || saved.status !== 'in_progress' || !saved.state?.game) {
      setHydrated(true);
      return;
    }
    sessionIdRef.current = saved.id;
    sessionStartRef.current = saved.createdAt || Date.now();
    setSetup(saved.setup || DEFAULT_SETUP);
    setSetupDraft(saved.setup || DEFAULT_SETUP);
    setGame(saved.state.game);
    setHand(saved.state.hand || null);
    setHoles(saved.state.holes || {});
    setHistory(saved.state.history || []);
    setHandRecords(saved.handRecords || []);
    deckRef.current = saved.state.deck || [];
    setLevelSeconds(saved.state.levelSeconds || 0);
    setHydrated(true);
    // Only the first mount should hydrate; later navigation inside the page is a new game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSession = useCallback((outcome) => {
    const id = sessionIdRef.current;
    if (!id || !setup || !game) return;
    upsertBotsSession({
      id,
      createdAt: sessionStartRef.current || Date.now(),
      updatedAt: Date.now(),
      status: outcome ? 'complete' : 'in_progress',
      outcome: outcome || null,
      setup,
      heroName: 'You',
      handCount: handRecords.length,
      handRecords,
      state: outcome ? null : {
        game,
        hand,
        holes,
        deck: deckRef.current,
        history,
        levelSeconds,
      },
    });
  }, [setup, game, hand, holes, history, handRecords, levelSeconds]);

  // Keep the saved session current so a refresh or the home screen can resume it.
  useEffect(() => {
    if (!hydrated || !sessionIdRef.current) return;
    persistSession(sessionOutcome);
  }, [hydrated, persistSession, sessionOutcome]);

  const startGame = (draft) => {
    const botCount = Number(draft.seats) - 1;
    const specs = draft.styleSpecs || {};
    const anySpec = Object.values(specs).some((v) => String(v ?? '').trim() !== '');
    let botStyles;
    if (!anySpec) {
      botStyles = Array.from({ length: botCount }, () => resolveStyle('random'));
    } else {
      const assigned = assignStyles(specs, botCount);
      if (assigned.error) {
        setSetupError(assigned.error);
        return;
      }
      botStyles = assigned.styles.map((id) => resolveStyle(id));
    }
    setSetupError(null);
    const seats = [];
    const ring = [];
    for (let i = 0; i < Number(draft.seats); i++) {
      seats.push({
        seat: i,
        playerId: i,
        name: i === 0 ? 'You' : `Bot ${i}`,
        isHero: i === 0,
        styleId: i === 0 ? null : botStyles[i - 1] || 'random',
        eliminated: false,
      });
      ring.push(i);
    }
    const bb = blindLevelsForSpeed(draft.speed)[0].bb;
    const stacks = {};
    seats.forEach((s) => { stacks[s.playerId] = Math.round(Number(draft.stackBb) * bb); });
    const g = {
      ...draft,
      seats,
      ring,
      stacks,
      difficulty: draft.difficulty,
      speed: draft.speed,
      levelIndex: 0,
      handsThisLevel: 0,
      handsTarget: handsPerLevel(draft.speed, seats.length),
      buttonSeat: 0,
      sbSeat: null,
      bbSeat: null,
      handNumber: 0,
    };
    sessionIdRef.current = `bots_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStartRef.current = Date.now();
    setSetup(draft);
    setHistory([]);
    setHandRecords([]);
    setChampion(null);
    setHeroBusted(false);
    setSessionOutcome(null);
    setLevelSeconds(0);
    setHoles({});
    setHand(null);
    setGame(g);
  };

  const dealHand = useCallback((g) => {
    if (!g) return;
    const live = g.seats.filter((s) => !s.eliminated);
    if (live.length < 2) {
      setChampion(g.seats.find((s) => !s.eliminated) || null);
      setGame({ ...g });
      return;
    }
    const ring = g.ring;
    const activeSeats = live.map((s) => s.seat);
    const nextActive = (seat) => {
      const i = ring.indexOf(seat);
      for (let k = 1; k <= ring.length; k++) {
        const s = ring[(i + k) % ring.length];
        if (activeSeats.includes(s)) return s;
      }
      return null;
    };
    let sbSeat = g.sbSeat;
    let bbSeat = g.bbSeat;
    if (sbSeat == null || bbSeat == null || !activeSeats.includes(sbSeat) && !activeSeats.includes(bbSeat)) {
      if (activeSeats.length === 2) {
        sbSeat = g.buttonSeat;
        bbSeat = nextActive(g.buttonSeat);
      } else {
        sbSeat = nextActive(g.buttonSeat);
        bbSeat = nextActive(sbSeat);
      }
    }
    const level = blindLevelsForSpeed(g.speed)[g.levelIndex] || blindLevelsForSpeed(g.speed)[0];
    const players = live.map((s) => ({ name: s.name, seat: s.seat, stack: g.stacks[s.seat] }));
    const deck = generateGoDeck('nlh');
    const dealtHoles = {};
    live.forEach((s) => {
      const cards = [deck.pop(), deck.pop()];
      // engine ids follow array order
      dealtHoles[players.findIndex((p) => p.seat === s.seat)] = cards;
    });
    deckRef.current = deck;
    const next = startHand(
      {
        players,
        smallBlind: level.sb,
        bigBlind: level.bb,
        anteType: 'bba',
        anteAmount: level.ante,
        mode: 'cash',
        variant: 'nlh',
        blindSeats: { sbSeat, bbSeat },
        tableSize: players.length,
        chipDenominations: [Math.max(1, Math.round(level.sb / 2))],
        levelConfig: { type: 'hands' },
      },
      g.buttonSeat,
      g.handNumber + 1,
    );
    setHoles(dealtHoles);
    setHand(next);
    setRaiseTo('');
    setGame({ ...g, sbSeat, bbSeat, handNumber: g.handNumber + 1 });
  }, []);

  // Deals the first hand once a game is created. Later hands are dealt by the
  // timer in finishHand, so this must not fire for a handNumber above zero.
  useEffect(() => {
    if (game && !hand && !champion && game.handNumber === 0) dealHand(game);
  }, [game, hand, champion, dealHand]);

  const finishHand = useCallback((currentHand) => {
    const g = gameRef.current;
    if (!g || !currentHand || currentHand.phase === 'awarded') return;
    // Betting is over: an all-in a shorter stack could not cover goes back to
    // the player who shoved it rather than sitting in an uncalled side pot.
    const settled = refundUncontestedPots(currentHand) || currentHand;
    const nonFolded = settled.players.filter((p) => p.status !== 'folded');
    const pots = computePots(settled.players, { bba: true });
    let winners = null;
    if (nonFolded.length === 1) {
      const map = {};
      pots.forEach((_, i) => { map[i] = [nonFolded[0].id]; });
      winners = { winnersA: map };
    } else {
      winners = tryAutoWinners(settled, holes);
      if (!winners) {
        const map = {};
        pots.forEach((_, i) => { map[i] = pots[i].eligible; });
        winners = { winnersA: map };
      }
    }
    const awarded = awardPots(settled, winners.winnersA, { winnersB: winners.winnersB, winnersC: winners.winnersC, holeCards: holes });
    setHand(awarded);

    const levelLabel = formatBlindLevel(blindLevelsForSpeed(g.speed), g.levelIndex);
    // Keep bot cards out of the saved record unless they were shown at showdown.
    const heroSeatNo = g.seats.find((s) => s.isHero)?.seat;
    const uncontested = nonFolded.length === 1;
    const recordHoles = {};
    settled.players.forEach((p) => {
      const shown = p.seat === heroSeatNo || (!uncontested && p.status !== 'folded');
      recordHoles[p.id] = shown ? (holes[p.id] || []) : [];
    });
    setHandRecords((records) => [buildHandRecord(settled, awarded, recordHoles, levelLabel), ...records]);

    // Engine ids are positional, so keep the persistent stacks keyed by seat.
    const stacks = { ...g.stacks };
    awarded.players.forEach((p) => { stacks[p.seat] = p.stack; });
    const seats = g.seats.map((s) => {
      const idx = awarded.players.findIndex((p) => p.seat === s.seat);
      return idx === -1 ? s : { ...s, eliminated: awarded.players[idx].stack <= 0 };
    });
    const live = seats.filter((s) => !s.eliminated);
    const potTotal = pots.reduce((sum, p) => sum + p.amount, 0);
    const winnerNames = [...new Set(awarded.winners.map((w) => awarded.players.find((p) => p.id === w.playerId)?.name).filter(Boolean))];
    setHistory((h) => [
      {
        handNumber: awarded.handNumber,
        level: formatBlindLevel(blindLevelsForSpeed(g.speed), g.levelIndex),
        pot: potTotal,
        board: (awarded.communityCards || []).filter((c) => c && !c.hidden).map(cardText).join(' '),
        winners: winnerNames,
        maxWon: Math.max(0, ...awarded.winners.map((w) => w.amount || 0)),
      },
      ...h,
    ]);

    const heroOut = seats.find((s) => s.isHero)?.eliminated;
    if (live.length <= 1 || heroOut) {
      const winnerSeat = live.length <= 1 ? live[0] || null : null;
      setChampion(winnerSeat);
      setHeroBusted(Boolean(heroOut) && !winnerSeat?.isHero);
      setSessionOutcome(winnerSeat?.isHero ? 'win' : 'bust');
      setGame({ ...g, seats, stacks });
      return;
    }

    let handsThisLevel = g.handsThisLevel + 1;
    let levelIndex = g.levelIndex;
    let handsTarget = g.handsTarget;
    const levelCount = blindLevelsForSpeed(g.speed).length;
    if (handsThisLevel >= g.handsTarget && levelIndex < levelCount - 1) {
      levelIndex += 1;
      handsThisLevel = 0;
      handsTarget = handsPerLevel(g.speed, live.length);
      setLevelSeconds(0);
    }
    const rotated = nextBlindSeats({
      ring: g.ring,
      activeSeats: live.map((s) => s.seat),
      buttonSeat: g.buttonSeat,
      sbSeat: g.sbSeat,
      bbSeat: g.bbSeat,
    });
    const nextGame = {
      ...g,
      seats,
      stacks,
      levelIndex,
      handsThisLevel,
      handsTarget,
      buttonSeat: rotated.buttonSeat,
      sbSeat: rotated.sbSeat,
      bbSeat: rotated.bbSeat,
    };
    setTimeout(() => {
      setHoles({});
      setHand(null);
      dealHand(nextGame);
    }, 2200);
    setGame(nextGame);
  }, [holes, dealHand]);

  // Board dealing and hand completion. applyAction opens the next street with
  // hidden placeholders, so the board is filled from the deck here.
  useEffect(() => {
    if (!hand || !game || hand.phase === 'awarded') return undefined;
    const nonFolded = hand.players.filter((p) => p.status !== 'folded');
    if (nonFolded.length <= 1) {
      const t = setTimeout(() => finishHand(hand), 700);
      return () => clearTimeout(t);
    }
    // Fill the street straight away; rendering drops hidden placeholders, so
    // the new cards appear once with their deal-in animation instead of a
    // blank frame followed by a second, sudden render.
    const hidden = (hand.communityCards || []).filter((c) => c && c.hidden).length;
    if (hidden > 0) {
      const cards = deckRef.current.splice(0, hidden);
      const res = fillBoard(hand, cards);
      if (!res.error) setHand(res.hand);
      return undefined;
    }
    if (hand.currentPlayer !== -1) return undefined;
    if (hand.street !== 'river') {
      const cardsNeeded = hand.street === 'preflop' ? 3 : 1;
      const t = setTimeout(() => {
        const cards = deckRef.current.splice(0, cardsNeeded);
        const res = dealNextStreet(hand, cards);
        if (!res.error) setHand(res.hand);
      }, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => finishHand(hand), 800);
    return () => clearTimeout(t);
  }, [hand, game, finishHand]);

  // Bot turns.
  useEffect(() => {
    if (!hand || !game || hand.phase !== 'playing' || hand.currentPlayer < 0) return undefined;
    const active = hand.players[hand.currentPlayer];
    const seat = game.seats.find((s) => s.seat === active?.seat);
    if (!seat || seat.isHero) return undefined;
    const t = setTimeout(() => {
      const action = decideBotAction({
        hand,
        playerIndex: hand.currentPlayer,
        holeCards: holes[active.id],
        styleId: seat.styleId,
        difficulty: game.difficulty,
      });
      let amount = action.amount;
      if (amount != null && game.gameType === 'live') {
        const chip = minChipForBlinds(hand.bigBlind);
        const minTo = (hand.currentBet || 0) + Math.max(hand.lastRaiseAmount || hand.bigBlind, hand.bigBlind);
        const maxTo = active.currentBet + active.stack;
        amount = Math.min(maxTo, Math.max(roundUpTo(minTo, chip), roundToNearest(amount, chip)));
      }
      let res = applyAction(hand, hand.currentPlayer, action.type, amount);
      if (res && res.error) res = applyAction(hand, hand.currentPlayer, action.type === 'raise' ? 'call' : 'check');
      if (res && res.error) res = applyAction(hand, hand.currentPlayer, 'fold');
      if (res && !res.error) setHand(res);
    }, thinkDelay(game.speed));
    return () => clearTimeout(t);
  }, [hand, game, holes]);

  const heroIndex = hand ? hand.players.findIndex((p) => (game?.seats.find((s) => s.isHero)?.seat === p.seat)) : -1;
  const hero = heroIndex >= 0 ? hand.players[heroIndex] : null;
  const isHeroTurn = !!hand && hand.phase === 'playing' && hand.currentPlayer === heroIndex;
  const pot = hand ? hand.players.reduce((s, p) => s + (p.totalBet || 0), 0) : 0;
  const toCall = hero ? Math.max(0, (hand.currentBet || 0) - (hero.currentBet || 0)) : 0;
  const minRaiseTo = hand ? (hand.currentBet || 0) + Math.max(hand.lastRaiseAmount || hand.bigBlind, hand.bigBlind) : 0;
  const maxRaiseTo = hero ? hero.currentBet + hero.stack : 0;

  // Online vs live: the live table hides the pot, rounds every bet to the
  // smallest chip in play and shows stacks the way a live player would see them.
  const bigBlind = hand?.bigBlind || 1;
  const gameType = game?.gameType || setup?.gameType || 'online';
  const isLive = gameType === 'live';
  const minChip = minChipForBlinds(bigBlind);
  const roundBet = useCallback((v) => {
    const n = Math.round(Number(v) || 0);
    if (!isLive) return n;
    // Bets must be payable in real chips and never below the legal raise.
    return Math.max(roundUpTo(minRaiseTo, minChip), roundToNearest(n, minChip));
  }, [isLive, minChip, minRaiseTo]);
  const betLabel = useCallback((v) => displayBet({ value: v, unit, bb: bigBlind }), [unit, bigBlind]);
  const stackLabel = useCallback((p, seat) => displayStack({
    value: p.stack,
    unit,
    bb: bigBlind,
    gameType,
    isHero: !!seat?.isHero,
    allIn: p.status === 'allin',
    minChip,
  }), [unit, bigBlind, gameType, minChip]);
  const shortcuts = useMemo(() => betShortcuts({
    street: hand?.street || 'preflop',
    currentBet: hand?.currentBet || 0,
    bigBlind,
    pot,
    minRaiseTo,
    maxRaiseTo,
    minChip: isLive ? minChip : 1,
  }), [hand?.street, hand?.currentBet, bigBlind, pot, minRaiseTo, maxRaiseTo, minChip, isLive]);

  const allInSpot = !!hand && hand.players.some((p) => p.status === 'allin');
  useEffect(() => {
    if (!hand || !allInSpot) {
      setEquity(null);
      return undefined;
    }
    const live = hand.players.filter((p) => p.status !== 'folded');
    const ids = live.map((p) => p.id);
    const holeArrays = ids.map((id) => holes[id]);
    if (holeArrays.length < 2 || holeArrays.some((h) => !Array.isArray(h) || h.length < 2)) {
      setEquity(null);
      return undefined;
    }
    const board = (hand.communityCards || []).filter((c) => c && !c.hidden);
    const t = setTimeout(() => {
      const { results } = calcEquity(holeArrays, board, 1500, 'nlh');
      const next = {};
      ids.forEach((id, i) => { next[id] = results[i]?.win ?? 0; });
      setEquity(next);
    }, 350);
    return () => clearTimeout(t);
  }, [hand, holes, allInSpot]);

  // Bot stats are simulated on demand: 1,200 preflop-only hands per style is
  // fast (well under a second) and measures the same decision code the bots use.
  useEffect(() => {
    if (!showStats || !game) return undefined;
    const bots = game.seats.filter((s) => !s.isHero);
    const key = `${game.difficulty}|${game.seats.length}|${bots.map((b) => b.styleId).join(',')}`;
    if (botStats?.key === key) return undefined;
    const timer = setTimeout(() => {
      const rows = bots.map((b) => ({
        seat: b.seat,
        name: b.name,
        styleId: b.styleId,
        eliminated: b.eliminated,
        stats: simulateStyleStats({ styleId: b.styleId, seats: game.seats.length, hands: 1200, difficulty: game.difficulty }),
      }));
      setBotStats({ key, rows });
    }, 50);
    return () => clearTimeout(timer);
  }, [showStats, game, botStats?.key]);

  const seatCount = game?.seats?.length || 0;
  const heroSeatNo = game?.seats?.find((s) => s.isHero)?.seat ?? 0;
  const orderedPlayers = useMemo(() => {
    if (!hand) return [];
    const offset = (seat) => (((seat - heroSeatNo) % seatCount) + seatCount) % seatCount;
    return [...hand.players].sort((a, b) => offset(a.seat) - offset(b.seat));
  }, [hand, heroSeatNo, seatCount]);
  const seatPosition = (p) => {
    const n = Math.max(orderedPlayers.length, 2);
    const idx = orderedPlayers.findIndex((q) => q.id === p.id);
    if (idx <= 0) return { left: '50%', top: '90%' };
    const theta = Math.PI / 2 + (idx / n) * Math.PI * 2;
    return { left: `${50 + 37 * Math.cos(theta)}%`, top: `${50 + 32 * Math.sin(theta)}%` };
  };

  const act = (type, amount) => {
    if (!hand || !isHeroTurn) return;
    const res = applyAction(hand, heroIndex, type, amount);
    if (res && !res.error) {
      setHand(res);
      setRaiseTo('');
    } else if (res?.error) {
      setFlash(res.error);
      setTimeout(() => setFlash(null), 2500);
    }
  };

  const submitRaise = (value) => {
    const amount = roundBet(value);
    if (!amount) return;
    const capped = Math.min(amount, maxRaiseTo);
    act(toCall > 0 ? 'raise' : 'bet', Math.max(capped, Math.min(maxRaiseTo, minRaiseTo)));
  };

  // Shortcuts: F fold, C call/check, R bet/raise, M min bet/raise, Shift+A all in,
  // +/- move the bet size by half a big blind inside [min raise, all in].
  useEffect(() => {
    const onKey = (e) => {
      if (!hand || !isHeroTurn || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        act(toCall > 0 ? 'raise' : 'bet', maxRaiseTo);
        return;
      }
      if (typing && /^[+\-=]$/.test(e.key)) {
        e.preventDefault();
        const step = Math.max(1, Math.round(hand.bigBlind / 2));
        const base = Number(e.target.value) || minRaiseTo;
        const next = e.key === '-' ? base - step : base + step;
        setRaiseTo(String(Math.min(Math.max(next, minRaiseTo), maxRaiseTo)));
        return;
      }
      // The raise box is a number field, so letter shortcuts still work while it
      // has focus; blur it first so the typed text is not captured again.
      if (typing && !/^[acfmr]$/.test(e.key.toLowerCase())) return;
      if (typing) e.target.blur();
      const key = e.key.toLowerCase();
      if (key === 'f') {
        e.preventDefault();
        act('fold');
      } else if (key === 'c') {
        e.preventDefault();
        act(toCall > 0 ? 'call' : 'check');
      } else if (key === 'r') {
        e.preventDefault();
        setRaiseTo(String(Math.min(Math.max(Math.round((hand.currentBet || 0) + Math.max(pot * 0.5, minRaiseTo - (hand.currentBet || 0))), minRaiseTo), maxRaiseTo)));
        raiseInputRef.current?.focus();
        raiseInputRef.current?.select();
      } else if (key === 'm') {
        e.preventDefault();
        setRaiseTo(String(Math.min(minRaiseTo, maxRaiseTo)));
        raiseInputRef.current?.focus();
      } else if (key === '+' || key === '=' || key === '-') {
        e.preventDefault();
        const step = Math.max(1, Math.round(hand.bigBlind / 2));
        const base = Number(raiseTo) || minRaiseTo;
        const next = key === '-' ? base - step : base + step;
        setRaiseTo(String(Math.min(Math.max(next, minRaiseTo), maxRaiseTo)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hand, isHeroTurn, toCall, pot, minRaiseTo, maxRaiseTo, raiseTo]);

  const levelLabel = formatBlindLevel(levels, game?.levelIndex || 0);

  // One line for the award banner, with the amount each player actually took
  // across all side pots and correct grammar for the hero.
  const winSummary = useMemo(() => {
    if (!hand || hand.phase !== 'awarded') return null;
    const byPlayer = new Map();
    for (const w of hand.winners || []) {
      const p = hand.players.find((x) => x.id === w.playerId);
      if (!p) continue;
      const entry = byPlayer.get(p.id) || { name: p.name, isHero: p.seat === heroSeatNo, amount: 0 };
      entry.amount += w.amount || 0;
      byPlayer.set(p.id, entry);
    }
    const list = [...byPlayer.values()].sort((a, b) => b.amount - a.amount);
    if (!list.length) return { text: 'Hand complete' };
    if (list.length === 1) {
      const w = list[0];
      return { text: `${w.isHero ? 'You win' : `${w.name} wins`} ${betLabel(w.amount)}` };
    }
    return { text: list.map((w) => `${w.isHero ? 'You win' : `${w.name} wins`} ${betLabel(w.amount)}`).join(' · ') };
  }, [hand, betLabel, heroSeatNo]);

  const styleFill = useMemo(() => {
    const specs = Object.values(setupDraft.styleSpecs || {});
    if (!specs.some((v) => String(v ?? '').trim() !== '')) return 'blank';
    let min = 0;
    let max = 0;
    for (const v of specs) {
      const parsed = parseStyleSpec(v);
      if (!parsed) return 'invalid';
      min += parsed.min;
      max += parsed.max;
    }
    return { min, max };
  }, [setupDraft.styleSpecs]);

  if (!setup) {
    const botCount = Math.max(1, Number(setupDraft.seats) - 1);
    const fillText = styleFill === 'blank'
      ? `Bots to seat: ${botCount}. Leave every box blank for a random mix.`
      : styleFill === 'invalid'
        ? 'Use a number like 2, or a range like 2-3.'
        : styleFill.min > botCount
          ? `Needs at least ${styleFill.min} bots, but the table has ${botCount}.`
          : `${styleFill.min}-${styleFill.max} picked · ${botCount - styleFill.max > 0 ? `${botCount - styleFill.max} random` : 'rest filled by ranges'}.`;
    const fillOk = styleFill === 'blank' || (styleFill !== 'invalid' && styleFill.min <= botCount);
    return (
      <div className="min-h-screen bg-[#121417] text-white p-4 sm:p-6">
        <div className="w-full max-w-xl lg:max-w-4xl xl:max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Play Bots</h1>
              <p className="text-xs text-slate-400 mt-1">Solo practice against AI opponents. Blind levels use a big-blind ante.</p>
            </div>
            <button type="button" onClick={() => navigate('/')} className="px-3 py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-xs font-medium cursor-pointer">
              Back to Home
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-[#151921] border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Difficulty</div>
              <div className="grid grid-cols-2 gap-2">
                {BOT_DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSetupDraft((s) => ({ ...s, difficulty: d.id }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer text-left ${setupDraft.difficulty === d.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#1d2430] border-slate-700/60 text-slate-200 hover:bg-[#283244]'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Game type</div>
              <div className="grid grid-cols-2 gap-2">
                {GAME_TYPES.map((gt) => (
                  <button
                    key={gt.id}
                    type="button"
                    onClick={() => setSetupDraft((s2) => ({ ...s2, gameType: gt.id }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer text-left ${(setupDraft.gameType || 'online') === gt.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#1d2430] border-slate-700/60 text-slate-200 hover:bg-[#283244]'}`}
                  >
                    <div>{gt.label}</div>
                    <div className="text-[10px] font-normal text-slate-400 leading-tight mt-0.5">{gt.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Live hides the pot, rounds stacks and bets to real chips, and starts bets at the level’s smallest chip.</p>
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-2xl p-4 shadow-xl sm:col-span-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Seats ({setupDraft.seats}-max)</div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={setupDraft.seats}
                    onChange={(e) => setSetupDraft((s) => ({ ...s, seats: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Heads-up</span><span>10-max</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {handsPerLevel(setupDraft.speed, setupDraft.seats)} hands per level ({BOT_SPEEDS.find((s) => s.id === setupDraft.speed)?.handsPerPlayer} × {setupDraft.seats} players)
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Starting stack</div>
                    <div className="text-[11px] font-mono text-emerald-300">{setupDraft.stackBb} bb</div>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={300}
                    step={5}
                    value={setupDraft.stackBb}
                    onChange={(e) => setSetupDraft((s) => ({ ...s, stackBb: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={setupDraft.stackBb}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSetupDraft((s) => ({ ...s, stackBb: Number.isFinite(v) ? Math.min(300, Math.max(10, Math.round(v))) : 10 }));
                      }}
                      className="w-16 bg-[#0e1219] border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono text-slate-100"
                    />
                    <span className="text-[11px] text-slate-500">bb</span>
                    {STACK_PRESETS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSetupDraft((s) => ({ ...s, stackBb: v }))}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${setupDraft.stackBb === v ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#1d2430] border-slate-700/60 text-slate-300 hover:bg-[#283244]'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Speed</div>
                  <div className="grid grid-cols-2 gap-2">
                    {BOT_SPEEDS.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setSetupDraft((s) => ({ ...s, speed: sp.id }))}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${setupDraft.speed === sp.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#1d2430] border-slate-700/60 text-slate-200 hover:bg-[#283244]'}`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-2xl p-4 shadow-xl sm:col-span-2">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Bot playstyles</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {STYLE_CHOICES.map((st) => (
                  <label key={st.id} title={st.desc} className="flex items-center justify-between gap-2 rounded-xl bg-[#19202b] border border-slate-700/70 px-2.5 py-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 truncate">{st.label}</span>
                    <input
                      value={setupDraft.styleSpecs?.[st.id] || ''}
                      onChange={(e) => setSetupDraft((s) => ({ ...s, styleSpecs: { ...s.styleSpecs, [st.id]: e.target.value } }))}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`${st.label} bots`}
                      className="w-12 bg-[#0e1219] border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] font-mono text-center text-slate-100"
                    />
                  </label>
                ))}
              </div>
              <p className={`text-[11px] mt-2 ${fillOk ? 'text-slate-500' : 'text-rose-300'}`}>{fillText}</p>
              <p className="text-[11px] text-slate-500">Enter an exact count (2) or a range (2-3) per style; any seats you leave uncovered are filled with random players.</p>
            </div>
          </div>

          {setupError && <div className="text-xs px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200">{setupError}</div>}

          <button
            type="button"
            onClick={() => startGame(setupDraft)}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base cursor-pointer shadow-xl transition-all active:scale-[0.99]"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-[560px] bg-[#121417] text-white flex flex-col overflow-hidden">
      <div className="w-full max-w-6xl mx-auto flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 lg:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#151921] border border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Play Bots · {BOT_DIFFICULTIES.find((d) => d.id === setup.difficulty)?.label}</span>
            <span data-testid="game-type" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{isLive ? 'Live' : 'Online'}</span>
            <span className="text-xs text-slate-400">Level {game.levelIndex + 1}</span>
            <span className="text-xs font-mono text-slate-300">{levelLabel}</span>
            <span className="text-xs text-slate-500">Hand {game.handsThisLevel}/{game.handsTarget}</span>
            <span className="text-xs font-mono text-slate-500">{Math.floor(levelSeconds / 60)}:{String(levelSeconds % 60).padStart(2, '0')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setShowSettings(true)} title="Settings" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><Settings size={14} /></button>
            <button type="button" data-testid="bot-stats-button" onClick={() => setShowStats(true)} title="Bot stats" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><BarChart3 size={14} /></button>
            <button type="button" onClick={() => setShowHistory(true)} title="Hand history" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><History size={14} /></button>
            <button type="button" onClick={() => setShowStructure(true)} title="Structure setup" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><Layers size={14} /></button>
            <button type="button" onClick={() => setShowLevels(true)} title="Set level" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><ListTree size={14} /></button>
            <button type="button" onClick={() => { setGame((g) => ({ ...g, levelIndex: Math.min(levels.length - 1, g.levelIndex + 1), handsThisLevel: 0, handsTarget: handsPerLevel(g.speed, g.seats.filter((s) => !s.eliminated).length) })); setLevelSeconds(0); }} title="Next level" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><SkipForward size={14} /></button>
            <button type="button" onClick={() => setShowEnd(true)} title="End session" className="p-2 rounded-lg bg-rose-900/50 hover:bg-rose-800/60 cursor-pointer"><LogOut size={14} /></button>
          </div>
        </div>

        {flash && <div className="text-xs px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200">{flash}</div>}

        {champion || heroBusted ? (
          <div data-testid="session-complete" className="bg-[#151921] border border-emerald-700/60 rounded-2xl p-8 text-center space-y-3 shadow-xl">
            <Trophy className="mx-auto text-amber-400" size={40} />
            <h2 className="text-xl font-black text-white">
              {champion ? (champion.isHero ? 'You win it all!' : `${champion.name} wins it all`) : 'You busted'}
            </h2>
            <p className="text-xs text-slate-400">
              {history.length} hands played · saved to Completed sessions with your stats and every hand.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button type="button" onClick={() => setShowStats(true)} className="px-4 py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] text-xs font-semibold cursor-pointer">Bot stats</button>
              <button type="button" onClick={() => setShowHistory(true)} className="px-4 py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] text-xs font-semibold cursor-pointer">Hand history</button>
              <button
                type="button"
                onClick={() => { setSetup(null); setGame(null); setHand(null); setChampion(null); setHeroBusted(false); setSessionOutcome(null); }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black cursor-pointer"
              >
                New game
              </button>
              <button type="button" onClick={() => navigate('/')} className="px-4 py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] text-xs font-semibold cursor-pointer">Home</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 lg:gap-3">
            <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-2">
            <div data-testid="table" className="relative w-full flex-1 min-h-[280px] bg-[#11141b] border border-slate-800/90 rounded-2xl shadow-md overflow-hidden">
              <div className="absolute inset-[11%] rounded-[50%] border border-emerald-900/60 bg-[radial-gradient(ellipse_at_center,_#17332b_0%,_#0d1a17_75%)] shadow-[inset_0_0_40px_rgba(0,0,0,0.55)]" />

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none px-12">
                {!isLive && (
                  <>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-200/60">Pot</div>
                    <div className="text-xl sm:text-2xl font-black text-white font-mono leading-tight">{formatChips(pot, unit, hand?.bigBlind)}</div>
                  </>
                )}
                <div data-testid="board" className="flex justify-center gap-1 sm:gap-1.5 mt-1 min-h-[44px] items-center">
                  {(hand?.communityCards || []).filter((c) => c && !c.hidden).map((c, i) => (
                    <CardChip key={`${i}-${c.rank}${c.suit}`} card={c} fourColor={fourColor} delay={Math.min(i, 5) * 55} />
                  ))}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">Hand #{hand?.handNumber || 0}</div>
              </div>

              {orderedPlayers.map((p) => {
                // Cards stay hidden through an all-in until the betting is over,
                // then only the players who are all in turn them over.
                const bettingOver = hand.currentPlayer === -1 || hand.phase !== 'playing';
                const seat = game.seats.find((s) => s.seat === p.seat);
                const isTurn = hand.currentPlayer === p.id && hand.phase === 'playing';
                const folded = p.status === 'folded';
                // A pot won by everyone else folding stays face down.
                const uncontested = hand.phase === 'awarded'
                  && hand.players.filter((x) => x.status !== 'folded').length === 1;
                const reveal = Boolean(seat?.isHero)
                  || (p.status === 'allin' && bettingOver)
                  || (hand.phase === 'awarded' && !folded && !uncontested);
                return (
                  <div key={p.id} data-testid={`seat-${p.seat}`} data-status={p.status} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={seatPosition(p)}>
                    <div className={`flex flex-col items-center ${folded ? 'opacity-45' : ''}`}>
                      <div data-testid={`cards-${p.seat}`} className="flex items-end justify-center gap-0.5 h-[34px] sm:h-[40px] -mb-2 z-20 relative">
                        {reveal
                          ? sortHole(holes[p.id]).map((c, i) => <CardChip key={`${i}-${c?.rank}${c?.suit}`} card={c} fourColor={fourColor} delay={i * 70} />)
                          : !folded ? <span className="text-[10px] text-slate-600">—</span> : null}
                      </div>
                      <div className={`w-[80px] sm:w-[98px] lg:w-[110px] rounded-xl border px-1 pt-2.5 pb-1 text-center shadow-lg ${isTurn ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40' : 'border-slate-700/80 bg-[#19202b]/95'}`}>
                        <div className="flex items-center justify-center gap-0.5">
                          {p.seat === hand.buttonSeat && <span className="text-[8px] px-0.5 rounded bg-white text-black font-black leading-tight">D</span>}
                          {p.seat === hand.sbSeat && p.seat !== hand.bbSeat && <span className="text-[8px] px-0.5 rounded bg-sky-500/30 text-sky-200 font-bold leading-tight">SB</span>}
                          {p.seat === hand.bbSeat && <span className="text-[8px] px-0.5 rounded bg-rose-500/30 text-rose-200 font-bold leading-tight">BB</span>}
                          <span className="text-[10px] font-bold text-white truncate">{p.name}</span>
                        </div>
                        {showStyle && seat?.styleId && (
                          <div data-testid={`style-${p.seat}`} className="text-[9px] text-slate-500 leading-tight">{STYLE_SHORT[seat.styleId] || seat.styleId}</div>
                        )}
                        <div data-testid={`stack-${p.seat}`} className="text-[11px] font-mono text-emerald-300 leading-tight">{stackLabel(p, seat)}</div>
                        <div className="flex items-center justify-center gap-1 text-[9px] min-h-[12px]">
                          {p.currentBet > 0 && <span className="font-mono text-amber-300">{betLabel(p.currentBet)}</span>}
                          {equity && equity[p.id] != null && <span className="font-mono text-sky-300">{equity[p.id].toFixed(0)}%</span>}
                        </div>
                        {p.lastAction?.type && <div className="text-[9px] text-slate-500 leading-tight">{ACTION_LABEL[p.lastAction.type] || p.lastAction.type}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 bg-[#0f1319]/95 border border-slate-800 rounded-2xl shadow-xl">
              <div className="w-full p-2 sm:p-2.5 space-y-2">
                {hand?.phase === 'awarded' ? (
                  <div data-testid="winner-banner" className="text-center text-sm font-bold text-amber-300">
                    {winSummary?.text || 'Hand complete'}
                  </div>
                ) : isHeroTurn ? (
                  <>
                    <div className="flex gap-2">
                      {toCall > 0 && (
                        <button type="button" data-action="fold" onClick={() => act('fold')} title="Fold (F)" className="flex-1 py-3 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-rose-300 font-bold text-sm cursor-pointer">Fold</button>
                      )}
                      {toCall > 0 ? (
                        <button type="button" data-action="call" onClick={() => act('call')} title="Call (C)" className="flex-1 py-3 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-emerald-300 font-medium text-sm cursor-pointer">
                          Call {betLabel(Math.min(toCall, hero.stack))}
                        </button>
                      ) : (
                        <button type="button" data-action="check" onClick={() => act('check')} title="Check (C)" className="flex-1 py-3 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-emerald-300 font-medium text-sm cursor-pointer">Check</button>
                      )}
                      <button type="button" data-action="allin" onClick={() => act(toCall > 0 ? 'raise' : 'bet', maxRaiseTo)} title="All in (Shift + A)" className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-400/60 text-white font-bold text-sm cursor-pointer transition-colors shadow-lg shadow-rose-950/40">
                        All in
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        ref={raiseInputRef}
                        data-testid="raise-input"
                        type="number"
                        value={raiseTo}
                        onChange={(e) => setRaiseTo(e.target.value)}
                        placeholder={`${minRaiseTo}`}
                        title="Bet size: M = min, R = half pot, +/- = half a big blind"
                        className="w-28 bg-[#0e1219] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono"
                      />
                      <button type="button" onClick={() => submitRaise(raiseTo)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold cursor-pointer">
                        {toCall > 0 ? 'Raise to' : 'Bet'}
                      </button>
                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        {shortcuts.map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            data-shortcut={sc.id}
                            onClick={() => submitRaise(sc.amount)}
                            title={`${betLabel(sc.amount)}`}
                            className="px-2.5 py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-[11px] font-semibold cursor-pointer"
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-3">
                    {hand ? `${hand.players[hand.currentPlayer]?.name || 'Waiting'} is acting…` : 'Dealing…'}
                  </div>
                )}
              </div>
            </div>
            </div>

            <aside className="hidden lg:flex w-60 xl:w-72 shrink-0 flex-col gap-2 min-h-0">
              <div className="bg-[#151921] border border-slate-800 rounded-2xl p-3 shadow-xl">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Recent hands</div>
                {history.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No hands played yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                    {history.slice(0, 12).map((h, i) => (
                      <div key={`${h.handNumber}-${i}`} className="rounded-lg bg-[#19202b] border border-slate-800 px-2 py-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>#{h.handNumber}</span>
                          <span className="font-mono text-amber-300">{formatChips(h.maxWon, unit, hand?.bigBlind)}</span>
                        </div>
                        <div className="text-[11px] text-white font-semibold truncate">{h.winners.join(', ')}</div>
                        {h.board && <div className="text-[10px] font-mono text-slate-500 truncate">{h.board}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-[#151921] border border-slate-800 rounded-2xl p-3 shadow-xl text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between"><span>Level</span><span className="font-mono text-slate-200">{levelLabel}</span></div>
                <div className="flex justify-between"><span>Hands this level</span><span className="font-mono text-slate-200">{game.handsThisLevel}/{game.handsTarget}</span></div>
                <div className="flex justify-between"><span>Players left</span><span className="font-mono text-slate-200">{game.seats.filter((x) => !x.eliminated).length}</span></div>
                <div className="flex justify-between"><span>Big blind ante</span><span className="font-mono text-slate-200">{formatChips(hand?.anteAmount || 0, unit, hand?.bigBlind)}</span></div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {showStats && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowStats(false)}>
          <div data-testid="bot-stats-modal" className="bg-[#141922] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white">Bot stats</h3>
              <button type="button" onClick={() => setShowStats(false)} className="text-xs text-slate-400 hover:text-white cursor-pointer">Close</button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Simulated from 1,200 preflop hands per bot with this table's difficulty and playstyles.</p>
            {!botStats?.rows?.length ? (
              <p className="text-xs text-slate-400">Simulating…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
                      <th className="py-1.5 pr-2">Bot</th>
                      <th className="py-1.5 px-2">VPIP</th>
                      <th className="py-1.5 px-2">PFR</th>
                      <th className="py-1.5 px-2">3-bet</th>
                      <th className="py-1.5 px-2">ATS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botStats.rows.map((r) => (
                      <tr key={r.seat} className="border-b border-slate-800/70">
                        <td className="py-1.5 pr-2">
                          <div className="text-white font-medium flex items-center gap-1.5">
                            {r.name}
                            {r.eliminated && <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300 font-bold">OUT</span>}
                          </div>
                          <div className="text-[10px] text-slate-500">{STYLE_SHORT[r.styleId] || r.styleId}</div>
                        </td>
                        <td className="py-1.5 px-2 font-mono text-emerald-300">{r.stats.vpip ?? '—'}%</td>
                        <td className="py-1.5 px-2 font-mono text-sky-300">{r.stats.pfr ?? '—'}%</td>
                        <td className="py-1.5 px-2 font-mono text-amber-300">{r.stats.threeBet ?? '—'}%</td>
                        <td className="py-1.5 px-2 font-mono text-slate-300">{r.stats.ats ?? '—'}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-[#141922] border border-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Hand History ({history.length})</h3>
              <button type="button" onClick={() => setShowHistory(false)} className="text-xs text-slate-400 hover:text-white cursor-pointer">Close</button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">No hands played yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="rounded-xl bg-[#19202b] border border-slate-800 px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Hand #{h.handNumber} · {h.level}</span>
                      <span className="font-mono text-amber-300">{formatChips(h.pot, unit, hand?.bigBlind)}</span>
                    </div>
                    <div className="text-xs text-white font-semibold mt-0.5">{h.winners.join(', ')}</div>
                    {h.board && <div className="text-[11px] font-mono text-slate-500 mt-0.5">{h.board}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-[#141922] border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Settings</h3>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Show stack in</div>
              <div className="grid grid-cols-2 gap-2">
                {['chips', 'bb'].map((u) => (
                  <button key={u} type="button" onClick={() => setUnit(u)} className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${unit === u ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#19202b] border-slate-700 text-slate-300'}`}>
                    {u === 'chips' ? 'Chips' : 'Big blinds'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Deck colors</div>
              <div className="grid grid-cols-2 gap-2">
                {[2, 4].map((n) => (
                  <button key={n} type="button" onClick={() => setFourColor(n === 4)} className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${(n === 4) === fourColor ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#19202b] border-slate-700 text-slate-300'}`}>
                    {n} color
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Bot playstyles</div>
              <button type="button" onClick={() => setShowStyle((v) => !v)} className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${showStyle ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#19202b] border-slate-700 text-slate-300'}`}>
                {showStyle ? 'Shown under each name' : 'Hidden'}
              </button>
            </div>
            <button type="button" onClick={() => setShowSettings(false)} className="w-full py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] text-xs font-semibold cursor-pointer">Done</button>
          </div>
        </div>
      )}

      {showStructure && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowStructure(false)}>
          <div className="bg-[#141922] border border-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Structure setup</h3>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Speed</div>
            <div className="grid grid-cols-2 gap-2">
              {BOT_SPEEDS.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => {
                    setSetup((s) => ({ ...s, speed: sp.id }));
                    setGame((g) => (g ? { ...g, speed: sp.id, handsTarget: handsPerLevel(sp.id, g.seats.filter((s) => !s.eliminated).length) } : g));
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${setup?.speed === sp.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-[#19202b] border-slate-700 text-slate-300'}`}
                >
                  {sp.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">Every level antes one big blind (BBA). Hands per level are recalculated when a level changes.</p>
            <div className="space-y-1">
              {levels.map((l, i) => (
                <div key={i} className={`flex items-center justify-between text-[11px] px-2 py-1 rounded ${game?.levelIndex === i ? 'bg-emerald-900/40 text-emerald-200' : 'text-slate-400'}`}>
                  <span>Level {i + 1}</span>
                  <span className="font-mono">{l.sb.toLocaleString('en-US')}/{l.bb.toLocaleString('en-US')} ({l.ante.toLocaleString('en-US')})</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowStructure(false)} className="w-full py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] text-xs font-semibold cursor-pointer">Done</button>
          </div>
        </div>
      )}

      {showLevels && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLevels(false)}>
          <div className="bg-[#141922] border border-slate-800 rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-5 space-y-2" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-1">Set level</h3>
            {levels.map((l, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setGame((g) => ({ ...g, levelIndex: i, handsThisLevel: 0, handsTarget: handsPerLevel(g.speed, g.seats.filter((s) => !s.eliminated).length) }));
                  setLevelSeconds(0);
                  setShowLevels(false);
                }}
                className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl border cursor-pointer ${game?.levelIndex === i ? 'border-emerald-500 bg-emerald-600/20 text-emerald-200' : 'border-slate-700 bg-[#19202b] text-slate-300 hover:border-slate-500'}`}
              >
                <span>Level {i + 1}</span>
                <span className="font-mono">{l.sb.toLocaleString('en-US')}/{l.bb.toLocaleString('en-US')} ({l.ante.toLocaleString('en-US')})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showEnd && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEnd(false)}>
          <div className="bg-[#141922] border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">End session?</h3>
            <p className="text-xs text-slate-400">The session is saved to Completed sessions with your stats and every hand played.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowEnd(false)} className="flex-1 py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] text-xs font-semibold cursor-pointer">Keep playing</button>
              <button
                type="button"
                onClick={() => { setShowEnd(false); persistSession('ended'); navigate('/'); }}
                className="flex-1 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-xs font-black cursor-pointer"
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
