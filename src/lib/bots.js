import { decideBotAction as decideFromRanges } from '@/lib/botStrategy';

export const BOT_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', desc: 'Ignores position and pot odds, overvalues weak pairs, erratic sizing.' },
  { id: 'medium', label: 'Medium', desc: 'Position-aware, shove-or-fold short, c-bets dry boards, respects pot odds.' },
  { id: 'hard', label: 'Hard', desc: 'Clean charts, stack-scaled sizing, texture-aware c-bets, reads HUD leaks.' },
  { id: 'pro', label: 'Pro', desc: 'Nash push/fold, geometric sizing, blockers and real-time counter-exploits.' },
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
  nit: { openPct: 0.16, limpPct: 0.02, threeBetPct: 0.04, coldCallPct: 0.06, fourBetPct: 0.015, callVs3Bet: 0.055, betLine: 0.62, raiseGuard: 0.35, bluff: 0.02, size: 0.6, callBonus: -0.06, aggro: 0.35, maxRaises: 1, reRaiseStep: 0.16 },
  tag: { openPct: 0.25, limpPct: 0.02, threeBetPct: 0.08, coldCallPct: 0.14, fourBetPct: 0.032, callVs3Bet: 0.095, betLine: 0.55, raiseGuard: 0.2, bluff: 0.09, size: 0.7, callBonus: -0.02, aggro: 0.58, maxRaises: 2, reRaiseStep: 0.1 },
  lag: { openPct: 0.38, limpPct: 0.04, threeBetPct: 0.13, coldCallPct: 0.20, fourBetPct: 0.05, callVs3Bet: 0.13, betLine: 0.48, raiseGuard: 0.1, bluff: 0.2, size: 0.8, callBonus: 0, aggro: 0.76, maxRaises: 3, reRaiseStep: 0.07 },
  shark: { openPct: 0.30, limpPct: 0.02, threeBetPct: 0.095, coldCallPct: 0.16, fourBetPct: 0.042, callVs3Bet: 0.11, betLine: 0.5, raiseGuard: 0.15, bluff: 0.17, size: 0.75, callBonus: 0, aggro: 0.7, maxRaises: 2, reRaiseStep: 0.09 },
  calling_station: { openPct: 0.11, limpPct: 0.50, threeBetPct: 0.015, coldCallPct: 0.58, fourBetPct: 0.005, callVs3Bet: 0.26, betLine: 0.7, raiseGuard: 0.5, bluff: 0.01, size: 0.4, callBonus: 0.18, aggro: 0.08, maxRaises: 1, reRaiseStep: 0.2 },
  rock: { openPct: 0.12, limpPct: 0.14, threeBetPct: 0.025, coldCallPct: 0.16, fourBetPct: 0.012, callVs3Bet: 0.065, betLine: 0.6, raiseGuard: 0.4, bluff: 0.02, size: 0.45, callBonus: 0.02, aggro: 0.2, maxRaises: 1, reRaiseStep: 0.18 },
  maniac: { openPct: 0.60, limpPct: 0.06, threeBetPct: 0.26, coldCallPct: 0.35, fourBetPct: 0.10, callVs3Bet: 0.20, betLine: 0.38, raiseGuard: 0, bluff: 0.3, size: 0.95, callBonus: 0.02, extraNoise: 0.06, aggro: 0.92, maxRaises: 4, reRaiseStep: 0.05 },
  sss: { openPct: 0.25, limpPct: 0.01, threeBetPct: 0.09, coldCallPct: 0.09, fourBetPct: 0.035, callVs3Bet: 0.075, betLine: 0.6, raiseGuard: 0.15, bluff: 0.05, size: 0.9, callBonus: -0.02, aggro: 0.7, maxRaises: 2, reRaiseStep: 0.08, shortStack: true },
};

// Each playstyle ships 13 profiles with neutral names and slightly different
// frequencies, so two nits at the same table do not play identically.
export const BOT_PROFILE_COUNT = 13;

const STYLE_NAMES = {
  nit: ['Elijah', 'Amelia', 'Elias', 'Penelope', 'Benjamin', 'Lainey', 'Liam', 'Camila', 'Maverick', 'Evelyn', 'Grayson', 'Nora', 'Asher'],
  tag: ['Levi', 'Aurora', 'James', 'Eliana', 'Julian', 'Mila', 'Cooper', 'Aria', 'Samuel', 'Ellie', 'Alexander', 'Luna', 'Nova'],
  lag: ['Theo', 'Emma', 'Leo', 'Lily', 'Lucas', 'Ivy', 'Muhammad', 'Scarlett', 'Hudson', 'Harper', 'Mateo', 'Gianna', 'Luke'],
  shark: ['Wyatt', 'Delilah', 'Oliver', 'Olivia', 'Noah', 'Stella', 'Waylon', 'Violet', 'Santiago', 'Avery', 'Luca', 'Willow', 'Elena'],
  calling_station: ['Weston', 'Ella', 'Carter', 'Sophia', 'Mason', 'Paisley', 'Sebastian', 'Iris', 'Josiah', 'Valentina', 'Isaiah', 'Layla', 'Daniel'],
  rock: ['Ezra', 'Ayla', 'Owen', 'Zoe', 'Ethan', 'Mia', 'Theodore', 'Sofia', 'Silas', 'Eleanor', 'Rowan', 'Elizabeth', 'Charlotte'],
  maniac: ['Gabriel', 'Isabella', 'Michael', 'Lucy', 'Jack', 'Amara', 'Bennett', 'Sadie', 'Ezekiel', 'Ava', 'Joseph', 'Abigail', 'Henry'],
  sss: ['Atlas', 'Isla', 'William', 'Chloe', 'Thomas', 'Hazel', 'Enzo', 'Riley', 'David', 'Zoey', 'Isaac', 'Emilia', 'Naomi'],
};

