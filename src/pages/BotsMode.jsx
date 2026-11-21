import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Layers, ListTree, LogOut, Minus, Pause, Play, Settings, SkipForward, Trophy } from 'lucide-react';
import { applyAction, awardPots, computePots, dealNextStreet, startHand, tryAutoWinners } from '@/lib/poker';
import { generateGoDeck } from '@/lib/goMode';
import {
  BOT_DIFFICULTIES,
  BOT_SPEEDS,
  BOT_STYLES,
  blindLevelsForSpeed,
  decideBotAction,
  formatBlindLevel,
  handsPerLevel,
  nextBlindSeats,
  resolveStyle,
  thinkDelay,
} from '@/lib/bots';

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED_SUITS = { h: true, d: true };

function cardText(card) {
  if (!card) return '';
  return `${card.rank === 'T' ? '10' : card.rank}${SUIT_SYMBOL[card.suit] || card.suit}`;
}

function CardChip({ card, fourColor = false }) {
  if (!card) return null;
  const red = RED_SUITS[card.suit];
  const color = fourColor
    ? card.suit === 's' ? 'text-slate-200' : card.suit === 'h' ? 'text-rose-400' : card.suit === 'd' ? 'text-sky-400' : 'text-emerald-400'
    : red ? 'text-rose-400' : 'text-slate-100';
  return (
    <span className="inline-flex items-center justify-center w-8 h-11 rounded-md bg-white border border-slate-300 shadow-sm text-base font-black">
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

const DEFAULT_SETUP = { difficulty: 'medium', seats: 6, style: 'random', stackBb: 100, speed: 'regular' };

export default function BotsMode() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  const [setupDraft, setSetupDraft] = useState(DEFAULT_SETUP);
  const [game, setGame] = useState(null);
  const [hand, setHand] = useState(null);
  const [holes, setHoles] = useState({});
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [paused, setPaused] = useState(false);
  const [unit, setUnit] = useState('chips');
  const [fourColor, setFourColor] = useState(false);
  const [levelSeconds, setLevelSeconds] = useState(0);
  const [champion, setChampion] = useState(null);
  const [raiseTo, setRaiseTo] = useState('');
  const [flash, setFlash] = useState(null);

  const deckRef = useRef([]);
  const raiseInputRef = useRef(null);
  const gameRef = useRef(null);
  const handRef = useRef(null);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { handRef.current = hand; }, [hand]);

  const levels = useMemo(() => blindLevelsForSpeed(setup?.speed || setupDraft.speed), [setup?.speed, setupDraft.speed]);

  // Level clock (informational; blinds advance by hands played, per structure setup)
  useEffect(() => {
    if (!game || paused || champion) return;
    const id = setInterval(() => setLevelSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [game, paused, champion]);

  const startGame = (draft) => {
    const seats = [];
    const ring = [];
    for (let i = 0; i < Number(draft.seats); i++) {
      seats.push({
        seat: i,
        playerId: i,
        name: i === 0 ? 'You' : `Bot ${i}`,
        isHero: i === 0,
        styleId: i === 0 ? null : resolveStyle(draft.style),
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
    setSetup(draft);
    setHistory([]);
    setChampion(null);
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
    const nonFolded = currentHand.players.filter((p) => p.status !== 'folded');
    const pots = computePots(currentHand.players, { bba: true });
    let winners = null;
    if (nonFolded.length === 1) {
      const map = {};
      pots.forEach((_, i) => { map[i] = [nonFolded[0].id]; });
      winners = { winnersA: map };
    } else {
      winners = tryAutoWinners(currentHand, holes);
      if (!winners) {
        const map = {};
        pots.forEach((_, i) => { map[i] = pots[i].eligible; });
        winners = { winnersA: map };
      }
    }
    const awarded = awardPots(currentHand, winners.winnersA, { winnersB: winners.winnersB, winnersC: winners.winnersC, holeCards: holes });
    setHand(awarded);

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

    if (live.length <= 1) {
      setChampion(live[0] || null);
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

  // Street advancement and hand completion.
  useEffect(() => {
    if (!hand || !game || paused || hand.phase === 'awarded') return;
    const nonFolded = hand.players.filter((p) => p.status !== 'folded');
    if (nonFolded.length <= 1) {
      const t = setTimeout(() => finishHand(hand), 700);
      return () => clearTimeout(t);
    }
    if (hand.currentPlayer === -1) {
      if (hand.street !== 'river') {
        const t = setTimeout(() => {
          const cardsNeeded = hand.street === 'preflop' ? 3 : 1;
          const cards = deckRef.current.splice(0, cardsNeeded);
          const res = dealNextStreet(hand, cards);
          if (!res.error) setHand(res.hand);
        }, 650);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => finishHand(hand), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [hand, game, paused, finishHand]);

  // Bot turns.
  useEffect(() => {
    if (!hand || !game || paused || hand.phase !== 'playing' || hand.currentPlayer < 0) return undefined;
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
      let res = applyAction(hand, hand.currentPlayer, action.type, action.amount);
      if (res && res.error) res = applyAction(hand, hand.currentPlayer, action.type === 'raise' ? 'call' : 'check');
      if (res && res.error) res = applyAction(hand, hand.currentPlayer, 'fold');
      if (res && !res.error) setHand(res);
    }, thinkDelay(game.speed));
    return () => clearTimeout(t);
  }, [hand, game, holes, paused]);

  const heroIndex = hand ? hand.players.findIndex((p) => (game?.seats.find((s) => s.isHero)?.seat === p.seat)) : -1;
  const hero = heroIndex >= 0 ? hand.players[heroIndex] : null;
  const isHeroTurn = !!hand && hand.phase === 'playing' && hand.currentPlayer === heroIndex && !paused;
  const pot = hand ? hand.players.reduce((s, p) => s + (p.totalBet || 0), 0) : 0;
  const toCall = hero ? Math.max(0, (hand.currentBet || 0) - (hero.currentBet || 0)) : 0;
  const minRaiseTo = hand ? (hand.currentBet || 0) + Math.max(hand.lastRaiseAmount || hand.bigBlind, hand.bigBlind) : 0;
  const maxRaiseTo = hero ? hero.currentBet + hero.stack : 0;

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
    const amount = Math.round(Number(value) || 0);
    if (!amount) return;
    act(toCall > 0 ? 'raise' : 'bet', Math.min(Math.max(amount, minRaiseTo), maxRaiseTo));
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

  if (!setup) {
    return (
      <div className="min-h-screen bg-[#121417] text-white p-4 sm:p-6">
        <div className="w-full max-w-xl mx-auto space-y-4">
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
              <div className="mt-4 text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Starting stack ({setupDraft.stackBb} bb)</div>
              <input
                type="range"
                min={10}
                max={300}
                value={setupDraft.stackBb}
                onChange={(e) => setSetupDraft((s) => ({ ...s, stackBb: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Bot playstyle</div>
              <select
                value={setupDraft.style}
                onChange={(e) => setSetupDraft((s) => ({ ...s, style: e.target.value }))}
                className="w-full bg-[#0e1219] border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200"
              >
                {BOT_STYLES.map((st) => <option key={st.id} value={st.id}>{st.label} — {st.desc}</option>)}
              </select>
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-2xl p-4 shadow-xl">
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
              <p className="text-[11px] text-slate-500 mt-3">
                {handsPerLevel(setupDraft.speed, setupDraft.seats)} hands per level ({BOT_SPEEDS.find((s) => s.id === setupDraft.speed)?.handsPerPlayer} × {setupDraft.seats} players)
              </p>
            </div>
          </div>

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
    <div className="min-h-screen bg-[#121417] text-white pb-44">
      <div className="w-full max-w-xl mx-auto flex flex-col gap-3 p-2 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#151921] border border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Play Bots · {BOT_DIFFICULTIES.find((d) => d.id === setup.difficulty)?.label}</span>
            <span className="text-xs text-slate-400">Level {game.levelIndex + 1}</span>
            <span className="text-xs font-mono text-slate-300">{levelLabel}</span>
            <span className="text-xs text-slate-500">Hand {game.handsThisLevel}/{game.handsTarget}</span>
            <span className="text-xs font-mono text-slate-500">{Math.floor(levelSeconds / 60)}:{String(levelSeconds % 60).padStart(2, '0')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setShowSettings(true)} title="Settings" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><Settings size={14} /></button>
            <button type="button" onClick={() => setShowHistory(true)} title="Hand history" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><History size={14} /></button>
            <button type="button" onClick={() => setShowStructure(true)} title="Structure setup" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><Layers size={14} /></button>
            <button type="button" onClick={() => setShowLevels(true)} title="Set level" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><ListTree size={14} /></button>
            <button type="button" onClick={() => { setGame((g) => ({ ...g, levelIndex: Math.min(levels.length - 1, g.levelIndex + 1), handsThisLevel: 0, handsTarget: handsPerLevel(g.speed, g.seats.filter((s) => !s.eliminated).length) })); setLevelSeconds(0); }} title="Next level" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><SkipForward size={14} /></button>
            <button type="button" onClick={() => setLevelSeconds((s) => Math.max(0, s - 60))} title="Rewind 1 minute" className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer"><Minus size={14} /></button>
            <button type="button" onClick={() => setPaused((p) => !p)} title={paused ? 'Resume timer' : 'Pause timer'} className="p-2 rounded-lg bg-[#222834] hover:bg-[#2d3545] text-slate-300 border border-slate-700/60 cursor-pointer">{paused ? <Play size={14} /> : <Pause size={14} />}</button>
            <button type="button" onClick={() => setShowEnd(true)} title="End session" className="p-2 rounded-lg bg-rose-900/50 hover:bg-rose-800/60 cursor-pointer"><LogOut size={14} /></button>
          </div>
        </div>

        {flash && <div className="text-xs px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200">{flash}</div>}

        {champion ? (
          <div className="bg-[#151921] border border-emerald-700/60 rounded-2xl p-8 text-center space-y-3 shadow-xl">
            <Trophy className="mx-auto text-amber-400" size={40} />
            <h2 className="text-xl font-black text-white">{champion.isHero ? 'You win it all!' : `${champion.name} wins it all`}</h2>
            <p className="text-xs text-slate-400">{history.length} hands played</p>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setShowHistory(true)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer">Hand history</button>
              <button type="button" onClick={() => { setSetup(null); setGame(null); setHand(null); setChampion(null); }} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black cursor-pointer">New game</button>
              <button type="button" onClick={() => navigate('/')} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer">Home</button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[#11141b] border border-slate-800/90 rounded-2xl p-3 shadow-md">
              <div className="text-center mb-4">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Pot</div>
                <div className="text-2xl font-black text-white">{formatChips(pot, unit, hand?.bigBlind)}</div>
                <div className="flex justify-center gap-1 mt-3 min-h-[44px]">
                  {(hand?.communityCards || []).map((c, i) => <CardChip key={i} card={c.hidden ? null : c} fourColor={fourColor} />)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(hand?.players || []).map((p) => {
                  const seat = game.seats.find((s) => s.seat === p.seat);
                  const isTurn = hand.currentPlayer === p.id && hand.phase === 'playing';
                  const folded = p.status === 'folded';
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-xl px-2.5 py-2 border ${isTurn ? 'border-amber-500/80 bg-amber-500/10' : folded ? 'border-slate-800 bg-[#141922] opacity-50' : 'bg-[#19202b] border-slate-700/80'} gap-2`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-white truncate">{p.name}</span>
                        {p.seat === hand.buttonSeat && <span className="text-[9px] px-1 rounded bg-white text-black font-black">D</span>}
                        {p.seat === hand.sbSeat && p.seat !== hand.bbSeat && <span className="text-[9px] px-1 rounded bg-sky-500/30 text-sky-200 font-bold">SB</span>}
                        {p.seat === hand.bbSeat && <span className="text-[9px] px-1 rounded bg-rose-500/30 text-rose-200 font-bold">BB</span>}
                        <span className="text-[9px] text-slate-500 truncate">{seat?.styleId ? seat.styleId.toUpperCase() : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {((hand.phase === 'awarded' && p.status !== 'folded') || seat?.isHero) && (
                          <div className="flex gap-0.5">
                            {(holes[p.id] || []).map((c, i) => <CardChip key={i} card={c} fourColor={fourColor} />)}
                          </div>
                        )}
                        <div className="text-right leading-tight">
                          <div className="text-sm font-mono text-emerald-300">{formatChips(p.stack, unit, hand.bigBlind)}</div>
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[10px] text-slate-500">{p.lastAction?.type || ''}</span>
                            {p.currentBet > 0 && <span className="text-[10px] font-mono text-amber-300">{formatChips(p.currentBet, unit, hand.bigBlind)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-[#0f1319]/95 border-t border-slate-800 backdrop-blur">
              <div className="w-full max-w-xl mx-auto p-2.5 sm:p-3 space-y-2">
                {hand?.phase === 'awarded' ? (
                  <div className="text-center text-sm font-bold text-amber-300">
                    {[...new Set(hand.winners.map((w) => hand.players.find((p) => p.id === w.playerId)?.name))].join(', ')} wins {formatChips(hand.winners.reduce((s, w) => s + (w.amount || 0), 0), unit, hand.bigBlind)}
                  </div>
                ) : isHeroTurn ? (
                  <>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => act('fold')} title="Fold (F)" className="flex-1 py-3 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-rose-300 font-bold text-sm cursor-pointer">Fold</button>
                      {toCall > 0 ? (
                        <button type="button" onClick={() => act('call')} title="Call (C)" className="flex-1 py-3 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-emerald-300 font-medium text-sm cursor-pointer">
                          Call {formatChips(Math.min(toCall, hero.stack), unit, hand.bigBlind)}
                        </button>
                      ) : (
                        <button type="button" onClick={() => act('check')} title="Check (C)" className="flex-1 py-3 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-emerald-300 font-medium text-sm cursor-pointer">Check</button>
                      )}
                      <button type="button" onClick={() => act(toCall > 0 ? 'raise' : 'bet', maxRaiseTo)} title="All in (Shift + A)" className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-black text-sm cursor-pointer">
                        All in
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        ref={raiseInputRef}
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
                      {[0.5, 0.75, 1].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => submitRaise(Math.round((hand.currentBet || 0) + Math.max(pot * f, minRaiseTo - (hand.currentBet || 0))))}
                          className="px-3 py-2 rounded-xl bg-[#222834] hover:bg-[#2d3545] border border-slate-700/60 text-[11px] font-semibold cursor-pointer"
                        >
                          {f === 0.5 ? '½ pot' : f === 0.75 ? '¾ pot' : 'Pot'}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-3">
                    {hand ? (paused ? 'Paused' : `${hand.players[hand.currentPlayer]?.name || 'Waiting'} is acting…`) : 'Dealing…'}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

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
                  <div key={i} className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2">
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
                  <button key={u} type="button" onClick={() => setUnit(u)} className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${unit === u ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                    {u === 'chips' ? 'Chips' : 'Big blinds'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Deck colours</div>
              <div className="grid grid-cols-2 gap-2">
                {[2, 4].map((n) => (
                  <button key={n} type="button" onClick={() => setFourColor(n === 4)} className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${(n === 4) === fourColor ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                    {n} colour
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setShowSettings(false)} className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer">Done</button>
          </div>
        </div>
      )}

      {showStructure && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowStructure(false)}>
          <div className="bg-[#141922] border border-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Structure setup</h3>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Speed</div>
              <div className="grid grid-cols-2 gap-2">
                {BOT_SPEEDS.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      setSetup((s) => ({ ...s, speed: sp.id }));
                      setGame((g) => (g ? { ...g, speed: sp.id, handsTarget: handsPerLevel(sp.id, g.seats.filter((s) => !s.eliminated).length) } : g));
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${setup?.speed === sp.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Every level antes one big blind (BBA). Hands per level are recalculated when a level changes.</p>
            </div>
            <div className="space-y-1">
              {levels.map((l, i) => (
                <div key={i} className={`flex items-center justify-between text-[11px] px-2 py-1 rounded ${game?.levelIndex === i ? 'bg-emerald-900/40 text-emerald-200' : 'text-slate-400'}`}>
                  <span>Level {i + 1}</span>
                  <span className="font-mono">{l.sb.toLocaleString('en-US')}/{l.bb.toLocaleString('en-US')} ({l.ante.toLocaleString('en-US')})</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowStructure(false)} className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer">Done</button>
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
                className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl border cursor-pointer ${game?.levelIndex === i ? 'border-emerald-500 bg-emerald-600/20 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
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
            <p className="text-xs text-slate-400">The current game will be discarded.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowEnd(false)} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer">Keep playing</button>
              <button
                type="button"
                onClick={() => { setShowEnd(false); setSetup(null); setGame(null); setHand(null); setChampion(null); setHoles({}); }}
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
