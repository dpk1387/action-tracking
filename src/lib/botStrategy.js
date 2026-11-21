import { calcEquity, evaluate7 } from '@/lib/poker';

const CHEN_HIGH = {
  A: 10, K: 8, Q: 7, J: 6, T: 5, 9: 4.5, 8: 4, 7: 3.5, 6: 3, 5: 2.5, 4: 2, 3: 1.5, 2: 1,
};
const RANK_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

/** Bill Chen's preflop power score for two hole cards. */
export function chenScore(cards) {
  if (!Array.isArray(cards) || cards.length < 2) return 0;
  const [a, b] = cards.length > 2 ? [cards[0], cards[1]] : cards;
  const hi = CHEN_HIGH[a.rank] >= CHEN_HIGH[b.rank] ? a : b;
  const lo = hi === a ? b : a;
  let score;
  if (a.rank === b.rank) {
    score = Math.max(5, CHEN_HIGH[a.rank] * 2);
  } else {
    score = CHEN_HIGH[hi.rank];
    const gap = Math.abs(RANK_ORDER.indexOf(hi.rank) - RANK_ORDER.indexOf(lo.rank));
    if (hi.suit === lo.suit) score += 2;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    if (gap <= 1 && CHEN_HIGH[hi.rank] < 7) score += 1;
  }
  return Math.round(score * 2) / 2;
}

// All 169 starting hand classes, each with the share of hands that are at least
// as strong (0.006 for AA up to 1 for 72o). Position ranges use this directly.
const TOP_PERCENT = (() => {
  const types = [];
  for (let i = 0; i < RANK_ORDER.length; i++) {
    for (let j = 0; j < RANK_ORDER.length; j++) {
      const hi = RANK_ORDER[Math.min(i, j)];
      const lo = RANK_ORDER[Math.max(i, j)];
      if (i === j) types.push({ key: `${hi}${lo}`, score: chenScore([{ rank: hi, suit: 's' }, { rank: lo, suit: 'h' }]) });
      else if (i < j) types.push({ key: `${hi}${lo}s`, score: chenScore([{ rank: hi, suit: 's' }, { rank: lo, suit: 's' }]) });
      else types.push({ key: `${hi}${lo}o`, score: chenScore([{ rank: hi, suit: 's' }, { rank: lo, suit: 'h' }]) });
    }
  }
  const map = {};
  for (const t of types) {
    const atLeast = types.filter((o) => o.score >= t.score).length;
    map[t.key] = atLeast / types.length;
  }
  return map;
})();

export function handKey(cards) {
  if (!Array.isArray(cards) || cards.length < 2) return '72o';
  const [a, b] = cards;
  const hiFirst = CHEN_HIGH[a.rank] >= CHEN_HIGH[b.rank] ? a : b;
  const lo = hiFirst === a ? b : a;
  if (hiFirst.rank === lo.rank) return `${hiFirst.rank}${lo.rank}`;
  return `${hiFirst.rank}${lo.rank}${hiFirst.suit === lo.suit ? 's' : 'o'}`;
}

/** Share of all starting hands this one beats or ties: 0.006 (AA) to 1 (72o). */
export function topPercent(cards) {
  return TOP_PERCENT[handKey(cards)] ?? 1;
}

/** How many players still act after this seat, preflop, before the button. */
function playersBehind(hand, playerIndex) {
  const n = hand.players.length;
  const buttonIndex = hand.players.findIndex((p) => p.seat === hand.buttonSeat);
  let count = 0;
  for (let k = 1; k < n; k++) {
    const idx = (playerIndex + k) % n;
    if (idx === buttonIndex) break;
    const p = hand.players[idx];
    if (p.status !== 'folded' && (p.stack || 0) > 0) count += 1;
  }
  return count;
}

function lastAggressionWasAllIn(hand) {
  const contenders = hand.players.filter((p) => p.status !== 'folded' && (p.currentBet || 0) === (hand.currentBet || 0));
  return contenders.some((p) => p.lastAction?.type === 'allin');
}

function raiseTarget(hand, cp, desiredTo) {
  const minTo = (hand.currentBet || 0) + Math.max(hand.lastRaiseAmount || hand.bigBlind || 1, hand.bigBlind || 1);
  const maxTo = (cp.currentBet || 0) + (cp.stack || 0);
  const target = Math.min(Math.max(Math.round(desiredTo), minTo), maxTo);
  if (target <= (hand.currentBet || 0)) return null;
  return target;
}

