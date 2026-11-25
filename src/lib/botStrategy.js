import { calcEquity, evaluate7 } from '@/lib/poker';

const CHEN_HIGH = {
  A: 10, K: 8, Q: 7, J: 6, T: 5, 9: 4.5, 8: 4, 7: 3.5, 6: 3, 5: 2.5, 4: 2, 3: 1.5, 2: 1,
};
const RANK_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

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

/** How many players still act after this seat, preflop. */
function playersBehind(hand, playerIndex) {
  const n = hand.players.length;
  if (n <= 1) return 0;
  const buttonIndex = hand.players.findIndex((p) => p.seat === hand.buttonSeat);
  const bbIndex = hand.bbSeat != null
    ? hand.players.findIndex((p) => p.seat === hand.bbSeat)
    : (n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n);
  const raiseLevel = hand.raiseLevel || (hand.street === 'preflop' ? 1 : 0);
  let count = 0;
  if (raiseLevel <= 1) {
    if (playerIndex === bbIndex) return 0;
    for (let k = 1; k < n; k++) {
      const idx = (playerIndex + k) % n;
      const p = hand.players[idx];
      if (p.status !== 'folded' && (p.stack || 0) > 0) count += 1;
      if (idx === bbIndex) break;
    }
    return count;
  }
  for (let k = 1; k < n; k++) {
    const idx = (playerIndex + k) % n;
    const p = hand.players[idx];
    if (p.status !== 'folded' && (p.stack || 0) > 0 && (!p.hasActed || (p.currentBet || 0) < (hand.currentBet || 0))) {
      count += 1;
    }
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

/** Did this player make the last aggressive action on an earlier street? */
function isLastAggressor(hand, cp) {
  const history = hand.actionHistory || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if (e.street === hand.street) continue;
    return e.player === cp.name && /bet|raise|all/i.test(e.action || '');
  }
  return false;
}

/**
 * How coordinated the board is. Dry boards (paired, rainbow, disconnected) are
 * good to c-bet; wet boards (two-tone, connected, high cards) are not.
 */
function boardTexture(board) {
  const empty = { wet: 0, flushDraw: false, straightDraw: false, paired: false, high: false, broadway: false };
  if (!board || board.length < 3) return empty;
  const suitCount = {};
  board.forEach((c) => { suitCount[c.suit] = (suitCount[c.suit] || 0) + 1; });
  const flushDraw = Math.max(...Object.values(suitCount)) >= 2;
  const ranks = board.map((c) => RANK_ORDER.indexOf(c.rank)).sort((a, b) => a - b);
  let straightDraw = false;
  for (let i = 0; i + 2 < ranks.length; i++) {
    if (ranks[i + 2] - ranks[i] <= 4) straightDraw = true;
  }
  const paired = board.some((c, i) => board.some((d, j) => j > i && c.rank === d.rank));
  const high = board.filter((c) => RANK_ORDER.indexOf(c.rank) <= 3).length >= 2;
  const broadway = board.filter((c) => RANK_ORDER.indexOf(c.rank) <= 4).length >= 3;
  const wet = Math.min(1, (flushDraw ? 0.4 : 0) + (straightDraw ? 0.4 : 0) + (paired ? 0.15 : 0) + (high ? 0.1 : 0));
  return { wet, flushDraw, straightDraw, paired, high, broadway };
}

/** Draws and outs available to a hole-card hand on the current board. */
function drawInfo(holeCards, board) {
  const info = { flushDraw: false, straightDraw: false, gutshot: false, overcards: 0, outs: 0, pair: false };
  if (!board || board.length < 3) return info;
  const cards = [...holeCards, ...board];
  const suitCount = {};
  cards.forEach((c) => { suitCount[c.suit] = (suitCount[c.suit] || 0) + 1; });
  info.flushDraw = Math.max(...Object.values(suitCount)) === 4;
  const ranks = [...new Set(cards.map((c) => RANK_ORDER.indexOf(c.rank)))].sort((a, b) => a - b);
  for (let i = 0; i + 3 < ranks.length; i++) {
    if (ranks[i + 3] - ranks[i] <= 4) info.straightDraw = true;
  }
  if (!info.straightDraw) {
    for (let i = 0; i + 2 < ranks.length; i++) {
      if (ranks[i + 2] - ranks[i] <= 4) info.gutshot = true;
    }
  }
  const boardMin = Math.min(...board.map((b) => RANK_ORDER.indexOf(b.rank)));
  info.overcards = holeCards.filter((c) => RANK_ORDER.indexOf(c.rank) < boardMin).length;
  info.outs = (info.flushDraw ? 9 : 0) + (info.straightDraw ? 8 : 0) + (info.gutshot ? 4 : 0) + info.overcards * 2;
  return info;
}

/**
 * How much the hole cards block the board's draws: an ace of the flush suit or
 * a card that fills the straight removes opponent combos. Pro uses this to
 * bluff more on boards its own hand blocks.
 */
function blockerBonus(holeCards, board) {
  if (!board || board.length < 3 || !holeCards?.length) return 0;
  const suitCount = {};
  board.forEach((c) => { suitCount[c.suit] = (suitCount[c.suit] || 0) + 1; });
  const flushSuit = Object.keys(suitCount).find((s) => suitCount[s] >= 2);
  let bonus = 0;
  if (flushSuit && holeCards.some((c) => c.suit === flushSuit)) {
    const rank = holeCards.find((c) => c.suit === flushSuit).rank;
    bonus += RANK_ORDER.indexOf(rank) <= 2 ? 0.12 : 0.06;
  }
  const ranks = new Set([...holeCards, ...board].map((c) => RANK_ORDER.indexOf(c.rank)));
  if (ranks.size >= 5) bonus += 0.03;
  return bonus;
}

/** Approximate cEV push range for a short stack facing N players behind. */
function nashPushPct(stackBB, behind, dealtCount = 6) {
  let base;
  if (stackBB <= 2) base = 0.95;
  else if (stackBB <= 4) base = 0.75;
  else if (stackBB <= 6) base = 0.55;
  else if (stackBB <= 8) base = 0.42;
  else if (stackBB <= 10) base = 0.34;
  else if (stackBB <= 12) base = 0.28;
  else if (stackBB <= 15) base = 0.22;
  else if (stackBB <= 20) base = 0.16;
  else base = 0.12;
  const huMul = dealtCount === 2 && behind <= 1 ? 1.35 : 1;
  return Math.min(0.95, base * Math.max(0.35, 1 - 0.12 * Math.max(0, behind)) * huMul);
}

/** Rough call range against a shove: about the pot odds plus a small edge. */
function nashCallPct(potOdds) {
  return clamp(potOdds * 1.15 + 0.04, 0.08, 0.7);
}

/**
 * Read an opponent's HUD stats. Returns null when the tier ignores HUD reads or
 * the sample is too small; otherwise multipliers the caller folds into ranges.
 */
function hudReads(hud, tuning) {
  if (!hud || !tuning.hud || tuning.hud === 'none') return null;
  const hands = Number(hud.hands) || 0;
  if (hands < (Number(tuning.hudMinHands) || 0)) return null;
  const vpip = Number.isFinite(hud.vpip) ? hud.vpip : null;
  const pfr = Number.isFinite(hud.pfr) ? hud.pfr : null;
  const threeBet = Number.isFinite(hud.threeBet) ? hud.threeBet : null;
  const foldToCbet = Number.isFinite(hud.foldToCbet) ? hud.foldToCbet : null;
  const ats = Number.isFinite(hud.ats) ? hud.ats : null;
  const showdown = Number.isFinite(hud.showdown) ? hud.showdown : null;
  const fish = vpip != null && vpip >= 60;
  const nit = vpip != null && vpip > 0 && vpip <= 12;
  if (tuning.hud === 'outliers') {
    if (!fish && !nit) return null;
    return { fish, nit, bluffMul: fish ? 0.35 : 1, openMul: nit ? 0.85 : 1, callMul: fish ? 1.15 : 1, valueBias: fish ? 0.08 : 0 };
  }
  // core / full: use every stat the sample supports.
  return {
    fish, nit,
    bluffMul: foldToCbet != null ? clamp(0.6 + (foldToCbet - 45) / 60, 0.3, 1.6) : 1,
    openMul: vpip != null ? clamp(0.7 + (vpip - 25) / 80, 0.5, 1.4) : 1,
    threeBetMul: threeBet != null ? clamp(0.7 + (threeBet - 7) / 30, 0.4, 1.5) : 1,
    callMul: vpip != null ? clamp(0.75 + (vpip - 25) / 100, 0.5, 1.3) : 1,
    stealMul: ats != null ? clamp(0.8 + (ats - 30) / 100, 0.5, 1.4) : 1,
    showdown,
    pfr,
  };
}

/** Bet size as a fraction of the pot for the tier's sizing mode. */
function betFraction(tuning, texture, rng, streetsLeft = 1) {
  if (tuning.sizing === 'erratic') {
    const choices = [0.33, 0.5, 0.75, 1.1, 1.6];
    return choices[Math.floor(rng() * choices.length)];
  }
  if (tuning.sizing === 'standard') return 0.5 + rng() * 0.2;
  if (tuning.sizing === 'stack_scaled') {
    if (texture.wet >= 0.7) return 0.75;
    if (texture.wet >= 0.4) return 0.55;
    return 0.33;
  }
  // geometric: size so the pot grows to a stack shove by the river.
  return clamp(0.55 + 0.12 * streetsLeft, 0.4, 0.95);
}

/**
 * Decide one bot action from range strength (preflop) and equity plus made-hand
 * strength (postflop). Postflop each style carries its own raise count and a
 * rising strength bar per extra raise, so a nit raises once while a maniac can
 * go to war - but only with a hand that keeps getting stronger. The tuning
 * flags decide how much position, stack depth, texture, draws, sizing and HUD
 * reads the tier actually uses.
 */
export function decideBotAction({ hand, playerIndex, holeCards, styleId, profile, tuning, hud = null, rng = Math.random }) {
  const cp = hand.players[playerIndex];
  if (!cp || !holeCards || holeCards.length === 0) return { type: 'check' };
  const pot = hand.players.reduce((s, p) => s + (p.totalBet || 0), 0);
  const toCall = Math.max(0, (hand.currentBet || 0) - (cp.currentBet || 0));
  const stack = cp.stack || 0;
  const bb = hand.bigBlind || 1;
  const stackBB = stack / bb;
  const street = hand.street || 'preflop';
  const raiseLevel = hand.raiseLevel || (street === 'preflop' ? 1 : 0);
  const canRaise = cp.stack > toCall && hand.players.filter((p) => p.id !== cp.id && p.status !== 'folded').some((p) => (p.stack || 0) > 0);
  const allInBet = lastAggressionWasAllIn(hand);
  const board = (hand.communityCards || []).filter((c) => c && !c.hidden);
  const behind = playersBehind(hand, playerIndex);
  const reads = hudReads(hud, tuning);
  const positionAware = tuning.positionAware !== false;

  const shove = () => (canRaise ? { type: 'raise', amount: (cp.currentBet || 0) + stack } : { type: 'call' });

  const cap = Math.min(Number(tuning.maxRaises) || 2, Math.max(1, Math.min(4, Number(profile.maxRaises) || 2)));
  const raisesSoFar = Math.max(0, (raiseLevel || 0) - 1);
  const effectiveMistake = street === 'preflop' ? (tuning.mistake || 0) * 0.12 : (tuning.mistake || 0);
  if (effectiveMistake > 0 && rng() < effectiveMistake) {
    const roll = rng();
    const mayOpenBet = canRaise && (street === 'preflop' ? raiseLevel <= 1 : raiseLevel === 0);
    if (toCall <= 0) {
      const reckless = mayOpenBet ? raiseTarget(hand, cp, (hand.currentBet || 0) + pot * 0.6) : null;
      return roll < 0.65 || !reckless ? { type: 'check' } : { type: 'raise', amount: reckless };
    }
    if (roll < 0.45) return { type: 'fold' };
    return { type: 'call' };
  }

  if (street === 'preflop') {
    const dealtCount = Math.max(2, hand.players.length);
    const buttonIndex = hand.players.findIndex((p) => p.seat === hand.buttonSeat);
    const bbIndex = hand.bbSeat != null
      ? hand.players.findIndex((p) => p.seat === hand.bbSeat)
      : (dealtCount === 2 ? (buttonIndex + 1) % dealtCount : (buttonIndex + 2) % dealtCount);
    const isBB = playerIndex === bbIndex;

    let posFactor = 1;
    if (positionAware) {
      if (dealtCount === 2) {
        posFactor = isBB ? 2.25 : 2.85;
      } else {
        const shortBonus = dealtCount <= 4 ? 1.12 : dealtCount === 5 ? 1.05 : 1.0;
        if (isBB || behind === 0) posFactor = 1.65 * shortBonus;
        else if (behind === 1) posFactor = 1.75 * shortBonus;
        else if (behind === 2) posFactor = 1.9 * shortBonus;
        else if (behind === 3) posFactor = 1.45 * shortBonus;
        else if (behind === 4) posFactor = 1.15;
        else if (behind === 5) posFactor = 0.96;
        else if (behind === 6) posFactor = 0.84;
        else if (behind === 7) posFactor = 0.75;
        else posFactor = 0.68;
      }
    } else {
      posFactor = dealtCount === 2 ? 1.85 : dealtCount === 3 ? 1.35 : dealtCount <= 5 ? 1.15 : dealtCount <= 7 ? 1.0 : 0.92;
    }

    const top = topPercent(holeCards);
    const stealMul = behind <= 1 && raiseLevel <= 1 ? (reads?.stealMul || 1) : 1;
    const passiveCap = posFactor > 1 && (profile.aggro ?? 0.5) < 0.35
      ? 1 + (posFactor - 1) * (0.35 + (profile.aggro ?? 0.2))
      : posFactor;
    const openPct = Math.min(0.92, profile.openPct * passiveCap * (reads?.openMul || 1) * stealMul);
    const threeBetPosFactor = dealtCount === 2
      ? (isBB ? 1.55 : 1.45)
      : Math.min(1.3, Math.max(0.75, posFactor * 0.78));
    const threeBetPct = Math.min(0.24, profile.threeBetPct * threeBetPosFactor * (reads?.threeBetMul || 1));
    const limpScale = posFactor > 1 ? Math.min(1.6, 1 + (posFactor - 1) * 0.5) : Math.max(0.95, posFactor);
    const limpPct = profile.limpPct * limpScale;
    const isLoosePassive = (profile.aggro ?? 0.5) < 0.25 && profile.coldCallPct >= 0.35;
    const short = tuning.shortStack || 'none';
    const inPosition = playerIndex === buttonIndex || behind <= 1;

    // --- Short stack: each tier handles it differently. ---
    if (stackBB <= 20 && !isLoosePassive) {
      if (short === 'none') {
        // Easy: never shoves short - it limps or min-raises instead.
        if (raiseLevel <= 1 && toCall <= bb && top <= openPct && canRaise) {
          const amount = raiseTarget(hand, cp, bb * 2);
          if (amount) return { type: 'raise', amount };
        }
        if (toCall > 0 && top <= Math.min(0.95, openPct * 1.2 + limpPct)) return { type: 'call' };
        return toCall === 0 ? { type: 'check' } : { type: 'fold' };
      }
      if (short === 'shove_fold') {
        // Medium: all in or fold once the stack is short.
        if (raiseLevel <= 1) {
          if (top <= openPct && canRaise) return shove();
          if (toCall > 0 && top <= Math.min(0.95, openPct + limpPct * 0.6)) return { type: 'call' };
          return toCall === 0 ? { type: 'check' } : { type: 'fold' };
        }
        if (raiseLevel === 2) {
          const reShovePct = Math.min(0.24, Math.max(threeBetPct * 1.15, openPct * 0.36));
          if (top <= reShovePct && canRaise) return shove();
          if (top <= Math.min(0.6, Math.max(openPct * 0.75, threeBetPct + profile.coldCallPct)) && toCall <= stack) return { type: 'call' };
          return { type: 'fold' };
        }
        const fourBetShovePct = Math.min(0.10, Math.max(profile.fourBetPct * 1.35, 0.035));
        if (top <= fourBetShovePct && canRaise) return shove();
        if (top <= Math.min(0.18, profile.callVs3Bet * 1.15) && toCall <= stack) return { type: 'call' };
        return { type: 'fold' };
      }
      // Hard / pro: push-fold charts scaled gently by archetype looseness.
      const stylePushMul = clamp(profile.openPct / 0.22, 0.7, 1.55);
      const pushPct = Math.min(0.95, nashPushPct(stackBB, behind, dealtCount) * stylePushMul);
      if (raiseLevel <= 1) {
        const iso = short === 'charts_iso' && toCall > 0 && toCall <= bb * 2;
        if (top <= pushPct * (iso ? 1.15 : 1) && canRaise) return shove();
        if (top <= openPct * 0.9 && toCall <= bb) return { type: 'call' };
        return toCall === 0 ? { type: 'check' } : { type: 'fold' };
      }
      if (raiseLevel === 2) {
        if (top <= pushPct * 0.8 && canRaise) return shove();
        const callPct = Math.max(nashCallPct(toCall / Math.max(1, pot + toCall)), profile.coldCallPct * 0.8);
        if (top <= callPct && toCall <= stack) return { type: 'call' };
        if (short === 'charts_iso' && stackBB >= 12 && stackBB <= 25 && inPosition && top <= 0.12 && toCall < stack * 0.35) {
          return { type: 'call' }; // stop-and-go: call, then shove the flop
        }
        return { type: 'fold' };
      }
      if (top <= pushPct * 0.55 && toCall <= stack) return stack <= toCall ? shove() : { type: 'call' };
      return { type: 'fold' };
    }

    if (raiseLevel <= 1) {
      // Unopened (or limped) pot: raise the opening range, otherwise limp or fold.
      if (top <= openPct && canRaise) {
        const limpers = hand.players.filter((p) => p.status !== 'folded' && p.id !== cp.id && (p.currentBet || 0) >= bb).length;
        let size;
        if (tuning.sizing === 'erratic') size = bb * (2 + rng() * 2);
        else if (tuning.sizing === 'stack_scaled') size = bb * (stackBB >= 40 ? 2.2 : stackBB >= 20 ? 2.5 : 2.0);
        else size = bb * (2.2 + 0.3 * Math.max(0, limpers - 1) + (profile.size >= 0.75 ? 0.2 : 0));
        const amount = raiseTarget(hand, cp, size);
        if (amount) return { type: 'raise', amount };
      }
      if (top <= openPct && toCall === 0) return { type: 'check' };
      if (toCall > 0 && top <= Math.min(0.95, openPct + limpPct * (reads?.callMul || 1))) return { type: 'call' };
      return toCall === 0 ? { type: 'check' } : { type: 'fold' };
    }
    if (raiseLevel === 2) {
      if (top <= threeBetPct && canRaise) {
        if (stack <= bb * 25 && top <= threeBetPct * 0.6) return shove();
        const amount = raiseTarget(hand, cp, Math.max((hand.currentBet || 0) * 3, (hand.currentBet || 0) + pot * 0.9));
        if (amount) return { type: 'raise', amount };
      }
      // Cold-calling sits below the 3-bet range and scales by seat and player count.
      const defendPosFactor = dealtCount === 2 && isBB
        ? 2.8
        : isBB
          ? (dealtCount <= 4 ? 2.15 : 1.75)
          : behind === 1
            ? (isLoosePassive || profile.openPct >= 0.45 ? 1.25 : 0.98)
            : behind === 2
              ? (dealtCount <= 4 ? 1.7 : 1.4)
              : behind === 3
                ? 1.2
                : (isLoosePassive || profile.openPct >= 0.45)
                  ? 1.05
                  : Math.max(0.85, 1.05 - (behind - 4) * 0.06);
      const coldCallRange = Math.max(profile.coldCallPct, profile.openPct * 0.35) * defendPosFactor * (reads?.callMul || 1);
      const defendPct = Math.min(0.95, threeBetPct + coldCallRange);
      if (top <= defendPct) return { type: 'call' };
      if (allInBet && top <= defendPct * 1.4 && toCall <= stack) return { type: 'call' };
      if (toCall >= stack * 0.5) return { type: 'fold' };
      return { type: 'fold' };
    }
    if (raiseLevel === 3) {
      const fourBetCap = Math.min(0.075, profile.fourBetPct * (inPosition ? 1.05 : 0.9));
      if (top <= fourBetCap && canRaise) {
        if (stack <= bb * 30) return shove();
        const amount = raiseTarget(hand, cp, (hand.currentBet || 0) * 2.3);
        if (amount) return { type: 'raise', amount };
      }
      if (top <= profile.callVs3Bet * (reads?.callMul || 1)) return { type: 'call' };
      return { type: 'fold' };
    }
    // Facing a 4-bet or more: only continue with the top of the range.
    if (top <= profile.callVs3Bet * 0.45 && toCall <= stack) return stack <= toCall ? shove() : { type: 'call' };
    return { type: 'fold' };
  }

  // Postflop: equity against the remaining players plus the made-hand category.
  const opponents = hand.players.filter((p) => p.id !== cp.id && p.status !== 'folded');
  const texture = boardTexture(board);
  const draw = drawInfo(holeCards, board);
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
  let strength = Math.min(0.99, equity + (cat >= 3 ? 0.12 : cat >= 1 ? 0.05 : 0));
  // Easy overvalues any pair and ignores draws.
  if (tuning.overvaluePairs && cat >= 1) strength = Math.min(0.99, strength + 0.15);
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const streetsLeft = street === 'flop' ? 2 : street === 'turn' ? 1 : 0;

  // Fit-or-fold: no pair and no real draw means giving up against a bet.
  if (tuning.fitOrFold && toCall > 0 && cat < 1 && !draw.flushDraw && !draw.straightDraw) {
    return { type: 'fold' };
  }

  const maxRaises = Math.min(Number(tuning.maxRaises) || 2, Math.max(1, Math.min(4, Number(profile.maxRaises) || 2)));
  const raisesMade = Math.max(0, (raiseLevel || 0) - 1);
  const hasStrongDraw = street !== 'river' && (draw.flushDraw || draw.straightDraw);
  const hasComboDraw = street === 'flop' && draw.flushDraw && (draw.straightDraw || draw.gutshot);
  const raiseStep = profile.reRaiseStep ?? 0.06 + (1 - (profile.aggro || 0)) * 0.08;
  const raiseStrengthNeed = Math.min(0.96, profile.betLine + raiseStep * raisesMade);
  const raiseOdds = Math.max(0.06, 0.38 + (profile.aggro || 0) * 0.5 - raisesMade * 0.12);
  const showdownMul = reads?.showdown != null
    ? clamp(1.25 - (reads.showdown - 20) / 60, 0.55, 1.35)
    : 1;
  const bluffMul = (tuning.bluffMul || 1) * (reads?.bluffMul || 1) * showdownMul;
  const blockers = tuning.hud === 'full' ? blockerBonus(holeCards, board) : 0;

  const sizeTo = (fraction) => {
    const base = Math.max(bb, pot * fraction);
    return raiseTarget(hand, cp, (hand.currentBet || 0) + base);
  };

  if (toCall <= 0) {
    const aggressor = isLastAggressor(hand, cp);
    let fraction = betFraction(tuning, texture, rng, streetsLeft);
    // C-bet logic: medium+ checks wet boards and bets dry ones.
    if (tuning.texture !== 'none' && aggressor && raisesMade === 0) {
      if (tuning.texture === 'basic') {
        if (texture.wet >= 0.55 && strength < 0.7) return { type: 'check' };
        if (texture.wet < 0.55 && strength >= 0.35) fraction = 0.5;
      } else if (tuning.texture === 'sized') {
        fraction = texture.wet >= 0.7 ? 0.75 : texture.wet >= 0.4 ? 0.55 : 0.33;
        if (texture.wet >= 0.7 && strength < 0.62) return { type: 'check' };
      } else if (tuning.texture === 'advanced') {
        fraction = texture.wet >= 0.7 ? 0.8 : texture.wet >= 0.4 ? 0.6 : 0.33;
        // Protect the checking range: sometimes check a strong hand.
        if (strength >= 0.78 && rng() < 0.22) return { type: 'check' };
      }
    }
    const leadStrength = cat === 0 && !hasStrongDraw ? strength - 0.16 : strength;
    if (leadStrength >= profile.betLine && canRaise && raisesMade < maxRaises) {
      const amount = sizeTo(fraction);
      if (amount) {
        if (strength > 0.85 && cat >= 1 && stack <= pot * 1.4) return shove();
        return { type: 'raise', amount };
      }
    }
    // Bluffs only open the betting; nobody bluffs into a street that is already raised.
    const bluffFreq = profile.bluff * bluffMul * (opponents.length <= 2 ? 1 : 0.55) * (1 + blockers);
    if (rng() < bluffFreq && raisesMade === 0 && canRaise) {
      const amount = sizeTo(fraction * 0.7);
      if (amount) return { type: 'raise', amount };
    }
    return { type: 'check' };
  }

  // Draws: without draw awareness the call bar ignores the price entirely.
  const drawEquity = draw.outs > 0 ? Math.min(0.45, draw.outs / 40) : 0;
  const callThreshold = tuning.drawOdds
    ? Math.max(0.02, potOdds - profile.callBonus - drawEquity * 0.25)
    : 0.45 - profile.callBonus;
  if (strength < callThreshold) {
    if (strength < callThreshold - 0.15) return { type: 'fold' };
    return rng() < 0.2 ? { type: 'call' } : { type: 'fold' };
  }

  const canRaiseMore = canRaise && raisesMade < maxRaises;
  // Require real made hands (or flop/turn draws for a single raise) before escalating
  // postflop: random-hand equity alone inflates Ace/King high into fake 3-bets/4-bets.
  const valueHandQualifies = raisesMade >= 2
    ? (cat >= 2 && strength >= 0.86)
    : raisesMade === 1
      ? (cat >= 2 || (cat === 1 && strength >= 0.80) || (hasComboDraw && strength >= 0.68))
      : (cat >= 1 || (hasStrongDraw && strength >= 0.62));
  const raiseLine = Math.max(
    profile.betLine,
    callThreshold + 0.14,
    raisesMade === 1 ? Math.max(0.74, raiseStrengthNeed + 0.08) : raisesMade >= 2 ? 0.86 : raiseStrengthNeed,
  );
  if (canRaiseMore && valueHandQualifies && strength >= raiseLine && rng() < raiseOdds) {
    if (strength > 0.82 && cat >= 2 && stack <= pot * 1.3) return shove();
    const amount = sizeTo(betFraction(tuning, texture, rng, streetsLeft));
    if (amount) return { type: 'raise', amount };
  }
  // A bluff raise over a single bet only, never a 3-bet or 4-bet, and requiring draw equity or blockers.
  if (
    canRaiseMore
    && raisesMade === 0
    && (hasStrongDraw || cat >= 1 || (street === 'river' && blockers > 0.05))
    && strength >= raiseStrengthNeed - 0.1
    && rng() < profile.bluff * 0.3 * (1 - profile.raiseGuard) * bluffMul
  ) {
    const amount = sizeTo(0.6);
    if (amount) return { type: 'raise', amount };
  }
  if (toCall >= stack) return { type: 'call' };
  return { type: 'call' };
}
