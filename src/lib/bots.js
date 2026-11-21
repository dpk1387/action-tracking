import { calcEquity } from '@/lib/poker';

export const BOT_DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', desc: 'Calls too much, rarely bluffs, makes mistakes.' },
  { id: 'easy', label: 'Easy', desc: 'Loose and predictable, punishes only obvious mistakes.' },
  { id: 'medium', label: 'Medium', desc: 'Solid fundamentals with occasional leaks.' },
  { id: 'hard', label: 'Hard', desc: 'Tight-aggressive with balanced bluffing.' },
  { id: 'pro', label: 'Pro', desc: 'Reads equity well and applies pressure.' },
  { id: 'gto', label: 'GTO', desc: 'Pot-based, balanced frequencies computed from equity.' },
];

export const BOT_STYLES = [
  { id: 'random', label: 'Random', desc: 'Random style each session' },
  { id: 'lag', label: 'LAG', desc: 'Loose aggressive' },
  { id: 'tag', label: 'TAG', desc: 'Tight aggressive' },
  { id: 'loose_passive', label: 'Loose-passive', desc: 'Lots of calls, little raising' },
  { id: 'tight_passive', label: 'Tight-passive', desc: 'Waits for big hands' },
  { id: 'calling_station', label: 'Calling station', desc: 'Calls nearly anything' },
  { id: 'nit', label: 'Nit', desc: 'Extremely tight' },
  { id: 'fish', label: 'Fish', desc: 'Weak, spazzy play' },
  { id: 'shark', label: 'Shark', desc: 'Strong, aggressive, tricky' },
  { id: 'rec', label: 'REC', desc: 'Recreational: plays too many hands, calls wide, rarely raises' },
];

// Short badges used when playstyles are shown at the table.
export const STYLE_SHORT = {
  lag: 'LAG',
  tag: 'TAG',
  loose_passive: 'LP',
  tight_passive: 'TP',
  calling_station: 'CS',
  nit: 'NIT',
  fish: 'FISH',
  shark: 'SHARK',
  rec: 'REC',
  random: 'MIX',
};

export const BOT_SPEEDS = [
  { id: 'slow', label: 'Slow', handsPerPlayer: 4.5 },
  { id: 'regular', label: 'Regular', handsPerPlayer: 3 },
  { id: 'turbo', label: 'Turbo', handsPerPlayer: 1.75 },
  { id: 'hyper', label: 'Hyper-turbo', handsPerPlayer: 1 },
];

// Every bot move takes the same 0.7s; the speed choice only changes how many
// hands each blind level lasts.
export const BOT_THINK_MS = 700;