// Multiplicative offsets that shape one profile out of its style baseline.
const PROFILE_JITTER = [0, 0.05, -0.05, 0.09, -0.09, 0.13, -0.13, 0.03, -0.03, 0.07, -0.07, 0.11, -0.11];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function buildProfile(base, m) {
  return {
    ...base,
    openPct: clamp(base.openPct * (1 + m), 0.03, 0.78),
    limpPct: clamp(base.limpPct * (1 + m * 0.4), 0, 0.6),
    threeBetPct: clamp(base.threeBetPct * (1 - m * 0.5), 0.005, 0.32),
    coldCallPct: clamp(base.coldCallPct * (1 + m * 0.35), 0.02, 0.65),
    fourBetPct: clamp(base.fourBetPct * (1 - m * 0.5), 0.002, 0.14),
    bluff: clamp((base.bluff ?? 0.05) * (1 + m), 0, 0.4),
    aggro: clamp(base.aggro * (1 + m * 0.5), 0.02, 0.98),
  };
}

/** All 13 profiles for one playstyle: stable ids, short single names, varied stats. */
export function botProfilesForStyle(styleId) {
  const baseId = STYLE_PROFILES[styleId] ? styleId : 'tag';
  const base = STYLE_PROFILES[baseId];
  const names = STYLE_NAMES[baseId] || STYLE_NAMES.tag;
  return Array.from({ length: BOT_PROFILE_COUNT }, (_, i) => ({
    id: `${baseId}-${i + 1}`,
    styleId: baseId,
    name: names[i],
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

/**
 * Difficulty is more than an equity-noise knob. Each tier turns on a set of
 * behaviours in botStrategy: position awareness, short-stack push/fold, board
 * texture, draw odds, bet sizing, HUD reads and how often it blunders.
 */
const DIFFICULTY_TUNING = {
  easy: {
    noise: 0.16, iters: 70, bluffMul: 0.45, mistake: 0.30,
    positionAware: false, shortStack: 'none', texture: 'none', drawOdds: false,
    sizing: 'erratic', hud: 'none', hudMinHands: Infinity, maxRaises: 1,
    overvaluePairs: true, fitOrFold: true,
  },
  medium: {
    noise: 0.07, iters: 220, bluffMul: 1, mistake: 0.12,
    positionAware: true, shortStack: 'shove_fold', texture: 'basic', drawOdds: true,
    sizing: 'standard', hud: 'outliers', hudMinHands: 20, maxRaises: 2,
    overvaluePairs: false, fitOrFold: false,
  },
  hard: {
    noise: 0.035, iters: 400, bluffMul: 1.15, mistake: 0.04,
    positionAware: true, shortStack: 'charts', texture: 'sized', drawOdds: true,
    sizing: 'stack_scaled', hud: 'core', hudMinHands: 30, maxRaises: 3,
    overvaluePairs: false, fitOrFold: false,
  },
  pro: {
    noise: 0.015, iters: 700, bluffMul: 1.3, mistake: 0.005,
    positionAware: true, shortStack: 'charts_iso', texture: 'advanced', drawOdds: true,
    sizing: 'geometric', hud: 'full', hudMinHands: 8, maxRaises: 4,
    overvaluePairs: false, fitOrFold: false,
  },
};

export function difficultyTuning(id) {
  return DIFFICULTY_TUNING[id] || DIFFICULTY_TUNING.medium;
}

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
  const excluded = new Set();
  let minSum = 0;
  for (const [id, text] of Object.entries(specs || {})) {
    const raw = String(text ?? '').trim();
    const spec = parseStyleSpec(raw);
    const label = BOT_STYLES.find((s) => s.id === id)?.label || id;
    if (!spec) return { error: `${label}: use a number like 2 or a range like 2-3.` };
    parsed[id] = spec;
    minSum += spec.min;
    if (raw !== '' && spec.max === 0) {
      excluded.add(id);
    }
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
  if (pool.length < count) {
    const allowedStyles = Object.keys(STYLE_PROFILES).filter((id) => !excluded.has(id));
    if (!allowedStyles.length) {
      return { error: 'All playstyles are set to 0. Leave at least one blank or enter a count above 0.' };
    }
    while (pool.length < count) {
      pool.push(allowedStyles[Math.floor(rng() * allowedStyles.length)]);
    }
  }
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
export function decideBotAction({ hand, playerIndex, holeCards, styleId, difficulty, profile, hud = null, live = false, rng = Math.random }) {
  const tuning = difficultyTuning(difficulty);
  let resolved = profile || styleProfile(resolveStyle(styleId, rng));
  if (live) resolved = liveTuning(resolved);
  return decideFromRanges({ hand, playerIndex, holeCards, profile: resolved, tuning, hud, rng });
}
