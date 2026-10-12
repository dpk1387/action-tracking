// Chip-math utilities: determine which denominations are in play and whether a
// bet amount can be formed from them. Uses exact integer arithmetic (scaled to
// cents) and a coin-change reachability check.

function gcdFn(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

// Denominations still in play: all checked denominations minus those retired by
// chip-race breaks the timer has already passed (tLevel indexes the schedule).
export function chipsInPlay(hand) {
  const denoms =
    hand && Array.isArray(hand.chipDenominations)
      ? hand.chipDenominations
      : null;
  if (!denoms || !denoms.length) return null;
  const schedule =
    hand && Array.isArray(hand.blindSchedule) ? hand.blindSchedule : [];
  const tLevel = hand?.tLevel || 0;
  const retired = new Set();
  for (let i = 0; i < tLevel && i < schedule.length; i++) {
    const item = schedule[i];
    if (item && item.type === 'break' && item.race) {
      retired.add(Number(item.race.retired));
    }
  }
  return denoms
    .map((d) => Number(d))
    .filter((d) => d > 0 && !retired.has(d))
    .sort((a, b) => a - b);
}

// Smallest chip still in play (for minimum-increment display). Returns null when unconfigured.
export function minChipInPlay(hand) {
  const chips = chipsInPlay(hand);
  if (!chips || !chips.length) return null;
  return chips[0];
}

// Whether an amount can be formed from denominations currently in play.
export function isMakeableBet(hand, amount) {
  const chips = chipsInPlay(hand);
  if (!chips || !chips.length) return true;
  const SCALE = 100;
  const amountCents = Math.round((Number(amount) || 0) * SCALE);
  if (amountCents <= 0) return true;
  const chipCents = chips.map((c) => Math.round(c * SCALE));
  return isAmountMakeable(amountCents, chipCents);
}

export function isAmountMakeable(amountCents, chipCents) {
  chipCents = [...new Set(chipCents.filter((c) => c > 0))].sort((a, b) => a - b);
  if (!chipCents.length) return true;
  const gcdAll = chipCents.reduce((g, c) => gcdFn(g, c));
  if (amountCents % gcdAll !== 0) return false;
  const min = chipCents[0];
  if (amountCents % min === 0) return true;
  if (chipCents.length === 1) return false;

  const g2 = gcdFn(chipCents[0], chipCents[1]);
  const frobeniusBound = Math.ceil((chipCents[0] * chipCents[1]) / g2);
  if (amountCents > frobeniusBound) return true;

  const cap = Math.min(amountCents, frobeniusBound);
  const dp = new Uint8Array(cap + 1);
  dp[0] = 1;
  for (const c of chipCents) {
    for (let i = c; i <= cap; i++) {
      if (dp[i - c]) dp[i] = 1;
    }
  }
  return dp[cap] === 1;
}