const STANDARD_BLINDS = [
  [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [250, 500],
  [300, 600], [400, 800], [500, 1000], [600, 1200], [800, 1600], [1000, 2000],
  [1500, 3000], [2000, 4000], [2500, 5000], [3000, 6000], [4000, 8000],
  [5000, 10000], [6000, 12000],
];

const HYPER_BLINDS = [
  [25, 50], [50, 100], [100, 200], [150, 300], [250, 500], [400, 800], [600, 1200],
  [1000, 2000], [1500, 3000], [2500, 5000], [4000, 8000], [6000, 12000], [10000, 20000],
];

export function blindLevelsForSpeed(speedId) {
  const rows = speedId === 'hyper' ? HYPER_BLINDS : STANDARD_BLINDS;
  return rows.map(([sb, bb]) => ({ sb, bb, ante: bb }));
}

export function handsPerLevel(speedId, playerCount) {
  const speed = BOT_SPEEDS.find((s) => s.id === speedId) || BOT_SPEEDS[1];
  return Math.max(1, Math.round(speed.handsPerPlayer * Math.max(2, playerCount)));
}

export function thinkDelay() {
  return BOT_THINK_MS;
}

/** Index of the level to start on for a stack of `bb` big blinds. */
export function startLevelForStack(stackBb, levels) {
  return 0;
}

export function formatBlindLevel(levels, levelIndex) {
  const lvl = levels[Math.min(levelIndex, levels.length - 1)];
  if (!lvl) return '';
  const fmt = (n) => n.toLocaleString('en-US');
  return `${fmt(lvl.sb)}/${fmt(lvl.bb)} (${fmt(lvl.ante)})`;
}

/**
 * Dead-button seat rotation.
 * The button always moves to the seat that posted the small blind, the small
 * blind moves to the seat that posted the big blind (which may now be empty =
 * dead small blind), and the big blind goes to the next occupied seat after the
 * old big blind seat. Nobody is skipped and nobody posts the big blind twice.
 */
export function nextBlindSeats({ ring, activeSeats, buttonSeat, sbSeat, bbSeat }) {
  const active = new Set(activeSeats);
  if (active.size <= 1) return { buttonSeat, sbSeat, bbSeat };
  if (active.size === 2) {
    // Heads-up: the button posts the small blind, so the seat that just posted
    // the big blind becomes the new button. This also covers the 3-handed to
    // heads-up changeover: the two survivors did not both pay the BB, and the
    // ex-BB takes the button/SB while the other posts the BB.
    const others = ring.filter((s) => active.has(s));
    const newButton = [bbSeat, sbSeat].find((s) => s != null && active.has(s)) ?? others[0];
    const other = others.find((s) => s !== newButton);
    return { buttonSeat: newButton, sbSeat: newButton, bbSeat: other, deadSb: false, deadBb: false, headsUp: true };
  }
  const seatAfter = (seat) => {
    const i = ring.indexOf(seat);
    if (i === -1) return ring.find((s) => active.has(s));
    for (let k = 1; k <= ring.length; k++) {
      const s = ring[(i + k) % ring.length];
      if (active.has(s)) return s;
    }
    return null;
  };
  const newButton = buttonSeat == null ? ring.find((s) => active.has(s)) : sbSeat;
  const newSb = bbSeat;
  const newBb = newSb == null ? null : seatAfter(newSb);
  return {
    buttonSeat: newButton,
    sbSeat: newSb,
    bbSeat: newBb,
    deadSb: newSb == null || !active.has(newSb),
    deadBb: newBb == null,
  };
}

// callBonus = extra slack against the raw pot odds (loose callers need less
// equity, nits need more). aggro = how often a betting opportunity is taken.
const STYLE_PROFILES = {
  lag: { open: 0.42, call: 0.36, raise: 0.56, bluff: 0.2, size: 0.85, callBonus: 0, aggro: 0.75 },
  tag: { open: 0.5, call: 0.46, raise: 0.63, bluff: 0.1, size: 0.7, callBonus: -0.03, aggro: 0.6 },
  loose_passive: { open: 0.34, call: 0.27, raise: 0.82, bluff: 0.03, size: 0.45, callBonus: 0.1, aggro: 0.15 },
  tight_passive: { open: 0.52, call: 0.44, raise: 0.86, bluff: 0.02, size: 0.45, callBonus: 0.02, aggro: 0.2 },
  calling_station: { open: 0.3, call: 0.2, raise: 0.94, bluff: 0.01, size: 0.4, callBonus: 0.18, aggro: 0.08 },
  nit: { open: 0.62, call: 0.58, raise: 0.74, bluff: 0.01, size: 0.6, callBonus: -0.05, aggro: 0.25 },
  fish: { open: 0.3, call: 0.38, raise: 0.52, bluff: 0.13, size: 0.5, callBonus: 0.12, extraNoise: 0.05, aggro: 0.4 },
  shark: { open: 0.46, call: 0.44, raise: 0.56, bluff: 0.17, size: 0.78, callBonus: 0, aggro: 0.7 },
  rec: { open: 0.26, call: 0.34, raise: 0.84, bluff: 0.06, size: 0.45, callBonus: 0.14, extraNoise: 0.04, aggro: 0.12 },
};

const DIFFICULTY_TUNING = {
  beginner: { noise: 0.16, iters: 80, bluffMul: 0.5, mistake: 0.1 },
  easy: { noise: 0.11, iters: 120, bluffMul: 0.8, mistake: 0.05 },
  medium: { noise: 0.07, iters: 200, bluffMul: 1, mistake: 0.02 },
  hard: { noise: 0.04, iters: 300, bluffMul: 1.2, mistake: 0 },
  pro: { noise: 0.02, iters: 400, bluffMul: 1.3, mistake: 0 },
  gto: { noise: 0, iters: 500, bluffMul: 1.4, mistake: 0 },
};

export function resolveStyle(styleId, rng = Math.random) {
  if (styleId && styleId !== 'random' && STYLE_PROFILES[styleId]) return styleId;
  const ids = Object.keys(STYLE_PROFILES);
  return ids[Math.floor(rng() * ids.length)];
}

/** Parse one style count: "2" (exact) or "2-3" (range). Blank means 0. */
export function parseStyleSpec(text) {
  const t = String(text ?? '').trim();
  if (!t) return { min: 0, max: 0 };
  const m = t.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] == null ? min : Number(m[2]);
  if (max < min) return null;
  return { min, max };
}

/**
 * Turn per-style counts/ranges into one style per bot.
 * Bots not covered by the counts are filled in as random players, so the mix
 * always fills the table; only impossible or malformed counts are an error.
 */
export function assignStyles(specs, count, rng = Math.random) {
  const parsed = {};
  let minSum = 0;
  for (const [id, text] of Object.entries(specs || {})) {
    const spec = parseStyleSpec(text);
    const label = BOT_STYLES.find((s) => s.id === id)?.label || id;
    if (!spec) return { error: `${label}: use a number like 2 or a range like 2-3.` };
    parsed[id] = spec;
    minSum += spec.min;
  }
  if (minSum > count) {
    return { error: `Those counts need at least ${minSum} bots, but the table has ${count}.` };
  }
  const counts = {};
  Object.entries(parsed).forEach(([id, spec]) => { counts[id] = spec.min; });
  let budget = count - minSum;
  // Ranges take the leftover seats first, then anything still open goes random.
  let guard = 0;
  while (budget > 0 && guard++ < 1000) {
    const room = Object.keys(parsed).filter((id) => counts[id] < parsed[id].max);
    if (!room.length) break;
    const pick = room[Math.floor(rng() * room.length)];
    counts[pick] += 1;
    budget -= 1;
  }
  const pool = [];
  Object.entries(counts).forEach(([id, n]) => { for (let i = 0; i < n; i++) pool.push(id); });
  while (pool.length < count) pool.push('random');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { styles: pool };
}

