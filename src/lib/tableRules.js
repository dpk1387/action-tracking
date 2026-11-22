// Table rules shared by GO mode and Play Bots: minimum chip per blind level,
// stack/bet display rounding for the online and live styles, and bet shortcuts.

export const GAME_TYPES = [
  { id: 'online', label: 'Online', desc: 'Exact stacks, pot size shown.' },
  { id: 'live', label: 'Live', desc: 'Live feel: pot hidden, stacks and bets rounded to real chips.' },
];

// Minimum chip for a level, keyed by the big blind. Tiers follow the standard
// structures: 25/50-250/500 -> 25, 300/600-800/1600 -> 100, ... 75K/150K -> 25K.
// A structure that uses 80K/160K keeps the 5K chip, so 160K stays at 5K and the
// 25K chip starts at 100K/200K.
const MIN_CHIP_TIERS = [
  { maxBb: 500, chip: 25 },
  { maxBb: 1600, chip: 100 },
  { maxBb: 8000, chip: 500 },
  { maxBb: 20000, chip: 1000 },
  { maxBb: 160000, chip: 5000 },
  { maxBb: Infinity, chip: 25000 },
];

export function minChipForBlinds(bigBlind) {
  const bb = Number(bigBlind) || 0;
  if (bb <= 0) return 25;
  // 75K/150K sits above the 80K/160K tier boundary but uses the 25K chip.
  if (bb === 150000) return 25000;
  const tier = MIN_CHIP_TIERS.find((t) => bb <= t.maxBb);
  return tier ? tier.chip : 25000;
}

export function roundToNearest(value, step) {
  const s = Number(step) || 1;
  if (s <= 1) return Math.round(Number(value) || 0);
  return Math.round((Number(value) || 0) / s) * s;
}

export function roundUpTo(value, step) {
  const s = Number(step) || 1;
  if (s <= 1) return Math.ceil(Number(value) || 0);
  return Math.ceil((Number(value) || 0) / s) * s;
}

/**
 * Version of a hand rounded to a new minimum chip. Bet sizes go to the nearest
 * chip; stacks round up, the way a live color-up tops players up to the new
 * smallest chip.
 */
export function roundHandToMinChip(hand, minChip) {
  const step = Number(minChip) || 1;
  if (!hand || step <= 1) return hand;
  const bets = ['currentBet', 'lastRaiseAmount', 'pot', 'lastBet'];
  let changed = false;
  const next = { ...hand };
  for (const key of bets) {
    if (typeof hand[key] === 'number' && hand[key] > 0) {
      const rounded = roundToNearest(hand[key], step);
      if (rounded !== hand[key]) {
        next[key] = rounded;
        changed = true;
      }
    }
  }
  if (Array.isArray(hand.players)) {
    const players = hand.players.map((p) => {
      const stack = p.stack > 0 ? roundUpTo(p.stack, step) : p.stack;
      const currentBet = p.currentBet > 0 ? roundToNearest(p.currentBet, step) : p.currentBet;
      const totalBet = p.totalBet > 0 ? roundToNearest(p.totalBet, step) : p.totalBet;
      if (stack === p.stack && currentBet === p.currentBet && totalBet === p.totalBet) return p;
      changed = true;
      return { ...p, stack, currentBet, totalBet };
    });
    if (players.some((p, i) => p !== hand.players[i])) next.players = players;
  }
  return changed ? next : hand;
}

// Stack display for the live style, by depth in big blinds (bots only; the hero
// always gets exact values). Returns { chips, bb } display strings.
function liveStackStep(stackChips, bb, unit, minChip) {
  const depth = bb > 0 ? stackChips / bb : 0;
  if (unit === 'bb') {
    if (depth < 10) return { step: 0.5, decimals: 1 };
    if (depth < 40) return { step: 5, decimals: 0 };
    if (depth < 100) return { step: 10, decimals: 0 };
    return { step: 20, decimals: 0 };
  }
  if (depth < 10) return { step: 1, decimals: 0 };
  if (depth < 40) return { step: 10 * minChip, decimals: 0 };
  if (depth < 100) return { step: 20 * minChip, decimals: 0 };
  return { step: 50 * minChip, decimals: 0 };
}

function fmtChips(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

function fmtBb(n) {
  const v = Number(n) || 0;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} bb`;
}

/**
 * How a stack is shown at the table.
 * online  - chips to the nearest 25, big blinds to 0.1
 * live    - bots rounded by depth, the hero exact (chips) / 0.1 bb; an all-in
 *           stack is always exact so the shove can be counted down.
 */
export function displayStack({ value, unit, bb, gameType = 'online', isHero = false, allIn = false, minChip = 25 }) {
  const raw = Math.max(0, Number(value) || 0);
  const bblind = Number(bb) || 1;
  const chips = raw;
  if (gameType !== 'live') {
    if (unit === 'bb') return fmtBb(Math.round((chips / bblind) * 10) / 10);
    // Chip view online shows the real number: no chip rounding, nothing to hide.
    return fmtChips(chips);
  }
  if (unit === 'bb') {
    if (isHero || allIn) return fmtBb(Math.round((chips / bblind) * 10) / 10);
    const { step, decimals } = liveStackStep(chips, bblind, 'bb', minChip);
    const rounded = roundToNearest(chips / bblind, step);
    return decimals ? `${rounded.toFixed(decimals)} bb` : `${Math.round(rounded)} bb`;
  }
  if (isHero || allIn) return fmtChips(chips);
  const { step } = liveStackStep(chips, bblind, 'chips', minChip);
  return fmtChips(roundToNearest(chips, step));
}

/** Bet size: exact chips in live play (bets are already rounded), 0.1 bb in bb view. */
export function displayBet({ value, unit, bb }) {
  const v = Math.max(0, Number(value) || 0);
  if (unit === 'bb') return fmtBb(Math.round((v / (Number(bb) || 1)) * 10) / 10);
  return fmtChips(v);
}

/**
 * Bet-size shortcut buttons for the current spot.
 * Returns [{ id, label, amount }] with amounts already clamped to the legal
 * raise range. Postflop shortcuts below the minimum bet/raise are dropped; the
 * minimum itself is always kept.
 */
export function betShortcuts({ street, currentBet = 0, bigBlind = 1, pot = 0, minRaiseTo = 0, maxRaiseTo = 0, minChip = 1 }) {
  const bb = Number(bigBlind) || 1;
  const max = Number(maxRaiseTo) || 0;
  const min = Number(minRaiseTo) || 0;
  const facing = Number(currentBet) || 0;
  const out = [];
  const chip = Math.max(1, Number(minChip) || 1);
  const push = (id, label, amount) => {
    const raw = roundToNearest(amount, chip);
    if (raw < min) return;
    const clamped = max > 0 ? Math.min(raw, max) : raw;
    out.push({ id, label, amount: clamped });
  };

  if (street === 'preflop') {
    const rfi = facing <= bb;
    const mults = rfi ? [2, 2.2, 2.5, 3] : [2.2, 2.5, 3, 3.5, 4];
    mults.forEach((m) => {
      const base = rfi ? bb : facing;
      push(`${m}x`, `${m}x`, base * m);
    });
    return out;
  }

  push('min', 'Min', min);
  const fractions = [
    ['1/3', '⅓ pot', 1 / 3],
    ['1/2', '½ pot', 0.5],
    ['3/4', '¾ pot', 0.75],
    ['pot', 'Pot', 1],
    ['1.5x', '1.5x pot', 1.5],
  ];
  fractions.forEach(([id, label, frac]) => {
    push(id, label, facing + pot * frac);
  });
  return out;
}
