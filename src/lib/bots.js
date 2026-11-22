import { decideBotAction as decideFromRanges } from '@/lib/botStrategy';

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
  { id: 'nit', label: 'Nit', desc: 'Extremely tight' },
  { id: 'tag', label: 'TAG', desc: 'Tight aggressive' },
  { id: 'lag', label: 'LAG', desc: 'Loose aggressive' },
  { id: 'shark', label: 'Shark', desc: 'Strong, aggressive, tricky' },
  { id: 'calling_station', label: 'Calling station', desc: 'Calls nearly anything' },
  { id: 'rock', label: 'Rock', desc: 'Tight passive: waits for big hands' },
  { id: 'maniac', label: 'Maniac', desc: 'Raises constantly with a very wide range' },
  { id: 'sss', label: 'Short stack specialist', desc: 'Shoves or folds below 20 BB, avoids postflop spots' },
];

// Short badges used when playstyles are shown at the table.
export const STYLE_SHORT = {
  lag: 'LAG',
  tag: 'TAG',
  calling_station: 'LP',
  rock: 'TP',
  nit: 'NIT',
  shark: 'SHARK',
  maniac: 'MANIAC',
  sss: 'SSS',
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

// Ranges are shares of all starting hands (0.19 = the best 19%). openPct is a
// late-position opening range and is tightened in early seats by the strategy.
// betLine is the postflop strength that bets, raiseGuard the reluctance to
// raise a second time, callBonus the slack against raw pot odds.
const STYLE_PROFILES = {
  nit: { openPct: 0.13, limpPct: 0.04, threeBetPct: 0.03, coldCallPct: 0.05, fourBetPct: 0.015, callVs3Bet: 0.05, betLine: 0.62, raiseGuard: 0.35, bluff: 0.02, size: 0.6, callBonus: -0.06, aggro: 0.3, maxRaises: 1, reRaiseStep: 0.16 },
  tag: { openPct: 0.19, limpPct: 0.05, threeBetPct: 0.055, coldCallPct: 0.075, fourBetPct: 0.025, callVs3Bet: 0.07, betLine: 0.55, raiseGuard: 0.2, bluff: 0.09, size: 0.7, callBonus: -0.02, aggro: 0.55, maxRaises: 2, reRaiseStep: 0.1 },
  lag: { openPct: 0.30, limpPct: 0.08, threeBetPct: 0.10, coldCallPct: 0.12, fourBetPct: 0.04, callVs3Bet: 0.10, betLine: 0.48, raiseGuard: 0.1, bluff: 0.2, size: 0.8, callBonus: 0, aggro: 0.75, maxRaises: 3, reRaiseStep: 0.07 },
  shark: { openPct: 0.24, limpPct: 0.05, threeBetPct: 0.06, coldCallPct: 0.11, fourBetPct: 0.035, callVs3Bet: 0.085, betLine: 0.5, raiseGuard: 0.15, bluff: 0.17, size: 0.75, callBonus: 0, aggro: 0.68, maxRaises: 2, reRaiseStep: 0.09 },
  calling_station: { openPct: 0.32, limpPct: 0.30, threeBetPct: 0.01, coldCallPct: 0.38, fourBetPct: 0.005, callVs3Bet: 0.15, betLine: 0.7, raiseGuard: 0.5, bluff: 0.01, size: 0.4, callBonus: 0.16, aggro: 0.08, maxRaises: 1, reRaiseStep: 0.2 },
  rock: { openPct: 0.14, limpPct: 0.08, threeBetPct: 0.03, coldCallPct: 0.10, fourBetPct: 0.015, callVs3Bet: 0.06, betLine: 0.6, raiseGuard: 0.4, bluff: 0.02, size: 0.45, callBonus: 0.02, aggro: 0.2, maxRaises: 1, reRaiseStep: 0.18 },
  maniac: { openPct: 0.55, limpPct: 0.10, threeBetPct: 0.22, coldCallPct: 0.28, fourBetPct: 0.08, callVs3Bet: 0.16, betLine: 0.38, raiseGuard: 0, bluff: 0.3, size: 0.95, callBonus: 0.02, extraNoise: 0.06, aggro: 0.9, maxRaises: 4, reRaiseStep: 0.05 },
  sss: { openPct: 0.22, limpPct: 0.02, threeBetPct: 0.08, coldCallPct: 0.04, fourBetPct: 0.03, callVs3Bet: 0.06, betLine: 0.6, raiseGuard: 0.15, bluff: 0.05, size: 0.9, callBonus: -0.02, aggro: 0.7, maxRaises: 2, reRaiseStep: 0.08, shortStack: true },
};

// Each playstyle ships 13 profiles with neutral names and slightly different
// frequencies, so two nits at the same table do not play identically.
export const BOT_PROFILE_COUNT = 13;

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Rowan', 'Sage', 'Drew', 'Reese'];
const LAST_NAMES = {
  nit: 'Bennett',
  tag: 'Carter',
  lag: 'Diaz',
  shark: 'Ellis',
  calling_station: 'Foster',
  rock: 'Gray',
  maniac: 'Hayes',
  sss: 'Iverson',
};

// Multiplicative offsets that shape one profile out of its style baseline.
const PROFILE_JITTER = [0, 0.05, -0.05, 0.09, -0.09, 0.13, -0.13, 0.03, -0.03, 0.07, -0.07, 0.11, -0.11];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function buildProfile(base, m) {
  return {
    ...base,
    openPct: clamp(base.openPct * (1 + m), 0.03, 0.75),
    limpPct: clamp(base.limpPct * (1 + m * 0.6), 0, 0.4),
    threeBetPct: clamp(base.threeBetPct * (1 - m * 0.5), 0.005, 0.3),
    coldCallPct: clamp(base.coldCallPct * (1 + m * 0.4), 0.02, 0.5),
    fourBetPct: clamp(base.fourBetPct * (1 - m * 0.5), 0.002, 0.12),
    bluff: clamp((base.bluff ?? 0.05) * (1 + m), 0, 0.4),
    aggro: clamp(base.aggro * (1 + m * 0.5), 0.02, 0.98),
  };
}

/** All 13 profiles for one playstyle: stable ids, neutral names, varied stats. */
export function botProfilesForStyle(styleId) {
  const baseId = STYLE_PROFILES[styleId] ? styleId : 'tag';
  const base = STYLE_PROFILES[baseId];
  return Array.from({ length: BOT_PROFILE_COUNT }, (_, i) => ({
    id: `${baseId}-${i + 1}`,
    styleId: baseId,
    name: `${FIRST_NAMES[i]} ${LAST_NAMES[baseId]}`,
    profile: buildProfile(base, PROFILE_JITTER[i]),
  }));
}

export function findBotProfile(profileId) {
  if (!profileId) return null;
  const styleId = String(profileId).replace(/-\d+$/, '');
  return botProfilesForStyle(styleId).find((p) => p.id === profileId) || null;
}

/**
 * Pick a distinct profile for every bot. Bots sharing a style get different
 * profiles from that style's 13 before any profile is reused.
 */
export function assignProfiles(styleIds, rng = Math.random) {
  const used = {};
  return (styleIds || []).map((styleId) => {
    const profiles = botProfilesForStyle(resolveStyle(styleId, rng));
    const taken = used[profiles[0].styleId] || new Set();
    let candidates = profiles.filter((p) => !taken.has(p.id));
    if (!candidates.length) candidates = profiles;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    taken.add(pick.id);
    used[profiles[0].styleId] = taken;
    return pick;
  });
}

// Live tables play a touch looser and 3-bet less than online ones.
export function liveTuning(profile) {
  return {
    ...profile,
    openPct: clamp(profile.openPct * 1.06, 0.03, 0.8),
    limpPct: clamp(profile.limpPct * 1.06, 0, 0.4),
    threeBetPct: profile.threeBetPct * 0.8,
    fourBetPct: profile.fourBetPct * 0.85,
    coldCallPct: clamp(profile.coldCallPct * 1.04, 0.02, 0.55),
  };
}

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

/**
 * Decide an action for one bot. Ranges and sizing live in botStrategy; this
 * wrapper resolves the style and applies the difficulty tuning.
 */
export function decideBotAction({ hand, playerIndex, holeCards, styleId, difficulty, profile, live = false, rng = Math.random }) {
  const tuning = DIFFICULTY_TUNING[difficulty] || DIFFICULTY_TUNING.medium;
  let resolved = profile || styleProfile(resolveStyle(styleId, rng));
  if (live) resolved = liveTuning(resolved);
  return decideFromRanges({ hand, playerIndex, holeCards, profile: resolved, tuning, rng });
}