/**
 * Decide one bot action from range strength (preflop) and equity plus made-hand
 * strength (postflop). Postflop each style carries its own raise count and a
 * rising strength bar per extra raise, so a nit raises once while a maniac can
 * go to war - but only with a hand that keeps getting stronger.
 */
export function decideBotAction({ hand, playerIndex, holeCards, styleId, profile, tuning, rng = Math.random }) {
  const cp = hand.players[playerIndex];
  if (!cp || !holeCards || holeCards.length === 0) return { type: 'check' };
  const pot = hand.players.reduce((s, p) => s + (p.totalBet || 0), 0);
  const toCall = Math.max(0, (hand.currentBet || 0) - (cp.currentBet || 0));
  const stack = cp.stack || 0;
  const bb = hand.bigBlind || 1;
  const street = hand.street || 'preflop';
  const raiseLevel = hand.raiseLevel || (street === 'preflop' ? 1 : 0);
  const canRaise = cp.stack > toCall && hand.players.filter((p) => p.id !== cp.id && p.status !== 'folded').some((p) => (p.stack || 0) > 0);
  const allInBet = lastAggressionWasAllIn(hand);
  const board = (hand.communityCards || []).filter((c) => c && !c.hidden);

  const shove = () => (canRaise ? { type: 'raise', amount: (cp.currentBet || 0) + stack } : { type: 'call' });

  if (tuning.mistake > 0 && rng() < tuning.mistake) {
    const roll = rng();
    if (toCall <= 0) {
      const reckless = raiseLevel < 2 && canRaise ? raiseTarget(hand, cp, (hand.currentBet || 0) + pot * 0.6) : null;
      return roll < 0.6 || !reckless ? { type: 'check' } : { type: 'raise', amount: reckless };
    }
    if (roll < 0.4) return { type: 'fold' };
    if (roll < 0.85 || !canRaise) return { type: 'call' };
    const wild = raiseTarget(hand, cp, (hand.currentBet || 0) * 2.5);
    return wild ? { type: 'raise', amount: wild } : { type: 'call' };
  }

  if (street === 'preflop') {
    const behind = playersBehind(hand, playerIndex);
    const posFactor = behind <= 1 ? 1.35 : behind <= 2 ? 1.15 : behind <= 3 ? 1 : 0.8;
    const top = topPercent(holeCards);
    const openPct = Math.min(0.9, profile.openPct * posFactor);
    if (raiseLevel <= 1) {
      // Unopened (or limped) pot: raise the opening range, otherwise limp or fold.
      if (top <= openPct && canRaise) {
        // Total open size in big blinds (2.2x, 2.5x with limpers), not added on
        // top of the big blind, so a 2.2x open really is 2.2 big blinds.
        const limpers = hand.players.filter((p) => p.status !== 'folded' && p.id !== cp.id && (p.currentBet || 0) >= bb).length;
        const size = bb * (2.2 + 0.3 * Math.max(0, limpers - 1) + (profile.size >= 0.75 ? 0.2 : 0));
        const amount = raiseTarget(hand, cp, size);
        if (amount) return { type: 'raise', amount };
      }
      if (top <= openPct && toCall === 0) return { type: 'check' };
      if (toCall > 0 && top <= Math.min(0.95, profile.openPct * posFactor + profile.limpPct)) return { type: 'call' };
      return toCall === 0 ? { type: 'check' } : { type: 'fold' };
    }
    if (raiseLevel === 2) {
      if (top <= profile.threeBetPct * posFactor && canRaise) {
        if (stack <= bb * 25 && top <= profile.threeBetPct * 0.6) return shove();
        const amount = raiseTarget(hand, cp, Math.max((hand.currentBet || 0) * 3, (hand.currentBet || 0) + pot * 0.9));
        if (amount) return { type: 'raise', amount };
      }
      // Cold-calling range scales with the style's opening range, so a TAG
      // defends a normal share against an open instead of folding everything.
      const defendPct = Math.min(0.95, Math.max(profile.coldCallPct, profile.openPct * 0.45) * posFactor);
      if (top <= defendPct) return { type: 'call' };
      if (allInBet && top <= defendPct * 1.6 && toCall <= stack) return { type: 'call' };
      if (toCall >= stack * 0.5) return { type: 'fold' };
      return { type: 'fold' };
    }
    if (raiseLevel === 3) {
      if (top <= profile.fourBetPct && canRaise) {
        if (stack <= bb * 30) return shove();
        const amount = raiseTarget(hand, cp, (hand.currentBet || 0) * 2.3);
        if (amount) return { type: 'raise', amount };
      }
      if (top <= profile.callVs3Bet) return { type: 'call' };
      return { type: 'fold' };
    }
    // Facing a 4-bet or more: only continue with the top of the range.
    if (top <= profile.callVs3Bet * 0.45 && toCall <= stack) return stack <= toCall ? shove() : { type: 'call' };
    return { type: 'fold' };
  }

  // Postflop: equity against the remaining players plus the made-hand category.
  const opponents = hand.players.filter((p) => p.id !== cp.id && p.status !== 'folded');
  let rawEquity;
  try {
    const res = calcEquity([holeCards, ...opponents.map(() => null)], board, tuning.iters, hand.variant || 'nlh');
    const r = res?.results?.[0] || {};
    rawEquity = ((r.win || 0) + (res?.split || 0) / 2) / 100;
  } catch (_) {
    rawEquity = 1 / Math.max(1, opponents.length + 1);
  }
  const noise = tuning.noise + (profile.extraNoise || 0);
  const equity = Math.max(0.02, Math.min(0.98, rawEquity + (rng() * 2 - 1) * noise));
  let cat = 0;
  try {
    const score = evaluate7([...holeCards, ...board], false);
    cat = Array.isArray(score) ? score[0] : 0;
  } catch (_) { cat = 0; }
  // Pair-or-better bonus, so a made hand bets even when equity is close.
  const strength = Math.min(0.99, equity + (cat >= 3 ? 0.12 : cat >= 1 ? 0.05 : 0));
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  // How many raises this style will put in on one street. A bet (level 1) does
  // not count, so the nit raises once, the maniac can go to war. Each extra
  // raise also needs a stronger hand, which is what stops low-equity wars.
  const maxRaises = Math.max(1, Math.min(4, Number(profile.maxRaises) || 2));
  const raisesMade = Math.max(0, (raiseLevel || 0) - 1);
  const raiseStep = profile.reRaiseStep ?? 0.06 + (1 - (profile.aggro || 0)) * 0.08;
  const raiseStrengthNeed = Math.min(0.96, profile.betLine + raiseStep * raisesMade);
  const raiseOdds = Math.max(0.06, 0.38 + (profile.aggro || 0) * 0.5 - raisesMade * 0.1);

  if (toCall <= 0) {
    const betSize = Math.max(cp.currentBet || 0, 0) + Math.max(bb, pot * profile.size * (0.7 + rng() * 0.5));
    if (strength >= profile.betLine && canRaise && raisesMade < maxRaises) {
      const amount = raiseTarget(hand, cp, (hand.currentBet || 0) + Math.max(bb, pot * Math.max(0.45, profile.size)));
      if (amount) {
        if (strength > 0.85 && stack <= pot * 1.4) return shove();
        return { type: 'raise', amount };
      }
    }
    // Bluffs only open the betting; nobody bluffs into a street that is already raised.
    if (rng() < profile.bluff * (tuning.bluffMul || 1) * (opponents.length <= 2 ? 1 : 0.55) && raisesMade === 0 && canRaise) {
      const amount = raiseTarget(hand, cp, (hand.currentBet || 0) + Math.max(bb, betSize * 0.7));
      if (amount) return { type: 'raise', amount };
    }
    return { type: 'check' };
  }

  const callThreshold = potOdds - profile.callBonus;
  if (strength < callThreshold) {
    if (strength < callThreshold - 0.15) return { type: 'fold' };
    return rng() < 0.2 ? { type: 'call' } : { type: 'fold' };
  }

  const canRaiseMore = canRaise && raisesMade < maxRaises;
  const raiseLine = Math.max(profile.betLine, callThreshold + 0.14, raiseStrengthNeed);
  if (canRaiseMore && strength >= raiseLine && rng() < raiseOdds) {
    if (strength > 0.82 && stack <= pot * 1.3) return shove();
    const amount = raiseTarget(hand, cp, (hand.currentBet || 0) * 2.4 + pot * 0.25);
    if (amount) return { type: 'raise', amount };
  }
  // A bluff raise over a single bet only, and only when the hand has real equity.
  if (canRaiseMore && raisesMade === 0 && strength >= raiseStrengthNeed - 0.1 && rng() < profile.bluff * 0.35 * (1 - profile.raiseGuard)) {
    const amount = raiseTarget(hand, cp, (hand.currentBet || 0) * 2.3);
    if (amount) return { type: 'raise', amount };
  }
  if (toCall >= stack) return { type: 'call' };
  return { type: 'call' };
}