export function styleProfile(styleId) {
  return STYLE_PROFILES[styleId] || STYLE_PROFILES.tag;
}

function liveOpponents(hand, playerId) {
  return hand.players.filter((p) => p.id !== playerId && p.status !== 'folded' && p.status !== 'out' && p.status !== 'eliminated');
}

/**
 * Decide an action for one bot.
 * Returns { type: 'fold'|'check'|'call'|'raise', amount } where amount is the
 * total raise-to amount.
 */
export function decideBotAction({ hand, playerIndex, holeCards, styleId, difficulty, rng = Math.random }) {
  const cp = hand.players[playerIndex];
  if (!cp || !holeCards || holeCards.length === 0) return { type: 'check' };
  const tuning = DIFFICULTY_TUNING[difficulty] || DIFFICULTY_TUNING.medium;
  const profile = styleProfile(styleId);
  const noise = tuning.noise + (profile.extraNoise || 0);

  const opponents = liveOpponents(hand, cp.id);
  const pot = hand.players.reduce((s, p) => s + (p.totalBet || 0), 0);
  const toCall = Math.max(0, (hand.currentBet || 0) - (cp.currentBet || 0));
  const stack = cp.stack || 0;
  const board = (hand.communityCards || []).filter((c) => c && !c.hidden);
  const street = hand.street || 'preflop';

  let rawEquity;
  try {
    const holes = [holeCards, ...opponents.map(() => null)];
    const res = calcEquity(holes, board, tuning.iters, hand.variant || 'nlh');
    const r = res?.results?.[0] || {};
    rawEquity = ((r.win || 0) + (res?.split || 0) / 2) / 100;
  } catch (_) {
    rawEquity = 0.5 / Math.max(1, opponents.length);
  }
  let equity = rawEquity + (rng() * 2 - 1) * noise;
  equity = Math.max(0.02, Math.min(0.98, equity));

  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const minRaiseTo = (hand.currentBet || 0) + Math.max(hand.lastRaiseAmount || hand.bigBlind || 1, hand.bigBlind || 1);
  const maxRaiseTo = cp.currentBet + stack;

  const makeRaise = (fraction) => {
    const target = Math.round((hand.currentBet || 0) + Math.max(pot * fraction, minRaiseTo - (hand.currentBet || 0)));
    const clamped = Math.min(Math.max(target, minRaiseTo), maxRaiseTo);
    if (clamped <= (hand.currentBet || 0)) return { type: 'call' };
    return { type: 'raise', amount: clamped };
  };

  if (tuning.mistake > 0 && rng() < tuning.mistake) {
    const roll = rng();
    if (toCall <= 0) return roll < 0.5 ? { type: 'check' } : makeRaise(0.5);
    if (roll < 0.35) return { type: 'fold' };
    if (roll < 0.8) return { type: 'call' };
    return makeRaise(0.6);
  }

  const streetSize = street === 'preflop' ? 0.55 : street === 'flop' ? 1 : 1.1;
  const betFraction = Math.max(0.25, profile.size * streetSize * (0.85 + rng() * 0.3));

  if (toCall <= 0) {
    const bluffChance = profile.bluff * tuning.bluffMul * (opponents.length <= 2 ? 1 : 0.6);
    if (equity >= profile.open) {
      // Very strong: sometimes shove for value.
      if (equity > 0.82 && stack < pot * 2.5 && rng() < 0.5) return { type: 'raise', amount: maxRaiseTo };
      if (rng() < profile.aggro) return makeRaise(betFraction);
      return { type: 'check' };
    }
    if (rng() < bluffChance) return makeRaise(betFraction * 0.9);
    return { type: 'check' };
  }

  // callBonus is slack: a loose caller (calling station, fish) needs less equity
  // than the raw pot odds, a nit needs more.
  const callThreshold = potOdds - profile.callBonus;
  if (equity < callThreshold) {
    const cheap = toCall <= (hand.bigBlind || 1) * 0.5;
    if (cheap && equity > potOdds * 0.6) return { type: 'call' };
    if (equity < callThreshold - 0.18) return { type: 'fold' };
    return rng() < 0.25 ? { type: 'call' } : { type: 'fold' };
  }

  // Aggressive styles raise with a thin edge over the calling line, not only with
  // premium equity; passive styles still need the absolute raise threshold.
  const raiseLine = Math.min(profile.raise, callThreshold + 0.06);
  if (equity >= raiseLine && rng() < 0.35 + profile.aggro * 0.6) {
    if (equity > 0.8 && maxRaiseTo > 0 && (stack <= pot * 1.6 || rng() < 0.4)) {
      return { type: 'raise', amount: maxRaiseTo };
    }
    return makeRaise(betFraction);
  }
  if (rng() < profile.bluff * tuning.bluffMul * 0.5 * (0.5 + profile.aggro)) return makeRaise(betFraction * 0.8);
  return { type: 'call' };
}
