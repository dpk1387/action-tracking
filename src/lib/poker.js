// Pure poker engine helpers for the action tracker.
import { minChipInPlay, isMakeableBet } from './chipMath';

export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
export const SUITS = ['s','h','d','c'];
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_RED = { s: false, h: true, d: true, c: false };

export const POS = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', '+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', '+1', '+2', 'LJ', 'HJ', 'CO'],
  10: ['BTN', 'SB', 'BB', 'UTG', '+1', '+2', '+3', 'LJ', 'HJ', 'CO'],
  11: ['BTN', 'SB', 'BB', 'UTG', '+1', '+2', '+3', '+4', 'LJ', 'HJ', 'CO'],
  12: ['BTN', 'SB', 'BB', 'UTG', '+1', '+2', '+3', '+4', '+5', 'LJ', 'HJ', 'CO'],
};

export const STREET_ORDER = ['preflop', 'flop', 'turn', 'river', 'ocean'];
export const STREET_LABEL = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River', ocean: 'Ocean' };

export const VARIANTS = {
  nlh: { label: "Hold'em", group: 'holdem', holeSize: 2, deck: 'full' },
  plo: { label: 'Omaha 4', group: 'omaha', holeSize: 4, deck: 'full' },
  short_deck: { label: 'Short Deck', group: 'holdem', holeSize: 2, deck: 'short' },
  pineapple: { label: 'Pineapple', group: 'holdem', holeSize: 3, deck: 'full' },
  lazy_pineapple: { label: 'Lazy Pineapple', group: 'holdem', holeSize: 3, deck: 'full' },
  crazy_pineapple: { label: 'Crazy Pineapple', group: 'holdem', holeSize: 3, deck: 'full' },
  super_holdem: { label: "Super Hold'em", group: 'holdem', holeSize: 3, deck: 'full' },
  plo5: { label: 'Omaha 5', group: 'omaha', holeSize: 5, deck: 'full' },
  plo6: { label: 'Omaha 6', group: 'omaha', holeSize: 6, deck: 'full' },
  plo4: { label: 'Omaha 4', group: 'omaha', holeSize: 4, deck: 'full' },
  dramaha: { label: 'Dramaha', group: 'dramaha', holeSize: 5, deck: 'full' },
  plo8: { label: 'Omaha Hi/Lo', group: 'omaha', holeSize: 4, deck: 'full' },
  second_best: { label: '2nd Best', group: 'degen', holeSize: 2, deck: 'full' },
  three_two_one: { label: '3-2-1', group: 'degen', holeSize: 2, deck: 'full' },
  ocean: { label: 'Ocean', group: 'degen', holeSize: 2, deck: 'full' },
  showtime: { label: "Naked Hold 'Em", group: 'extra_info', holeSize: 2, deck: 'full' },
  pirate_poker: { label: 'Pirate Poker', group: 'extra_info', holeSize: 2, deck: 'full', exposeOne: true },
  mandatory_3bet: { label: 'Mandatory 3-Bet', group: 'mandatory', holeSize: 2, deck: 'full' },
  mandatory_raise: { label: 'Mandatory Raise', group: 'mandatory', holeSize: 2, deck: 'full' },
  bomb_pot: { label: 'Bomb Pot', group: 'degen', holeSize: 2, deck: 'full' },
  double_board_bomb_pot: { label: 'Double Board Bomb Pot', group: 'degen', holeSize: 2, deck: 'full' },
  red_river: { label: 'Red River', group: 'degen', holeSize: 2, deck: 'full' },
  win_button: { label: 'Win the Button', group: 'degen', holeSize: 2, deck: 'full' },
  deuces_wild: { label: 'Deuces Wild', group: 'degen', holeSize: 2, deck: 'full' },
};

export const GAME_TYPES = { nl: 'No Limit', pl: 'Pot Limit' };

export function variantMeta(v) {
  if (v === 'holdem') return VARIANTS.nlh;
  return VARIANTS[v] || VARIANTS.nlh;
}

export function isBombPotVariant(v) {
  return v === 'bomb_pot' || v === 'double_board_bomb_pot';
}

// Omaha-family games are always played pot limit.
export function isPotLimitVariant(v) {
  return variantMeta(v).group === 'omaha' || variantMeta(v).group === 'dramaha';
}

// Degen / extra-information / mandatory-action variants are Action Tracking
// only for now: their special rules have no GO Mode handling.
export const GO_UNSUPPORTED_GROUPS = ['degen', 'extra_info', 'mandatory'];

export function goModeSupported(v) {
  return !GO_UNSUPPORTED_GROUPS.includes(variantMeta(v).group);
}

// Pineapple games are dealt three cards and discard one at some point:
// Pineapple before the flop, Crazy Pineapple after the flop, Lazy Pineapple on the river.
export function goDiscardStage(hand) {
  if (!hand || hand.cpDiscarded) return null;
  if (hand.variant === 'pineapple') return 'preflop';
  if (hand.variant === 'crazy_pineapple') return 'flop';
  if (hand.variant === 'lazy_pineapple') return 'river';
  return null;
}

// Rebuy eligibility for a single player; null means allowed, a string is the reason it is blocked.
export function rebuyBlocker(hand, player, level) {
  const rules = hand?.rebuyRules || {};
  const rebuyChips = Number(hand?.rebuyChips) || 0;
  const activeLevel = (Number(level ?? hand?.blindLevel) || 0) + 1;

  const timeLimit = rules.timeLimitEnabled ?? rules.timeCapEnabled;
  const cutoffLevel = Number(rules.timeCutoffLevel ?? rules.timeCapLevel) || 4;
  if (timeLimit && activeLevel > cutoffLevel) {
    return `Cutoff passed (lvl ${cutoffLevel})`;
  }
  if (!player) return 'No player';
  if (rules.stackCapEnabled) {
    const cap = Number(rules.stackCapAmount) || rebuyChips;
    if (cap > 0 && (Number(player.stack) || 0) > cap) return `Stack above ${cap}`;
  }
  // The live game and the MTT director use different keys for the same cap.
  if (rules.maxRebuysEnabled ?? rules.cappedRebuysEnabled) {
    const max = Number(rules.maxRebuys) || 0;
    if (max > 0 && (Number(player.rebuys) || 0) >= max) return `Max ${max} rebuys used`;
  }
  return null;
}

export { minChipInPlay, isMakeableBet } from './chipMath';

export function suggestAnte(bb) {
  bb = Number(bb) || 0;
  if (bb < 200) return 0;
  const raw = bb / 8;
  const inc = bb >= 800 ? 100 : bb >= 400 ? 50 : 25;
  return Math.max(inc, Math.round(raw / inc) * inc);
}

export function parseAmount(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return isFinite(raw) && !isNaN(raw) ? raw : null;
  let s = String(raw).trim().replace(/,/g, '');
  if (s === '') return null;
  s = s.replace(/^[^0-9.]+/, '').trim();
  if (s === '') return null;
  let mult = 1;
  const last = s.slice(-1).toLowerCase();
  if (last === 'k') {
    mult = 1000;
    s = s.slice(0, -1).trim();
  } else if (last === 'm') {
    mult = 1000000;
    s = s.slice(0, -1).trim();
  } else if (last === 'b') {
    mult = 1000000000;
    s = s.slice(0, -1).trim();
  }
  const v = Number(s);
  if (!isFinite(v) || isNaN(v)) return null;
  return Math.round(v * mult * 100) / 100;
}

export function calcAnteForType(anteType, bigBlind, levelAnte, bbaEarlyHalfAnte = false, bbaEarlyHalfAnteLevel = 2, currentLevelNum = 1) {
  const bb = parseAmount(bigBlind) ?? Number(bigBlind) ?? 0;
  const lAnte = parseAmount(levelAnte) ?? Number(levelAnte) ?? 0;
  if (anteType === 'bba') {
    if (bbaEarlyHalfAnte && currentLevelNum <= (Number(bbaEarlyHalfAnteLevel) || 2)) {
      return Math.round(bb * 0.5 * 100) / 100;
    }
    return bb;
  }
  if (anteType === 'btn_ante') return bb;
  if (anteType === 'sb_half_ante') return Math.round(bb * 0.5 * 100) / 100;
  if (anteType === 'traditional') return lAnte > 0 ? lAnte : suggestAnte(bb);
  return 0;
}

export function formatBlinds(hand) {
  if (!hand) return '';
  const isTourney = hand.mode === 'tournament';
  const cur = isTourney ? '' : (hand.currency || '');
  const fmt = (v) => `${cur}${formatKM(v)}`;

  if (hand.bombPot || isBombPotVariant(hand.variant)) {
    const bombAmt = hand.bombAmount || hand.anteAmount || (hand.bigBlind ? hand.bigBlind * 5 : 0);
    const label = (hand.doubleBoard || hand.variant === 'double_board_bomb_pot')
      ? 'Double Board Bomb Pot'
      : 'Bomb Pot';
    return `${fmt(bombAmt)} Ante (${label})`;
  }
  if (hand.variant === 'short_deck') {
    const ante = Number(hand.anteAmount) || (hand.mode === 'cash' ? 1 : Number(hand.bigBlind) || 1);
    return `${fmt(ante)} Ante (BTN ${fmt(ante * 2)})`;
  }

  const sb = fmt(hand.smallBlind);
  const bb = fmt(hand.bigBlind);

  if (hand.anteType === 'four_blinds') {
    const tbVal = hand.thirdBlind || (hand.bigBlind * 2);
    const fbVal = hand.fourthBlind || (hand.bigBlind * 4);
    const tb = fmt(tbVal);
    const fb = fmt(fbVal);
    return `${sb} / ${bb} / ${tb} / ${fb} (4 BLINDS)`;
  }

  if (hand.anteType === 'three_blinds') {
    const tbVal = hand.thirdBlind || (hand.bigBlind * 2);
    const tb = fmt(tbVal);
    return `${sb} / ${bb} / ${tb} (3 BLINDS)`;
  }

  const activeCount = (hand.players || []).filter((p) => p.status !== 'eliminated' && p.status !== 'out').length;
  const isShortHandedSB = hand.sbHalfAnteShortHanded && activeCount < (Number(hand.shortHandedThreshold) || 5);
  const effectiveAnte = hand.anteType === 'bba' && isShortHandedSB ? 'sb_half_ante' : hand.anteType;

  if (effectiveAnte === 'sb_half_ante') {
    const halfAmt = Math.round((Number(hand.bigBlind) || 0) * 0.5 * 100) / 100;
    const halfStr = fmt(halfAmt);
    return `${sb} / ${bb} - ${halfStr} (BBA 1/2 ANTE)`;
  }

  if (effectiveAnte === 'btn_ante') {
    const btnAmt = hand.anteAmount || hand.bigBlind;
    const btnStr = fmt(btnAmt);
    return `${sb} / ${bb} - ${btnStr} (BTN ANTE)`;
  }

  if (effectiveAnte === 'bba') {
    const curLevelNum = (hand.blindLevel || 0) + 1;
    const isBBAEarlyHalf = hand.bbaEarlyHalfAnte && curLevelNum <= (Number(hand.bbaEarlyHalfAnteLevel) || 2);
    const bbaAmt = isBBAEarlyHalf
      ? Math.round((Number(hand.bigBlind) || 0) * 0.5 * 100) / 100
      : (hand.anteAmount || hand.bigBlind);
    const bba = fmt(bbaAmt);
    return isBBAEarlyHalf ? `${sb} / ${bb} - ${bba} (BBA 1/2 ANTE)` : `${sb} / ${bb} - ${bba} (BBA)`;
  }

  if (effectiveAnte === 'traditional' && (parseAmount(hand.anteAmount) ?? Number(hand.anteAmount)) > 0) {
    const ante = fmt(hand.anteAmount);
    return `${sb} / ${bb} / ${ante} (ANTE)`;
  }

  return `${sb} / ${bb}`;
}

export function getSmallestChip(hand) {
  if (!hand) return 25;
  if (Array.isArray(hand.chipDenominations) && hand.chipDenominations.length > 0) {
    const valid = hand.chipDenominations.map(Number).filter((d) => d > 0);
    if (valid.length > 0) return Math.min(...valid);
  }
  return Number(hand.smallBlind) || 25;
}

function formatNumberTrimmed(n, maxDecimals) {
  if (maxDecimals <= 0) return String(Math.round(n));
  const rounded = Number(n.toFixed(maxDecimals));
  return String(rounded);
}

export function formatKWithDec(n, sym = '', sign = '') {
  const k = n / 1000;
  const rounded = Math.round(k * 10) / 10;
  const kStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${sign}${sym}${kStr}K`;
}

export function formatKM(val) {
  if (val == null || val === '') return '';
  const n = typeof val === 'number' ? val : (parseAmount(val) ?? Number(val));
  if (isNaN(n) || !isFinite(n)) return String(val);
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (absN >= 1000000000) {
    const b = absN / 1000000000;
    return `${sign}${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
  }
  if (absN >= 100000000) {
    return `${sign}${Math.round(absN / 1000000)}M`;
  }
  if (absN >= 1000000) {
    const m = absN / 1000000;
    const mStr = Math.round(m * 10) / 10;
    return `${sign}${mStr % 1 === 0 ? mStr.toFixed(0) : mStr.toFixed(1)}M`;
  }
  if (absN >= 100000) {
    return `${sign}${Math.round(absN / 1000)}K`;
  }
  if (absN >= 1000) {
    const k = absN / 1000;
    const kStr = Math.round(k * 10) / 10;
    return `${sign}${kStr % 1 === 0 ? kStr.toFixed(0) : kStr.toFixed(1)}K`;
  }
  return `${sign}${absN.toLocaleString('en-US')}`;
}

const SUIT_SORT_ORDER = { s: 0, h: 1, d: 2, c: 3 };

export function sortHoleCards(cards) {
  if (!Array.isArray(cards)) return cards;
  return [...cards].sort((a, b) => {
    if (!a || !b) return 0;
    const rankDiff = (RANKS.indexOf(b.rank) ?? -1) - (RANKS.indexOf(a.rank) ?? -1);
    if (rankDiff !== 0) return rankDiff;
    return (SUIT_SORT_ORDER[a.suit] ?? 99) - (SUIT_SORT_ORDER[b.suit] ?? 99);
  });
}

export function formatPlayerTagAmount(val, currency = '', hand = null, isSpectatorCash = false, displayUnit = 'chips') {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (!isFinite(n)) return '';
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const isTourney = hand?.mode === 'tournament';
  const sym = isTourney ? '' : (currency || '');
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';

  // 'both' is used at an all-in when players picked different stack units.
  if (activeUnit === 'both') {
    const chipsStr = formatPlayerTagAmount(val, currency, hand, isSpectatorCash, 'chips');
    const bbVal = Number(hand?.bigBlind) || 0;
    if (bbVal > 0) {
      const bbs = absN / bbVal;
      const rounded = absN > 0 && bbs < 1 ? '<1' : String(Math.round(bbs));
      return `${chipsStr} (${rounded} BB)`;
    }
    return chipsStr;
  }

  // In Big Blinds mode: round to 1 BB without a terminating zero, show <1 BB if stack < 1 BB
  if (activeUnit === 'bb') {
    const bbVal = Number(hand?.bigBlind) || 0;
    if (bbVal > 0) {
      const bbs = absN / bbVal;
      if (absN > 0 && bbs < 1) {
        return `${sign}<1 BB`;
      }
      const rounded = Math.round(bbs);
      return `${sign}${rounded} BB`;
    }
  }

  // In a cash game, remove formatting for stack size entirely for spectator view only
  if (isSpectatorCash && !isTourney) {
    const hasDec = !Number.isInteger(absN);
    const numStr = absN.toLocaleString('en-US', {
      minimumFractionDigits: hasDec ? 2 : 0,
      maximumFractionDigits: hasDec ? 2 : 0,
    });
    return `${sign}${sym}${numStr}`;
  }

  // Below 1K: full number
  if (absN < 1000) {
    const hasDec = !Number.isInteger(absN);
    const numStr = absN.toLocaleString('en-US', {
      minimumFractionDigits: hasDec ? 2 : 0,
      maximumFractionDigits: hasDec ? 2 : 0,
    });
    return `${sign}${sym}${numStr}`;
  }

  // 1K-100K: K, 1 decimal without terminating .0
  if (absN < 100000) {
    const k = absN / 1000;
    const rounded = Math.round(k * 10) / 10;
    const kStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${sign}${sym}${kStr}K`;
  }

  // 100K-1M: K, no decimal
  if (absN < 1000000) {
    return `${sign}${sym}${Math.round(absN / 1000)}K`;
  }

  // 1M-100M: M, 1 decimal without terminating .0
  if (absN < 100000000) {
    const m = absN / 1000000;
    const rounded = Math.round(m * 10) / 10;
    const mStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${sign}${sym}${mStr}M`;
  }

  // 100M-1B: M, no decimal
  if (absN < 1000000000) {
    return `${sign}${sym}${Math.round(absN / 1000000)}M`;
  }

  // 1B+
  const b = absN / 1000000000;
  const rounded = Math.round(b * 10) / 10;
  const bStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${sign}${sym}${bStr}B`;
}

export function formatSidePotAmount(amt, currency = '', hand = null, displayUnit = 'chips') {
  if (amt == null || amt === '') return '';
  const n = Number(amt);
  if (!isFinite(n)) return '';
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const isTourney = hand?.mode === 'tournament';
  const sym = isTourney ? '' : (currency || '');
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';

  if (activeUnit === 'bb') {
    const bbVal = Number(hand?.bigBlind) || 0;
    if (bbVal > 0) {
      const bbs = absN / bbVal;
      const rounded = Math.round(bbs * 10) / 10;
      const str = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
      return `${sign}${str} BB`;
    }
  }

  if (absN < 1000) {
    return `${sign}${sym}${absN}`;
  }
  if (absN < 1000000) {
    const k = absN / 1000;
    const kStr = k >= 100 ? Math.round(k) : (k % 1 === 0 ? k : k.toFixed(1));
    return `${sign}${sym}${kStr}K`;
  }
  const m = absN / 1000000;
  const mStr = m >= 100 ? Math.round(m) : (m % 1 === 0 ? m : m.toFixed(1));
  return `${sign}${sym}${mStr}M`;
}

export function formatBetAmount(val, currency = '', hand = null, displayUnit = 'chips') {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (!isFinite(n)) return '';
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const isTourney = hand?.mode === 'tournament';
  const sym = isTourney ? '' : (currency || '');
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';

  // If in BB mode: round betting amounts to nearest 0.1 BB without trailing zero
  if (activeUnit === 'bb') {
    const bbVal = Number(hand?.bigBlind) || 0;
    if (bbVal > 0) {
      const bbs = absN / bbVal;
      const rounded = Math.round(bbs * 10) / 10;
      const str = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
      return `${sign}${str} BB`;
    }
  }

  if (absN < 1000) {
    const hasDec = !Number.isInteger(absN);
    const numStr = absN.toLocaleString('en-US', {
      minimumFractionDigits: hasDec ? 2 : 0,
      maximumFractionDigits: hasDec ? 2 : 0,
    });
    return `${sign}${sym}${numStr}`;
  }
  if (absN < 1000000) {
    const k = absN / 1000;
    if (k >= 100) {
      return `${sign}${sym}${Math.round(k)}K`;
    }
    const rounded = Math.round(k * 100) / 100;
    let kStr;
    if (rounded % 1 === 0) kStr = rounded.toFixed(0);
    else if ((rounded * 10) % 1 === 0) kStr = rounded.toFixed(1);
    else kStr = rounded.toFixed(2);
    return `${sign}${sym}${kStr}K`;
  }
  const m = absN / 1000000;
  if (m >= 100) {
    return `${sign}${sym}${Math.round(m)}M`;
  }
  const roundedM = Math.round(m * 100) / 100;
  let mStr;
  if (roundedM % 1 === 0) mStr = roundedM.toFixed(0);
  else if ((roundedM * 10) % 1 === 0) mStr = roundedM.toFixed(1);
  else mStr = roundedM.toFixed(2);
  return `${sign}${sym}${mStr}M`;
}

export function shortDeckPositions(n) {
  if (n <= 2) return ['BTN', 'UTG'];
  if (n === 3) return ['BTN', 'UTG', 'CO'];
  if (n === 4) return ['BTN', 'UTG', '+1', 'CO'];
  if (n === 5) return ['BTN', 'UTG', '+1', 'HJ', 'CO'];
  if (n === 6) return ['BTN', 'UTG', '+1', 'LJ', 'HJ', 'CO'];
  const middlePlusCount = n - 5;
  const pluses = [];
  for (let i = 1; i <= middlePlusCount; i++) {
    pluses.push(i === 1 ? '+1' : `+${i}`);
  }
  return ['BTN', 'UTG', ...pluses, 'LJ', 'HJ', 'CO'];
}

export function positionForSeat(n, buttonIndex, seatOrderIndex, variant = null) {
  const offset = (seatOrderIndex - buttonIndex + n) % n;
  if (variant === 'short_deck') {
    const sLabels = shortDeckPositions(n);
    return sLabels[offset] || 'P';
  }
  const labels = POS[n] || POS[10];
  return labels[offset] || 'P';
}

export function positions(h) {
  if (!h || !h.players) return [];
  const n = h.players.length;
  const bi = getButtonIndex(h);
  return h.players.map((_, i) => positionForSeat(n, bi, i, h.variant));
}

export function effectiveHoleSize(hand) {
  const variant = (typeof hand === 'string' ? hand : hand?.variant) || 'nlh';
  const meta = variantMeta(variant);
  if (variant === 'pineapple') return 2;
  if (variant === 'lazy_pineapple') return hand?.street === 'river' ? 2 : 3;
  if (variant === 'crazy_pineapple') return hand?.cpDiscarded ? 2 : (hand?.cpNeedsDiscard ? 3 : 2);
  return meta.holeSize;
}

export function holeCardsComplete(hand, cards) {
  if (!cards) return false;
  const variant = hand.variant || 'nlh';
  const need = effectiveHoleSize(hand);
  if (variant === 'lazy_pineapple' && hand.street === 'river') return cards.length === 2 || cards.length === 3;
  return cards.length === need;
}

export function variantRanks(variant) {
  const meta = variantMeta(variant);
  return meta.deck === 'short' ? ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] : RANKS;
}

export const SUIT_COLOR_CLASS = {
  s: 'text-slate-900 font-bold',
  h: 'text-rose-600 font-bold',
  d: 'text-blue-600 font-bold',
  c: 'text-emerald-600 font-bold',
};

export function suitColorClass(suit, suitColors = 2) {
  if (suitColors === 2) {
    if (suit === 'h' || suit === 'd') return 'text-rose-600';
    return 'text-slate-900';
  }
  return SUIT_COLOR_CLASS[suit] || 'text-slate-900 font-bold';
}

export function parseCards(text, allowedRanks) {
  const ranks = allowedRanks || RANKS;
  const rankSet = new Set(ranks);
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const cards = [];
  for (const t of tokens) {
    if (!/^[2-9TJQKA][shdc]$/i.test(t)) return { error: `Invalid card: "${t}"` };
    const r = t[0].toUpperCase();
    if (!rankSet.has(r)) return { error: `"${t}" is not a valid card for this variant` };
    cards.push({ rank: r, suit: t[1].toLowerCase() });
  }
  return { cards };
}

export function clone(h) {
  return JSON.parse(JSON.stringify(h));
}

export function getButtonIndex(h) {
  return h.players.findIndex((p) => p.seat === h.buttonSeat);
}

export function getPostflopButtonAnchor(h) {
  if (!h || !Array.isArray(h.players) || h.players.length === 0) return -1;
  const bi = getButtonIndex(h);
  if (bi >= 0) return bi;
  const n = h.players.length;
  const nextIdx = h.players.findIndex((p) => Number(p.seat) > Number(h.buttonSeat));
  const targetIdx = nextIdx >= 0 ? nextIdx : 0;
  return (targetIdx - 1 + n) % n;
}

export function getSBIndex(h) {
  const n = h.players.length;
  return n === 2 ? getButtonIndex(h) : (getButtonIndex(h) + 1) % n;
}

export function getBBIndex(h) {
  const n = h.players.length;
  return n === 2 ? (getButtonIndex(h) + 1) % n : (getButtonIndex(h) + 2) % n;
}

export function firstActiveAfter(players, fromIndex) {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (players[idx].status === 'active' && players[idx].stack > 0) return idx;
  }
  return -1;
}

export function nextToAct(players, fromIndex, killIdx, killDeferred, shortAllinOpen) {
  const n = players.length;
  const currentBet = players.reduce((max, p) => Math.max(max, p.currentBet || 0), 0);
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const p = players[idx];
    if (p.status !== 'active' || p.stack <= 0) continue;
    if (shortAllinOpen && p.hasActed && p.currentBet >= currentBet) continue;
    if (killDeferred && idx === killIdx) {
      const others = players.some((pl, j) => j !== killIdx && pl.status === 'active' && pl.stack > 0 && !pl.hasActed);
      if (others) continue;
    }
    return idx;
  }
  return -1;
}

export function canActPlayers(h) {
  return h.players.filter((p) => p.status === 'active' && p.stack > 0);
}

export function bettingFrozen(h) {
  if (!h || !h.players) return true;
  const nf = h.players.filter((p) => p.status !== 'folded');
  if (nf.length < 2) return true;
  const activeWithChips = nf.filter((p) => p.status !== 'allin' && p.stack > 0);
  if (activeWithChips.length === 0) return true;
  if (activeWithChips.length === 1) {
    const p = activeWithChips[0];
    if (h.currentBet > 0) {
      return (p.currentBet || 0) >= h.currentBet;
    }
    return true;
  }
  return false;
}

export function streetComplete(h) {
  const act = canActPlayers(h);
  if (act.length === 0) return true;
  if (bettingFrozen(h)) {
    if (act.some((p) => p.currentBet < h.currentBet)) return false;
    return true;
  }
  if (act.some((p) => p.currentBet < h.currentBet)) return false;
  if (h.shortAllinOpen) {
    const unacted = act.filter((p) => !p.hasActed || p.currentBet < h.currentBet);
    if (unacted.length === 0) return true;
    return false;
  }
  if (act.length === 1) {
    const p = act[0];
    if (p.currentBet < h.currentBet) return false;
    if (!p.hasActed) return false;
    return true;
  }
  if (act.every((p) => p.hasActed && p.currentBet === h.currentBet)) return true;
  return false;
}

export function potTotal(h) {
  return h.players.reduce((s, p) => s + p.totalBet, 0);
}

export function hasSoleDeepestStack(h, playerId) {
  if (!h || !h.players) return false;
  const p = h.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  const n = h.players.length;
  const buttonIndex = h.players.findIndex((pl) => pl.seat === h.buttonSeat);
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;

  const getCapacity = (pl) => {
    return (pl.currentBet || 0) + (pl.stack || 0);
  };

  const pTotal = getCapacity(p);
  const otherNonFolded = h.players.filter((pl) => pl.id !== playerId && pl.status !== 'folded');
  if (otherNonFolded.length === 0) return true;
  return otherNonFolded.every((o) => pTotal > getCapacity(o));
}

export function raiseLabel(level, live = false) {
  if (!level || level <= 1) return 'Bet';
  // Live rooms call the first bet and every later raise a "raise".
  if (live) return 'Raise';
  if (level === 2) return 'Raise';
  return `${level}-bet`;
}

export function actionLabel(la, live = false) {
  if (!la) return '';
  if (la.type === 'fold') return 'Fold';
  if (la.type === 'check') return 'Check';
  if (la.type === 'call') return 'Call';
  if (la.type === 'allin') return 'All-in';
  if (la.type === 'sb') return 'SB';
  if (la.type === 'bb') return 'BB';
  if (la.type === 'ante') return 'Ante';
  if (la.type === '3b') return '3B';
  if (la.type === '4b') return '4B';
  if (la.type === 'straddle') return 'Straddle';
  if (la.type === 'kill') return 'Kill';
  if (la.type === 'bet' || la.type === 'raise') return raiseLabel(la.raiseLevel, live);
  return la.type;
}

export function startHand(config, buttonSeat, handNumber) {
  const players = config.players.map((p, i) => ({
    id: i,
    name: p.name || `Player ${i + 1}`,
    seat: p.seat,
    initialStack: p.stack,
    stack: p.stack,
    currentBet: 0,
    totalBet: 0,
    antePaid: 0,
    status: 'active',
    lastAction: null,
    hasActed: false,
    reentries: p.reentries || 0,
    rebuys: p.rebuys || 0,
    timeBanks: p.timeBanks != null ? p.timeBanks : (config.clockConfig?.initialTimeBanks ?? 3),
    usedBanks: p.usedBanks || 0,
  }));
  const n = players.length;
  const buttonIndex = players.findIndex((p) => p.seat === buttonSeat);
  const isThreeBlinds = config.anteType === 'three_blinds' && n >= 3;
  const isFourBlinds = config.anteType === 'four_blinds' && n >= 4;
  // Explicit blind seats let callers model a dead button / dead small blind: a
  // seat that is no longer occupied simply posts nothing.
  const blindCfg = config.blindSeats || null;
  const resolveSeat = (seat) => (seat == null ? -1 : players.findIndex((p) => Number(p.seat) === Number(seat)));
  const sbIndex = blindCfg && blindCfg.sbSeat != null
    ? resolveSeat(blindCfg.sbSeat)
    : (n === 2 ? buttonIndex : (buttonIndex + 1) % n);
  const bbIndex = blindCfg && blindCfg.bbSeat != null
    ? resolveSeat(blindCfg.bbSeat)
    : (n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n);
  const tbIndex = (isThreeBlinds || isFourBlinds) ? (buttonIndex + 3) % n : -1;
  const fbIndex = isFourBlinds ? (buttonIndex + 4) % n : -1;

  const activeCount = players.filter((p) => p.status !== 'eliminated' && p.status !== 'out').length;
  const isShortHandedSB = config.sbHalfAnteShortHanded && activeCount < (Number(config.shortHandedThreshold) || 5);
  let effectiveAnteType = config.anteType;
  if (config.anteType === 'bba' && isShortHandedSB) {
    effectiveAnteType = 'sb_half_ante';
  }

  const bba = effectiveAnteType === 'bba';
  const isBtnAnte = effectiveAnteType === 'btn_ante';
  const isSBHalfAnte = effectiveAnteType === 'sb_half_ante';
  const curLevelNum = (config.blindLevel || 0) + 1;
  const isBBAEarlyHalf = bba && config.bbaEarlyHalfAnte && curLevelNum <= (Number(config.bbaEarlyHalfAnteLevel) || 2);
  const ante = (bba || isBtnAnte)
    ? (isBBAEarlyHalf ? Math.round((Number(config.bigBlind) || 0) * 0.5 * 100) / 100 : config.bigBlind)
    : isSBHalfAnte
    ? Math.round((Number(config.bigBlind) || 0) * 0.5 * 100) / 100
    : (config.anteAmount || 0);
  const variant = config.variant || 'holdem';
  const isPermBomb = isBombPotVariant(variant);
  const bombPot = isPermBomb || !!config.bombPot;
  const bombAmount = Number(config.bombAmount) || (isPermBomb ? (Number(config.anteAmount) || 10) : 0) || config.bigBlind || 10;
  const permBoards = variant === 'double_board_bomb_pot' ? 2 : 1;
  const bombBoardsCount = isPermBomb && config.bombBoards == null ? permBoards : (Number(config.bombBoards) || (config.doubleBoard ? 2 : 1));
  const wasKill = !!config.killActive && config.killSeat != null;

  const common = {
    players,
    buttonSeat,
    sbSeat: sbIndex >= 0 ? players[sbIndex].seat : (blindCfg ? Number(blindCfg.sbSeat) : null),
    bbSeat: bbIndex >= 0 ? players[bbIndex].seat : (blindCfg ? Number(blindCfg.bbSeat) : null),
    smallBlind: isPermBomb ? 0 : config.smallBlind,
    bigBlind: isPermBomb ? 0 : config.bigBlind,
    thirdBlind: config.thirdBlind != null ? Number(config.thirdBlind) : (config.bigBlind * 2),
    fourthBlind: config.fourthBlind != null ? Number(config.fourthBlind) : (config.bigBlind * 4),
    anteType: isPermBomb ? 'traditional' : config.anteType,
    effectiveAnteType: isPermBomb ? 'traditional' : effectiveAnteType,
    sbHalfAnteShortHanded: !!config.sbHalfAnteShortHanded,
    shortHandedThreshold: Number(config.shortHandedThreshold) || 5,
    bbaEarlyHalfAnte: !!config.bbaEarlyHalfAnte,
    bbaEarlyHalfAnteLevel: Number(config.bbaEarlyHalfAnteLevel) || 2,
    anteAmount: isPermBomb
      ? bombAmount
      : (effectiveAnteType === 'bba' || effectiveAnteType === 'btn_ante')
      ? (isBBAEarlyHalf ? Math.round((Number(config.bigBlind) || 0) * 0.5 * 100) / 100 : config.bigBlind)
      : effectiveAnteType === 'sb_half_ante'
      ? Math.round((Number(config.bigBlind) || 0) * 0.5 * 100) / 100
      : (config.anteAmount || 0),
    actionHistory: [],
    handNumber,
    phase: 'playing',
    pots: [],
    winners: [],
    currency: config.currency || '',
    mode: config.mode || 'tournament',
    blindSchedule: config.blindSchedule || [],
    blindLevel: config.blindLevel || 0,
    levelConfig: config.levelConfig || null,
    levelStartEpoch: config.levelStartEpoch || null,
    levelHandsCompleted: config.levelHandsCompleted || 0,
    levelCount: config.levelCount || players.length,
    tLevel: config.tLevel ?? 0,
    inBreak: !!config.inBreak,
    pausedMs: config.pausedMs || 0,
    pauseStart: config.pauseStart ?? null,
    pendingLevelIdx: config.pendingLevelIdx ?? (config.blindLevel || 0),
    variant,
    baseVariant: isPermBomb ? variant : (config.baseVariant || (bombPot ? (config.baseVariant || 'holdem') : variant)),
    bombPot,
    bombAmount,
    bombBoards: bombBoardsCount,
    sideGames: config.sideGames || {},
    wonPots: config.wonPots || [],
    lastWinnerSeat: config.lastWinnerSeat ?? null,
    consecWins: config.consecWins || 0,
    killActive: config.killActive != null ? !!config.killActive : false,
    killSeat: config.killSeat ?? null,
    killType: config.killType || 'kill',
    killIdx: -1,
    killDeferred: false,
    doubleBoard: bombPot ? (bombBoardsCount >= 2) : !!config.doubleBoard,
    baseDoubleBoard: isPermBomb ? (variant === 'double_board_bomb_pot') : (config.baseDoubleBoard !== undefined ? config.baseDoubleBoard : !!config.doubleBoard),
    temporaryGames: config.temporaryGames || [],
    isTemporaryGame: !!config.isTemporaryGame,
    temporaryGameTitle: config.temporaryGameTitle || null,
    baseGameType: config.baseGameType || config.gameType || 'nl',
    baseBombPot: isPermBomb ? true : (config.baseBombPot !== undefined ? config.baseBombPot : !!config.bombPot),
    baseBombBoards: isPermBomb ? permBoards : (config.baseBombBoards || (config.bombBoards || 1)),
    runTimes: 1,
    boardB: [],
    boardC: [],
    straddleAmount: config.straddleAmount != null ? Number(config.straddleAmount) : null,
    mandatoryStraddleAmount: config.mandatoryStraddleAmount != null ? Number(config.mandatoryStraddleAmount) : null,
    mandatoryDoubleStraddle: !!config.mandatoryDoubleStraddle,
    mandatoryDoubleStraddleAmount: config.mandatoryDoubleStraddleAmount != null ? Number(config.mandatoryDoubleStraddleAmount) : null,
    smallBet: Number(config.smallBet) || config.bigBlind,
    bigBet: Number(config.bigBet) || (config.bigBlind * 2),
    flMaxRaises: Number(config.flMaxRaises) || 4,
    chipDenominations: Array.isArray(config.chipDenominations) ? config.chipDenominations : null,
    tableSize: config.tableSize || players.length,
    tournamentFormat: config.tournamentFormat || 'freezeout',
    maxReEntries: config.maxReEntries || 0,
    lateRegLevel: config.lateRegLevel || 0,
    lateRegEnabled: config.lateRegEnabled !== false,
    startingStack: config.startingStack || (players.length ? players[0].initialStack : 0),
    rebuyPrice: config.rebuyPrice,
    rebuyChips: config.rebuyChips,
    rebuyRules: config.rebuyRules || null,
    allowAddOn: config.allowAddOn,
    addOnPrice: config.addOnPrice,
    addOnChips: config.addOnChips,
    eliminatedPlayers: config.eliminatedPlayers || [],
    clockConfig: config.clockConfig || { clockSystem: 'call_clock', callClockSeconds: 30 },
    shotClockEnabled: config.shotClockEnabled !== undefined ? config.shotClockEnabled : true,
  };

  if (config.inBreak && config.mode === 'tournament') {
    return {
      ...common,
      street: 'preflop',
      currentBet: 0,
      lastRaiseAmount: isPermBomb ? bombAmount : config.bigBlind,
      communityCards: [],
      currentPlayer: -1,
      message: isPermBomb
        ? 'Break in progress – resume play to post antes and start the hand'
        : 'Break in progress – resume play to post blinds and start the hand',
      raiseLevel: 0,
      allowStraddle: !bombPot && !!config.allowStraddle,
      allowMultiStraddle: !bombPot && !!config.allowMultiStraddle,
      mandatoryStraddle: !bombPot && !!config.mandatoryStraddle,
      maxStraddles: (!bombPot && (config.allowStraddle || config.mandatoryStraddle)) ? (config.allowMultiStraddle ? 99 : 1) : 0,
      straddleLevel: 0,
      straddleOpen: !bombPot && (!!config.allowStraddle || !!config.mandatoryStraddle),
      killIdx: -1,
      killDeferred: false,
      blindsPosted: false,
    };
  }

  if (bombPot) {
    players.forEach((p) => {
      const a = Math.min(bombAmount, p.stack);
      p.stack -= a;
      p.totalBet += a;
      p.antePaid = (p.antePaid || 0) + a;
      p.currentBet = 0;
      p.lastAction = { type: 'ante', amount: a };
    });
    players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });
    const bCount = bombBoardsCount;
    const mainPotAmt = players.reduce((s, p) => s + p.totalBet, 0);
    const anchor = getPostflopButtonAnchor({ players, buttonSeat });
    return {
      ...common,
      pots: [{ amount: mainPotAmt, eligible: players.map((p) => p.id) }],
      street: 'flop',
      currentBet: 0,
      lastRaiseAmount: config.bigBlind || bombAmount || 10,
      raiseLevel: 0,
      communityCards: [{ hidden: true }, { hidden: true }, { hidden: true }],
      boardB: bCount >= 2 ? [{ hidden: true }, { hidden: true }, { hidden: true }] : [],
      boardC: bCount >= 3 ? [{ hidden: true }, { hidden: true }, { hidden: true }] : [],
      doubleBoard: bCount >= 2,
      bombBoards: bCount,
      currentPlayer: bettingFrozen({ players, currentBet: 0 }) ? -1 : firstActiveAfter(players, anchor),
      message: `${bCount >= 2 ? 'Double board bomb pot' : 'Bomb pot'} – flop is out, no preflop action`,
      allowStraddle: false,
      allowMultiStraddle: false,
      mandatoryStraddle: false,
      mandatoryDoubleStraddle: false,
      maxStraddles: 0,
      straddleLevel: 0,
      straddleOpen: false,
    };
  }

  if (variant === 'short_deck') {
    const ante = Number(config.anteAmount) || (config.mode === 'cash' ? 1 : Number(config.bigBlind) || 1);
    players.forEach((p) => {
      const a = Math.min(ante, p.stack);
      p.stack -= a;
      p.totalBet += a;
      p.antePaid = (p.antePaid || 0) + a;
      p.currentBet = 0;
      p.lastAction = { type: 'ante', amount: a };
    });
    const btnPay = Math.min(ante, players[buttonIndex].stack);
    players[buttonIndex].stack -= btnPay;
    players[buttonIndex].totalBet += btnPay;
    players[buttonIndex].currentBet = btnPay;
    players[buttonIndex].lastAction = { type: 'btn_ante', amount: btnPay + ante };
    players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });

    return {
      ...common,
      street: 'preflop',
      currentBet: btnPay,
      lastRaiseAmount: btnPay,
      raiseLevel: 1,
      communityCards: [],
      currentPlayer: firstActiveAfter(players, buttonIndex),
      message: `Short Deck: ${money(ante, config.currency)} ante (${money(btnPay + ante, config.currency)} on BTN)`,
      allowStraddle: false,
      allowMultiStraddle: false,
      mandatoryStraddle: false,
      mandatoryDoubleStraddle: false,
      maxStraddles: 0,
      straddleLevel: 0,
      straddleOpen: false,
      anteAmount: ante,
    };
  }

  if (effectiveAnteType === 'traditional' && ante > 0) {
    players.forEach((p) => {
      const a = Math.min(ante, p.stack);
      p.stack -= a;
      p.totalBet += a;
      p.antePaid = (p.antePaid || 0) + a;
    });
  }

  if (sbIndex >= 0) {
    const sb = Math.min(config.smallBlind, players[sbIndex].stack);
    players[sbIndex].stack -= sb;
    players[sbIndex].currentBet = sb;
    players[sbIndex].totalBet += sb;
    players[sbIndex].lastAction = { type: 'sb', amount: sb };
  }

  let bb = config.bigBlind;
  if (bbIndex >= 0) {
    bb = Math.min(config.bigBlind, players[bbIndex].stack);
    players[bbIndex].stack -= bb;
    players[bbIndex].currentBet = bb;
    players[bbIndex].totalBet += bb;
    players[bbIndex].lastAction = { type: 'bb', amount: bb };
  }

  if (isFourBlinds && tbIndex >= 0 && fbIndex >= 0) {
    const tbTarget = Number(config.thirdBlind) || (config.bigBlind * 2);
    const tb = Math.min(tbTarget, players[tbIndex].stack);
    players[tbIndex].stack -= tb;
    players[tbIndex].currentBet = tb;
    players[tbIndex].totalBet += tb;
    players[tbIndex].lastAction = { type: '3b', amount: tb };

    const fbTarget = Number(config.fourthBlind) || (config.bigBlind * 4);
    const fb = Math.min(fbTarget, players[fbIndex].stack);
    players[fbIndex].stack -= fb;
    players[fbIndex].currentBet = fb;
    players[fbIndex].totalBet += fb;
    players[fbIndex].lastAction = { type: '4b', amount: fb };
  } else if (isThreeBlinds && tbIndex >= 0) {
    const tbTarget = Number(config.thirdBlind) || (config.bigBlind * 2);
    const tb = Math.min(tbTarget, players[tbIndex].stack);
    players[tbIndex].stack -= tb;
    players[tbIndex].currentBet = tb;
    players[tbIndex].totalBet += tb;
    players[tbIndex].lastAction = { type: '3b', amount: tb };
  }

  if (bba && ante > 0 && bbIndex >= 0) {
    const a = Math.min(ante, players[bbIndex].stack);
    players[bbIndex].stack -= a;
    players[bbIndex].totalBet += a;
    players[bbIndex].antePaid = (players[bbIndex].antePaid || 0) + a;
  }
  if (isBtnAnte && ante > 0) {
    const a = Math.min(ante, players[buttonIndex].stack);
    players[buttonIndex].stack -= a;
    players[buttonIndex].totalBet += a;
    players[buttonIndex].antePaid = (players[buttonIndex].antePaid || 0) + a;
  }
  if (isSBHalfAnte && ante > 0 && bbIndex >= 0) {
    const a = Math.min(ante, players[bbIndex].stack);
    players[bbIndex].stack -= a;
    players[bbIndex].totalBet += a;
    players[bbIndex].antePaid = (players[bbIndex].antePaid || 0) + a;
  }

  players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });

  const allowStraddle = !!config.allowStraddle;
  const allowMulti = !!config.allowMultiStraddle;
  const mandatoryStraddle = !!config.mandatoryStraddle;
  const straddleEnabled = allowStraddle || mandatoryStraddle;
  const maxStraddles = straddleEnabled ? (allowMulti ? 99 : 1) : 0;
  let straddleLevel = 0;
  let straddleOpen = straddleEnabled;

  let currentBet = players.reduce((m, p) => Math.max(m, p.currentBet || 0), 0) || bb;
  let lastRaiseAmount = config.bigBlind;
  let raiseLevel = 1;
  let first = bbIndex >= 0 ? firstActiveAfter(players, bbIndex) : firstActiveAfter(players, buttonIndex);

  if (isFourBlinds && fbIndex >= 0) {
    currentBet = players[fbIndex].currentBet || (Number(config.fourthBlind) || (config.bigBlind * 4));
    lastRaiseAmount = currentBet;
    raiseLevel = 1;
    first = firstActiveAfter(players, fbIndex);
  } else if (isThreeBlinds && tbIndex >= 0) {
    currentBet = players[tbIndex].currentBet || (Number(config.thirdBlind) || (config.bigBlind * 2));
    lastRaiseAmount = currentBet;
    raiseLevel = 1;
    first = firstActiveAfter(players, tbIndex);
  }

  let killPosted = false;
  let killIdx = -1;
  let killDeferred = false;
  if (wasKill) {
    const kIdx = players.findIndex((p) => Number(p.seat) === Number(config.killSeat));
    if (kIdx >= 0 && players[kIdx].status === 'active') {
      const killBlind = Math.round(config.bigBlind * (config.killType === 'half' ? 1.5 : 2));
      const prevBet = currentBet;
      const pay = Math.min(Math.max(killBlind - players[kIdx].currentBet, 0), players[kIdx].stack);
      players[kIdx].stack -= pay;
      players[kIdx].currentBet += pay;
      players[kIdx].totalBet += pay;
      if (players[kIdx].currentBet > prevBet) {
        lastRaiseAmount = Math.max(players[kIdx].currentBet - prevBet, config.bigBlind);
        currentBet = players[kIdx].currentBet;
        raiseLevel = 2;
      }
      players[kIdx].lastAction = { type: 'kill', amount: players[kIdx].currentBet, raiseLevel: 2 };
      if (players[kIdx].stack === 0) players[kIdx].status = 'allin';
      killIdx = kIdx;
      killDeferred = true;
      killPosted = true;
      first = nextToAct(players, bbIndex, killIdx, killDeferred);
    }
  }

  if (mandatoryStraddle && !killPosted) {
    const sidx = firstActiveAfter(players, bbIndex);
    if (sidx >= 0) {
      const target = Number(config.mandatoryStraddleAmount) || (Number(config.straddleAmount) || (config.bigBlind * 2));
      const a = Math.min(target, players[sidx].stack);
      players[sidx].stack -= a;
      players[sidx].currentBet = a;
      players[sidx].totalBet += a;
      straddleLevel = 1;
      lastRaiseAmount = Math.max(a - currentBet, config.bigBlind);
      currentBet = a;
      raiseLevel = 1;
      first = firstActiveAfter(players, sidx);
      if (players[sidx].stack === 0) {
        players[sidx].status = 'allin';
        players[sidx].lastAction = { type: 'allin', amount: a, raiseLevel: 1 };
      } else {
        players[sidx].lastAction = { type: 'straddle', amount: a, raiseLevel: 1 };
      }
      if (config.mandatoryDoubleStraddle) {
        const dsidx = firstActiveAfter(players, sidx);
        if (dsidx >= 0 && dsidx !== sidx) {
          const doubleTarget = Number(config.mandatoryDoubleStraddleAmount) || (target * 2);
          const da = Math.min(doubleTarget, players[dsidx].stack);
          players[dsidx].stack -= da;
          players[dsidx].currentBet = da;
          players[dsidx].totalBet += da;
          straddleLevel = 2;
          lastRaiseAmount = Math.max(da - currentBet, config.bigBlind);
          currentBet = da;
          raiseLevel = 1;
          first = firstActiveAfter(players, dsidx);
          if (players[dsidx].stack === 0) {
            players[dsidx].status = 'allin';
            players[dsidx].lastAction = { type: 'allin', amount: da, raiseLevel: 1 };
          } else {
            players[dsidx].lastAction = { type: 'straddle', amount: da, raiseLevel: 1 };
          }
        }
      }
    }
  }

  players.forEach((p) => {
    if (p.stack === 0) p.status = 'allin';
  });

  if (bettingFrozen({ players, currentBet })) {
    first = -1;
    straddleOpen = false;
  }

  return {
    ...common,
    street: 'preflop',
    currentBet,
    lastRaiseAmount,
    communityCards: [],
    currentPlayer: first,
    message: null,
    raiseLevel,
    allowStraddle,
    allowMultiStraddle: allowMulti,
    mandatoryStraddle,
    maxStraddles,
    straddleLevel,
    straddleOpen,
    killIdx,
    killDeferred,
  };
}

function maxContestableByOthers(h, excludeId) {
  const others = h.players.filter((p) => p.id !== excludeId && p.status !== 'folded');
  if (!others.length) return Infinity;
  return Math.max(...others.map((o) => (o.currentBet || 0) + (o.stack || 0)));
}

function applyOversizedCap(h) {
  const nonFolded = h.players.filter((p) => p.status !== 'folded');
  if (nonFolded.length < 2) return;
  let maxPlayer = null;
  for (const p of nonFolded) {
    const isShover = (p.lastAction && (p.lastAction.type === 'allin' || p.lastAction.type === 'raise' || p.lastAction.type === 'bet')) || p._wasCapped;
    if (!isShover) continue;
    if (!maxPlayer || p.currentBet > maxPlayer.currentBet) maxPlayer = p;
  }
  if (!maxPlayer || maxPlayer.currentBet === 0) return;
  const cap = maxContestableByOthers(h, maxPlayer.id);
  if (cap === Infinity || maxPlayer.currentBet <= cap) return;
  const excess = maxPlayer.currentBet - cap;
  maxPlayer.stack += excess;
  maxPlayer.currentBet = cap;
  maxPlayer.totalBet -= excess;
  maxPlayer._wasCapped = true;
  if (maxPlayer.stack > 0) maxPlayer.status = 'active';

  const otherNonFolded = nonFolded.filter((p) => p.id !== maxPlayer.id);
  const otherMaxBet = otherNonFolded.length > 0 ? Math.max(...otherNonFolded.map((p) => p.currentBet)) : 0;

  if (maxPlayer.currentBet <= otherMaxBet) {
    // Player's bet has been capped down to matching the opponents' bet -> It's a CALL!
    maxPlayer.lastAction = {
      type: 'call',
      amount: maxPlayer.currentBet,
      raiseLevel: 1,
    };
  } else {
    // Player's bet is still higher than otherMaxBet -> It's a RAISE over otherMaxBet!
    const isRaise = otherMaxBet > 0 || h.street === 'preflop';
    maxPlayer.lastAction = {
      type: isRaise ? 'raise' : 'bet',
      amount: cap,
      raiseLevel: maxPlayer.lastAction?.raiseLevel || (isRaise ? 2 : 1),
    };
  }

  // Update action history entry for maxPlayer if present on this street
  if (Array.isArray(h.actionHistory)) {
    for (let idx = h.actionHistory.length - 1; idx >= 0; idx--) {
      const entry = h.actionHistory[idx];
      if (entry.player === maxPlayer.name && entry.street === h.street) {
        entry.action = actionLabel(maxPlayer.lastAction);
        entry.chips = maxPlayer.lastAction.amount || maxPlayer.currentBet;
        entry.pot = potTotal(h);
        break;
      }
    }
  }

  h.currentBet = Math.max(...nonFolded.map((p) => p.currentBet));
  const opp = otherNonFolded.find((p) => p.currentBet === otherMaxBet);
  if (maxPlayer.currentBet <= otherMaxBet) {
    h.raiseLevel = opp?.lastAction?.raiseLevel || (h.street === 'preflop' ? 1 : 0);
    h.lastRaiseAmount = h.bigBlind;
  } else {
    if (otherMaxBet > 0) h.lastRaiseAmount = maxPlayer.currentBet - otherMaxBet;
    else h.lastRaiseAmount = h.bigBlind;
  }
}

const MANDATORY_LABEL = {
  mandatory_3bet: 'Mandatory 3-Bet',
  mandatory_raise: 'Mandatory Raise',
};

/**
 * Mandatory-action variants forbid calling or limping until the required amount
 * of aggression has happened. Returns null when calling is allowed, or an object
 * with the reason it is not. An all-in bet may always be called, and a call that
 * puts the caller all in is always allowed (there is nothing else to do).
 */
export function mandatoryCallBlocker(hand, playerIndex) {
  if (!hand) return null;
  const variant = hand.variant;
  if (!MANDATORY_LABEL[variant]) return null;
  const street = hand.street || 'preflop';
  if (variant === 'mandatory_3bet' && street !== 'preflop') return null;
  const level = Number(hand.raiseLevel) || (street === 'preflop' ? 1 : 0);
  const need = street === 'preflop'
    ? (variant === 'mandatory_3bet' ? 3 : 2)
    : 1;
  if (level >= need) return null;
  if (variant === 'mandatory_3bet' && hand.threeBetOccurred) return null;

  const idx = playerIndex != null ? playerIndex : hand.currentPlayer;
  const p = idx != null && idx >= 0 ? hand.players?.[idx] : null;
  const toCall = p ? Math.max(0, (hand.currentBet || 0) - (p.currentBet || 0)) : 0;
  if (p && toCall > 0 && toCall >= (p.stack || 0)) return null;
  const betWasAllIn = (hand.players || []).some((o) => o.status !== 'folded'
    && o.id !== (p && p.id)
    && (o.stack || 0) === 0
    && (o.currentBet || 0) === (hand.currentBet || 0)
    && (hand.currentBet || 0) > 0);
  if (betWasAllIn) return null;

  const label = MANDATORY_LABEL[variant];
  const what = variant === 'mandatory_3bet' ? 'a 3-bet' : 'a raise';
  const where = street === 'preflop' ? ' preflop' : ' on this street';
  return { label, reason: `${label}: calling or limping is not allowed until there is ${what}${where}. Raise or fold.` };
}

export function applyAction(hand, playerId, type, amount) {
  const h = clone(hand);
  h._refundsApplied = false;
  if (h.ootActions) h.ootActions = h.ootActions.filter((o) => o.playerId !== playerId);
  const p = h.players[playerId];

  const otherNonFolded = h.players.filter((o) => o.id !== playerId && o.status !== 'folded');
  const othersHaveChips = otherNonFolded.some((o) => (o.stack || 0) > 0);
  const otherMaxBet = otherNonFolded.length > 0 ? Math.max(...otherNonFolded.map((o) => o.currentBet || 0)) : 0;
  const toCall = Math.max(0, h.currentBet - p.currentBet);

  if ((type === 'bet' || type === 'raise') && toCall > 0) {
    if (!othersHaveChips || (amount != null && (amount <= otherMaxBet || amount <= toCall + p.currentBet))) {
      type = 'call';
    }
  }

  if (h.mode === 'tournament' && (type === 'bet' || type === 'raise')) {
    if (!isMakeableBet(h, amount)) {
      const min = minChipInPlay(h);
      return { error: `Bet must be a multiple of ${min}.` };
    }
  }

  if (type !== 'straddle') h.straddleOpen = false;

  if (type === 'fold') {
    p.status = 'folded';
    p.lastAction = { type: 'fold' };
    p.hasActed = true;
  } else if (type === 'check') {
    p.lastAction = { type: 'check' };
    p.hasActed = true;
  } else if (type === 'call') {
    const mandatoryBlock = mandatoryCallBlocker(h, h.players.findIndex((o) => o.id === playerId));
    if (mandatoryBlock) return { error: mandatoryBlock.reason };
    const pay = Math.min(toCall, p.stack);
    p.stack -= pay;
    p.currentBet += pay;
    p.totalBet += pay;
    const isShortAllinCall = p.stack === 0 && p.currentBet < h.currentBet;
    p.lastAction = { type: isShortAllinCall ? 'allin' : 'call', amount: p.currentBet, callAmount: pay, raiseLevel: h.raiseLevel || 1 };
    p.hasActed = true;
    if (p.stack === 0) p.status = 'allin';
    if (h.ootActions) h.ootActions = h.ootActions.filter((o) => o.playerId !== p.id);
  } else if (type === 'bet' || type === 'raise') {
    const raiseTo = amount;
    const pay = Math.max(0, raiseTo - p.currentBet);
    const actual = Math.min(pay, p.stack);
    p.stack -= actual;
    p.currentBet += actual;
    p.totalBet += actual;
    const isRaise = h.currentBet > 0 || h.street === 'preflop';
    const increased = p.currentBet > h.currentBet;
    const wentAllin = p.stack === 0;
    const prevBet = h.currentBet;
    const prevLastRaise = h.lastRaiseAmount || h.bigBlind || h.bombAmount || 10;
    const isShortRaise = wentAllin && increased && (p.currentBet - prevBet) < prevLastRaise;
    let level = h.raiseLevel;
    if (increased) {
      h.raiseLevel = isRaise ? (h.raiseLevel || 1) + 1 : 1;
      if (h.raiseLevel >= 3) h.threeBetOccurred = true;
      level = h.raiseLevel;
      h.lastRaiseAmount = p.currentBet - prevBet;
      h.currentBet = p.currentBet;
      if (!isShortRaise) {
        h.shortAllinOpen = false;
        h.players.forEach((o) => {
          if (o.id !== p.id && o.status === 'active') o.hasActed = false;
        });
        if (h.ootActions) h.ootActions = h.ootActions.filter((o) => o.playerId === p.id);
      } else {
        h.shortAllinOpen = true;
        h.players.forEach((o) => {
          if (o.id !== p.id && o.status === 'active' && o.currentBet < h.currentBet) {
            o.hasActed = false;
          }
        });
      }
    }
    if (wentAllin) {
      p.lastAction = { type: 'allin', amount: p.currentBet, raiseLevel: level, didIncrease: increased };
      p.status = 'allin';
    } else {
      const actionType = isRaise ? 'raise' : 'bet';
      p.lastAction = { type: actionType, amount: p.currentBet, raiseLevel: level, didIncrease: increased };
    }
    p.hasActed = true;
  } else if (type === 'allin') {
    const pay = p.stack;
    const prevBet = h.currentBet;
    const prevLastRaise = h.lastRaiseAmount || h.bigBlind || h.bombAmount || 10;
    p.stack = 0;
    p.currentBet += pay;
    p.totalBet += pay;
    const newBet = p.currentBet;
    const increased = newBet > prevBet;
    const isShortRaise = increased && (newBet - prevBet) < prevLastRaise;
    const isCoveredCall = newBet <= prevBet;
    let level = h.raiseLevel;
    if (increased && !isCoveredCall) {
      h.raiseLevel = (prevBet > 0 || h.street === 'preflop') ? (h.raiseLevel || 1) + 1 : 1;
      if (h.raiseLevel >= 3) h.threeBetOccurred = true;
      level = h.raiseLevel;
      h.lastRaiseAmount = newBet - prevBet;
      h.currentBet = newBet;
      if (!isShortRaise) {
        h.shortAllinOpen = false;
        h.players.forEach((o) => {
          if (o.id !== p.id && o.status === 'active') o.hasActed = false;
        });
        if (h.ootActions) h.ootActions = h.ootActions.filter((o) => o.playerId === p.id);
      } else {
        h.shortAllinOpen = true;
        h.players.forEach((o) => {
          if (o.id !== p.id && o.status === 'active' && o.currentBet < h.currentBet) {
            o.hasActed = false;
          }
        });
      }
    }
    p.lastAction = { type: 'allin', amount: newBet, raiseLevel: level, didIncrease: increased && !isCoveredCall };
    p.hasActed = true;
    p.status = 'allin';
  } else if (type === 'straddle') {
    const newLevel = (h.straddleLevel || 0) + 1;
    const highestBlind = Math.max(
      h.bigBlind || 0,
      Number(h.thirdBlind) || 0,
      Number(h.fourthBlind) || 0
    );
    const baseTarget = Number(h.straddleAmount) || (highestBlind * 2);
    let target = amount != null && amount > 0
      ? Number(amount)
      : (baseTarget * Math.pow(2, newLevel - 1));
    const pay = Math.min(target - p.currentBet, p.stack);
    p.stack -= pay;
    p.currentBet += pay;
    p.totalBet += pay;
    h.straddleLevel = newLevel;
    h.raiseLevel = 1;
    h.lastRaiseAmount = Math.max(p.currentBet - h.currentBet, h.bigBlind);
    const didIncrease = p.currentBet > h.currentBet;
    h.currentBet = p.currentBet;
    if (p.stack === 0) {
      p.status = 'allin';
      p.lastAction = { type: 'allin', amount: p.currentBet, raiseLevel: 1, didIncrease };
    } else {
      p.lastAction = { type: 'straddle', amount: p.currentBet, raiseLevel: 1, didIncrease };
    }
    h.players.forEach((o) => {
      if (o.id !== p.id && o.status === 'active') o.hasActed = false;
    });
  }

  const potAfter = potTotal(h);
  const chips = p.lastAction && (p.lastAction.type === 'fold' || p.lastAction.type === 'check')
    ? 0
    : (p.lastAction && (p.lastAction.callAmount != null ? p.lastAction.callAmount : p.lastAction.amount)) || 0;
  const isAggressive = Boolean(
    p.lastAction && (
      p.lastAction.didIncrease ||
      p.lastAction.type === 'kill'
    )
  );

  h.actionHistory.push({
    street: h.street,
    player: p.name,
    action: actionLabel(p.lastAction),
    chips,
    betTo: p.currentBet || 0,
    raiseLevel: p.lastAction?.raiseLevel ?? h.raiseLevel ?? 0,
    isAggressive,
    pot: potAfter,
  });

  if (h._pendingCappedAction) {
    h._pendingCappedAction = false;
    const entry = h.actionHistory[h.actionHistory.length - 1];
    if (entry && entry.player === p.name && entry.street === h.street) {
      entry.action = actionLabel(p.lastAction);
      entry.chips = p.currentBet;
      entry.pot = potTotal(h);
    }
  }

  if (h.variant === 'crazy_pineapple' && h.street === 'preflop' && p.status === 'allin') {
    h.cpNeedsDiscard = true;
  }

  const nonFolded = h.players.filter((pl) => pl.status !== 'folded');
  if (nonFolded.length <= 1) {
    h.phase = 'ended';
    h.currentPlayer = -1;
    return h;
  }

  const nextPlayer = nextToAct(h.players, playerId, h.killIdx, h.killDeferred, h.shortAllinOpen);
  if (streetComplete(h) || nextPlayer === -1 || bettingFrozen(h)) {
    h.currentPlayer = -1;
    const isLastStreet = h.street === 'ocean' || (h.street === 'river' && h.variant !== 'ocean');
    if (isLastStreet) {
      if (h.variant === 'red_river') {
        const cards = (h.communityCards || []).filter((c) => c && !c.hidden);
        const lastCard = cards[cards.length - 1];
        const isRed = lastCard && (lastCard.suit === 'h' || lastCard.suit === 'd' || lastCard.suit === '♥' || lastCard.suit === '♦');
        if (isRed) {
          h.phase = 'playing';
          if (!h.communityCards.some((c) => c.hidden)) {
            h.communityCards.push({ hidden: true });
          }
          h.players.forEach((p) => { if (p.status === 'active') { p.currentBet = 0; p.hasActed = false; } });
          h.currentBet = 0;
          h.lastRaiseAmount = h.bigBlind || h.bombAmount || 10;
          h.raiseLevel = 0;
          h.currentPlayer = bettingFrozen(h) ? -1 : firstActiveAfter(h.players, getPostflopButtonAnchor(h));
          h.message = 'Red river! Extra river card added – another round of betting.';
        } else {
          h.phase = 'ended';
        }
      } else {
        h.phase = 'ended';
      }
    } else {
      const nextMap = { preflop: 'flop', flop: 'turn', turn: 'river', ...(h.variant === 'ocean' ? { river: 'ocean' } : {}) };
      const next = nextMap[h.street];
      const frozen = bettingFrozen(h);
      if (!frozen) {
        const lowGame = variantMeta(h.variant).group === 'low';
        if (!lowGame) {
          const expected = next === 'flop' ? 3 : (next === 'turn' && h.variant === 'three_two_one') ? 2 : 1;
          for (let i = 0; i < expected; i++) h.communityCards.push({ hidden: true });
          if (h.doubleBoard) for (let i = 0; i < expected; i++) h.boardB.push({ hidden: true });
        }
        h.players.forEach((pl) => {
          pl.currentBet = 0;
          pl._oversizedCap = undefined;
          const isCapped = pl._wasCapped || pl._allInCapped;
          if (pl.status === 'active' && !isCapped) {
            pl.hasActed = false;
            pl.lastAction = null;
            pl._wasCapped = false;
            pl._allInCapped = false;
          }
        });
        h.currentBet = 0;
        h.lastRaiseAmount = h.bigBlind || h.bombAmount || 10;
        h.raiseLevel = 0;
        h.straddleOpen = false;
        h.killDeferred = false;
        h.shortAllinOpen = false;
        h.ootActions = [];
        h.passiveBound = {};
        h.street = next;
        h.message = `Dealt the ${next.toUpperCase()}`;
        h.currentPlayer = firstActiveAfter(h.players, getPostflopButtonAnchor(h));
      } else {
        h.shortAllinOpen = false;
        h.message = `Betting complete – deal the ${next.toUpperCase()}`;
      }
    }
  } else {
    h.currentPlayer = nextPlayer;
    h.message = null;
  }
  if (h.killDeferred && h.killIdx >= 0 && h.killIdx === playerId) h.killDeferred = false;
  return h;
}

export function recordOutOfTurn(hand, playerId, kind, amount) {
  const h = clone(hand);
  if (!h.ootActions) h.ootActions = [];
  h.ootActions = h.ootActions.filter((o) => o.playerId !== playerId);
  const parsedAmount = parseAmount(amount);
  const entry = {
    playerId,
    street: h.street,
    kind,
    amount: parsedAmount != null ? parsedAmount : null,
    raiseLevel: null,
  };
  if (kind === 'aggressive' && parsedAmount != null && parsedAmount > 0) {
    const p = h.players.find((pl) => pl.id === playerId);
    const targetBet = parsedAmount;
    if (p) {
      const tiers = new Set(
        h.players
          .filter((pl) => pl.status !== 'folded' && pl.currentBet > 0)
          .map((pl) => (pl.id === playerId ? targetBet : pl.currentBet))
      );
      tiers.add(targetBet);
      const sorted = [...tiers].sort((a, b) => a - b);
      entry.raiseLevel = sorted.length;
    }
  }
  h.ootActions.push(entry);
  if (kind === 'passive') {
    if (!h.passiveBound) h.passiveBound = {};
    h.passiveBound[playerId] = h.street;
  }
  return h;
}

export function dealNextStreet(hand, cards = [], hidden = false) {
  const nextMap = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
    ...(hand.variant === 'ocean' ? { river: 'ocean' } : {})
  };
  let next = nextMap[hand.street];
  if (!next && hand.variant === 'red_river') {
    const realCards = (hand.communityCards || []).filter((c) => c && !c.hidden);
    const lastCard = realCards[realCards.length - 1];
    const isRed = lastCard && (lastCard.suit === 'd' || lastCard.suit === 'h' || lastCard.suit === '♦' || lastCard.suit === '♥');
    if (isRed) next = 'river';
  }
  if (!next) return { error: 'No more streets to deal.' };
  const expected = next === 'flop' ? 3 : (next === 'turn' && hand.variant === 'three_two_one') ? 2 : 1;
  const boardCount = Number(hand.bombBoards) || (hand.runTimes >= 3 ? 3 : hand.doubleBoard ? 2 : 1);
  const isTriple = boardCount >= 3;
  const isDouble = boardCount >= 2;
  const totalExpected = expected * boardCount;
  const h = clone(hand);
  if (!Array.isArray(h.boardB)) h.boardB = [];
  if (!Array.isArray(h.boardC)) h.boardC = [];
  if (hidden) {
    for (let i = 0; i < expected; i++) h.communityCards.push({ hidden: true });
    if (isDouble) for (let i = 0; i < expected; i++) h.boardB.push({ hidden: true });
    if (isTriple) for (let i = 0; i < expected; i++) h.boardC.push({ hidden: true });
  } else {
    if (cards.length !== totalExpected) {
      return { error: `Deal exactly ${totalExpected} card(s) for the ${next.toUpperCase()}.` };
    }
    h.communityCards.push(...cards.slice(0, expected));
    if (isDouble) h.boardB.push(...cards.slice(expected, expected * 2));
    if (isTriple) h.boardC.push(...cards.slice(expected * 2, expected * 3));
  }
  const isFrozen = bettingFrozen(h);
  h.players.forEach((p) => {
    p.currentBet = 0;
    p._oversizedCap = undefined;
    if (p.stack === 0 && p.status !== 'folded') {
      p.status = 'allin';
    }
    const isCapped = p._wasCapped || p._allInCapped;
    if (p.status === 'active') {
      if (!isFrozen && !isCapped) {
        p.hasActed = false;
        p.lastAction = null;
        p._wasCapped = false;
        p._allInCapped = false;
      }
    }
  });
  h.currentBet = 0;
  h.lastRaiseAmount = h.bigBlind || h.bombAmount || 10;
  h.raiseLevel = 0;
  h.straddleOpen = false;
  h.killDeferred = false;
  h.shortAllinOpen = false;
  h.ootActions = [];
  h.passiveBound = {};
  h.street = next;
  h.message = null;
  h.currentPlayer = firstActiveAfter(h.players, getPostflopButtonAnchor(h));
  if (bettingFrozen(h)) {
    h.currentPlayer = -1;
    const isLastStreet = h.street === 'ocean' || (h.street === 'river' && h.variant !== 'ocean');
    if (isLastStreet) {
      const realCards = (h.communityCards || []).filter((c) => c && !c.hidden);
      const lastCard = realCards[realCards.length - 1];
      const isRed = h.variant === 'red_river' && realCards.length >= 5 && lastCard && (lastCard.suit === 'd' || lastCard.suit === 'h' || lastCard.suit === '♦' || lastCard.suit === '♥');
      if (isRed) {
        h.phase = 'playing';
        h.message = 'Red River card is RED! Deal next river card.';
      } else {
        h.phase = 'ended';
        h.message = 'Hand complete – award the pots to finish.';
      }
    } else {
      const nextStreet = { flop: 'turn', turn: 'river', river: 'ocean' }[h.street];
      if (nextStreet) {
        h.message = `Betting complete – deal the ${nextStreet.toUpperCase()}`;
      } else {
        h.message = 'Betting complete.';
      }
    }
  }
  return { hand: h };
}

export function fillBoard(hand, cards) {
  const isTriple = (Number(hand.bombBoards) >= 3) || (hand.boardC && hand.boardC.length > 0) || (hand.runTimes >= 3);
  const hiddenA = (hand.communityCards || []).filter((c) => c.hidden).length;
  const hiddenB = hand.doubleBoard ? (hand.boardB || []).filter((c) => c.hidden).length : 0;
  const hiddenC = isTriple ? (hand.boardC || []).filter((c) => c.hidden).length : 0;
  const total = hiddenA + hiddenB + hiddenC;
  if (total === 0) return { error: 'No hidden board cards to enter.' };

  // If cards.length === hiddenA and running multiple times on flop/turn of a single board:
  // This is the common flop (or flop+turn) being revealed across all boards!
  if (hand.runTimes && hand.runTimes >= 2 && !hand.doubleBoard && !hand.bombBoards && cards.length === hiddenA) {
    const h = clone(hand);
    let ci = 0;
    h.communityCards = (h.communityCards || []).map((c) => (c.hidden ? cards[ci++] : c));
    h.boardB = h.communityCards.map((c) => ({ ...c }));
    if (isTriple) h.boardC = h.communityCards.map((c) => ({ ...c }));
    return { hand: h };
  }

  if (cards.length !== total) return { error: `Enter ${total} card(s) for the board.` };
  const h = clone(hand);
  let ci = 0;
  h.communityCards = (h.communityCards || []).map((c) => (c.hidden ? cards[ci++] : c));
  if (h.doubleBoard) h.boardB = (h.boardB || []).map((c) => (c.hidden ? cards[ci++] : c));
  if (isTriple) h.boardC = (h.boardC || []).map((c) => (c.hidden ? cards[ci++] : c));
  return { hand: h };
}

export function postBlinds(hand) {
  if (!hand || hand.blindsPosted) return hand;
  const h = clone(hand);
  const n = h.players.length;
  if (h.bombPot || isBombPotVariant(h.variant)) {
    const bombAmt = Number(h.bombAmount) || Number(h.anteAmount) || Number(h.bigBlind) || 10;
    const bCount = h.variant === 'double_board_bomb_pot' ? 2 : (Number(h.bombBoards) || (h.doubleBoard ? 2 : 1));
    h.players.forEach((p) => {
      const a = Math.min(bombAmt, p.stack);
      p.stack -= a;
      p.totalBet += a;
      p.antePaid = (p.antePaid || 0) + a;
      p.currentBet = 0;
      p.lastAction = { type: 'ante', amount: a };
      if (p.stack === 0) p.status = 'allin';
    });
    const anchor = getPostflopButtonAnchor(h);
    h.pots = [{ amount: h.players.reduce((s, p) => s + p.totalBet, 0), eligible: h.players.map((p) => p.id) }];
    h.street = 'flop';
    h.currentBet = 0;
    h.lastRaiseAmount = h.bigBlind || bombAmt || 10;
    h.raiseLevel = 0;
    h.communityCards = [{ hidden: true }, { hidden: true }, { hidden: true }];
    h.boardB = bCount >= 2 ? [{ hidden: true }, { hidden: true }, { hidden: true }] : [];
    h.boardC = bCount >= 3 ? [{ hidden: true }, { hidden: true }, { hidden: true }] : [];
    h.doubleBoard = bCount >= 2;
    h.bombBoards = bCount;
    h.bombPot = true;
    h.bombAmount = bombAmt;
    h.currentPlayer = bettingFrozen({ players: h.players, currentBet: 0 }) ? -1 : firstActiveAfter(h.players, anchor);
    h.allowStraddle = false;
    h.allowMultiStraddle = false;
    h.mandatoryStraddle = false;
    h.mandatoryDoubleStraddle = false;
    h.maxStraddles = 0;
    h.straddleLevel = 0;
    h.straddleOpen = false;
    h.blindsPosted = true;
    h.message = `${bCount >= 2 ? 'Double board bomb pot' : 'Bomb pot'} – flop is out, no preflop action`;
    return h;
  }
  const buttonIndex = h.players.findIndex((p) => p.seat === h.buttonSeat);
  if (buttonIndex === -1) return h;
  const isThreeBlinds = h.anteType === 'three_blinds' && n >= 3;
  const isFourBlinds = h.anteType === 'four_blinds' && n >= 4;
  const sbIndex = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
  const tbIndex = (isThreeBlinds || isFourBlinds) ? (buttonIndex + 3) % n : -1;
  const fbIndex = isFourBlinds ? (buttonIndex + 4) % n : -1;

  const activeCount = h.players.filter((p) => p.status !== 'eliminated' && p.status !== 'out').length;
  const isShortHandedSB = h.sbHalfAnteShortHanded && activeCount < (Number(h.shortHandedThreshold) || 5);
  let effectiveAnteType = h.anteType;
  if (h.anteType === 'bba' && isShortHandedSB) {
    effectiveAnteType = 'sb_half_ante';
  }
  h.effectiveAnteType = effectiveAnteType;

  const bba = effectiveAnteType === 'bba';
  const isBtnAnte = effectiveAnteType === 'btn_ante';
  const isSBHalfAnte = effectiveAnteType === 'sb_half_ante';
  const curLevelNum = (h.blindLevel || 0) + 1;
  const isBBAEarlyHalf = bba && h.bbaEarlyHalfAnte && curLevelNum <= (Number(h.bbaEarlyHalfAnteLevel) || 2);
  const ante = (bba || isBtnAnte)
    ? (isBBAEarlyHalf ? Math.round((Number(h.bigBlind) || 0) * 0.5 * 100) / 100 : h.bigBlind)
    : isSBHalfAnte
    ? Math.round((Number(h.bigBlind) || 0) * 0.5 * 100) / 100
    : (h.anteAmount || 0);

  if (effectiveAnteType === 'traditional' && ante > 0) {
    h.players.forEach((p) => {
      const a = Math.min(ante, p.stack);
      p.stack -= a;
      p.totalBet += a;
      p.antePaid = (p.antePaid || 0) + a;
    });
  }

  const sb = Math.min(h.smallBlind, h.players[sbIndex].stack);
  h.players[sbIndex].stack -= sb;
  h.players[sbIndex].currentBet = sb;
  h.players[sbIndex].totalBet += sb;
  h.players[sbIndex].lastAction = { type: 'sb', amount: sb };

  const bb = Math.min(h.bigBlind, h.players[bbIndex].stack);
  h.players[bbIndex].stack -= bb;
  h.players[bbIndex].currentBet = bb;
  h.players[bbIndex].totalBet += bb;
  h.players[bbIndex].lastAction = { type: 'bb', amount: bb };

  if (isFourBlinds && tbIndex >= 0 && fbIndex >= 0) {
    const tbTarget = Number(h.thirdBlind) || (h.bigBlind * 2);
    const tb = Math.min(tbTarget, h.players[tbIndex].stack);
    h.players[tbIndex].stack -= tb;
    h.players[tbIndex].currentBet = tb;
    h.players[tbIndex].totalBet += tb;
    h.players[tbIndex].lastAction = { type: '3b', amount: tb };

    const fbTarget = Number(h.fourthBlind) || (h.bigBlind * 4);
    const fb = Math.min(fbTarget, h.players[fbIndex].stack);
    h.players[fbIndex].stack -= fb;
    h.players[fbIndex].currentBet = fb;
    h.players[fbIndex].totalBet += fb;
    h.players[fbIndex].lastAction = { type: '4b', amount: fb };
  } else if (isThreeBlinds && tbIndex >= 0) {
    const tbTarget = Number(h.thirdBlind) || (h.bigBlind * 2);
    const tb = Math.min(tbTarget, h.players[tbIndex].stack);
    h.players[tbIndex].stack -= tb;
    h.players[tbIndex].currentBet = tb;
    h.players[tbIndex].totalBet += tb;
    h.players[tbIndex].lastAction = { type: '3b', amount: tb };
  }

  if (bba && ante > 0) {
    const a = Math.min(ante, h.players[bbIndex].stack);
    h.players[bbIndex].stack -= a;
    h.players[bbIndex].totalBet += a;
    h.players[bbIndex].antePaid = (h.players[bbIndex].antePaid || 0) + a;
  }
  if (isBtnAnte && ante > 0) {
    const a = Math.min(ante, h.players[buttonIndex].stack);
    h.players[buttonIndex].stack -= a;
    h.players[buttonIndex].totalBet += a;
    h.players[buttonIndex].antePaid = (h.players[buttonIndex].antePaid || 0) + a;
  }
  if (isSBHalfAnte && ante > 0) {
    const a = Math.min(ante, h.players[bbIndex].stack);
    h.players[bbIndex].stack -= a;
    h.players[bbIndex].totalBet += a;
    h.players[bbIndex].antePaid = (h.players[bbIndex].antePaid || 0) + a;
  }

  h.players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });

  if (isFourBlinds && fbIndex >= 0) {
    const fbVal = h.players[fbIndex].currentBet || (Number(h.fourthBlind) || (h.bigBlind * 4));
    h.currentBet = fbVal;
    h.lastRaiseAmount = fbVal;
    h.raiseLevel = 1;
    h.currentPlayer = firstActiveAfter(h.players, fbIndex);
  } else if (isThreeBlinds && tbIndex >= 0) {
    const tbVal = h.players[tbIndex].currentBet || (Number(h.thirdBlind) || (h.bigBlind * 2));
    h.currentBet = tbVal;
    h.lastRaiseAmount = tbVal;
    h.raiseLevel = 1;
    h.currentPlayer = firstActiveAfter(h.players, tbIndex);
  } else {
    h.currentBet = h.players.reduce((m, p) => Math.max(m, p.currentBet || 0), 0) || bb;
    h.lastRaiseAmount = h.bigBlind;
    h.raiseLevel = 1;
    h.currentPlayer = firstActiveAfter(h.players, bbIndex);
  }

  if (bettingFrozen({ players: h.players, currentBet: h.currentBet })) {
    h.currentPlayer = -1;
    h.straddleOpen = false;
  }

  h.blindsPosted = true;
  h.message = null;
  return h;
}

export function endHand(hand) {
  const h = clone(hand);
  h.phase = 'ended';
  h.currentPlayer = -1;
  return h;
}

export function recomputeBlindsForLevel(hand, newSmallBlind, newBigBlind, newAnte) {
  const h = clone(hand);
  if (h.actionHistory && h.actionHistory.length > 0) return h;
  if (isBombPotVariant(h.variant)) {
    if (h.street !== 'preflop' && h.street !== 'flop') return h;
    const anteVal = Number(newAnte) || Number(newBigBlind) || Number(h.anteAmount) || Number(h.bombAmount) || 10;
    h.players.forEach((p) => {
      p.stack = p.initialStack;
      p.currentBet = 0;
      p.totalBet = 0;
      p.antePaid = 0;
      p.lastAction = null;
      p.hasActed = false;
      p.status = 'active';
      p._wasCapped = false;
    });
    if (h.blindsPosted !== false) {
      h.players.forEach((p) => {
        const a = Math.min(anteVal, p.stack);
        p.stack -= a;
        p.totalBet += a;
        p.antePaid = a;
        p.lastAction = { type: 'ante', amount: a };
        if (p.stack === 0) p.status = 'allin';
      });
      h.pots = [{ amount: h.players.reduce((s, p) => s + p.totalBet, 0), eligible: h.players.map((p) => p.id) }];
    }
    h.smallBlind = 0;
    h.bigBlind = 0;
    h.anteAmount = anteVal;
    h.bombAmount = anteVal;
    h.currentBet = 0;
    h.lastRaiseAmount = anteVal;
    h.raiseLevel = 0;
    const anchor = getPostflopButtonAnchor(h);
    h.currentPlayer = (h.blindsPosted === false || bettingFrozen({ players: h.players, currentBet: 0 }))
      ? -1
      : firstActiveAfter(h.players, anchor);
    return h;
  }
  if (h.street !== 'preflop') return h;
  if (h.bombPot) return h;
  const sb = newSmallBlind;
  const bb = newBigBlind;
  const n = h.players.length;
  const buttonIndex = h.players.findIndex((p) => p.seat === h.buttonSeat);
  const isThreeBlinds = h.anteType === 'three_blinds' && n >= 3;
  const isFourBlinds = h.anteType === 'four_blinds' && n >= 4;
  const sbIndex = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
  const tbIndex = (isThreeBlinds || isFourBlinds) ? (buttonIndex + 3) % n : -1;
  const fbIndex = isFourBlinds ? (buttonIndex + 4) % n : -1;

  const activeCount = h.players.filter((p) => p.status !== 'eliminated' && p.status !== 'out').length;
  const isShortHandedSB = h.sbHalfAnteShortHanded && activeCount < (Number(h.shortHandedThreshold) || 5);
  let effectiveAnteType = h.anteType;
  if (h.anteType === 'bba' && isShortHandedSB) {
    effectiveAnteType = 'sb_half_ante';
  }
  h.effectiveAnteType = effectiveAnteType;

  const bba = effectiveAnteType === 'bba';
  const isBtnAnte = effectiveAnteType === 'btn_ante';
  const isSBHalfAnte = effectiveAnteType === 'sb_half_ante';
  const curLevelNum = (h.blindLevel || 0) + 1;
  const isBBAEarlyHalf = bba && h.bbaEarlyHalfAnte && curLevelNum <= (Number(h.bbaEarlyHalfAnteLevel) || 2);
  const ante = (bba || isBtnAnte)
    ? (isBBAEarlyHalf ? Math.round((Number(bb) || 0) * 0.5 * 100) / 100 : bb)
    : isSBHalfAnte
    ? Math.round((Number(bb) || 0) * 0.5 * 100) / 100
    : (newAnte || 0);

  h.players.forEach((p) => {
    p.stack = p.initialStack;
    p.currentBet = 0;
    p.totalBet = 0;
    p.antePaid = 0;
    p.lastAction = null;
    p.hasActed = false;
    p.status = 'active';
    p._wasCapped = false;
  });

  if (effectiveAnteType === 'traditional' && ante > 0) {
    h.players.forEach((p) => {
      const a = Math.min(ante, p.stack);
      p.stack -= a;
      p.totalBet += a;
      p.antePaid = (p.antePaid || 0) + a;
    });
  }

  const sbPay = Math.min(sb, h.players[sbIndex].stack);
  h.players[sbIndex].stack -= sbPay;
  h.players[sbIndex].currentBet = sbPay;
  h.players[sbIndex].totalBet += sbPay;
  h.players[sbIndex].lastAction = { type: 'sb', amount: sbPay };

  const bbPay = Math.min(bb, h.players[bbIndex].stack);
  h.players[bbIndex].stack -= bbPay;
  h.players[bbIndex].currentBet = bbPay;
  h.players[bbIndex].totalBet += bbPay;
  h.players[bbIndex].lastAction = { type: 'bb', amount: bbPay };

  if (isFourBlinds && tbIndex >= 0 && fbIndex >= 0) {
    const tbTarget = Number(h.thirdBlind) || (bb * 2);
    const tbPay = Math.min(tbTarget, h.players[tbIndex].stack);
    h.players[tbIndex].stack -= tbPay;
    h.players[tbIndex].currentBet = tbPay;
    h.players[tbIndex].totalBet += tbPay;
    h.players[tbIndex].lastAction = { type: '3b', amount: tbPay };

    const fbTarget = Number(h.fourthBlind) || (bb * 4);
    const fbPay = Math.min(fbTarget, h.players[fbIndex].stack);
    h.players[fbIndex].stack -= fbPay;
    h.players[fbIndex].currentBet = fbPay;
    h.players[fbIndex].totalBet += fbPay;
    h.players[fbIndex].lastAction = { type: '4b', amount: fbPay };
  } else if (isThreeBlinds && tbIndex >= 0) {
    const tbTarget = Number(h.thirdBlind) || (bb * 2);
    const tbPay = Math.min(tbTarget, h.players[tbIndex].stack);
    h.players[tbIndex].stack -= tbPay;
    h.players[tbIndex].currentBet = tbPay;
    h.players[tbIndex].totalBet += tbPay;
    h.players[tbIndex].lastAction = { type: '3b', amount: tbPay };
  }

  if (bba && ante > 0) {
    const a = Math.min(ante, h.players[bbIndex].stack);
    h.players[bbIndex].stack -= a;
    h.players[bbIndex].totalBet += a;
    h.players[bbIndex].antePaid = (h.players[bbIndex].antePaid || 0) + a;
  }
  if (isBtnAnte && ante > 0) {
    const a = Math.min(ante, h.players[buttonIndex].stack);
    h.players[buttonIndex].stack -= a;
    h.players[buttonIndex].totalBet += a;
    h.players[buttonIndex].antePaid = (h.players[buttonIndex].antePaid || 0) + a;
  }
  if (isSBHalfAnte && ante > 0) {
    const a = Math.min(ante, h.players[bbIndex].stack);
    h.players[bbIndex].stack -= a;
    h.players[bbIndex].totalBet += a;
    h.players[bbIndex].antePaid = (h.players[bbIndex].antePaid || 0) + a;
  }

  h.players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });
  h.smallBlind = sb;
  h.bigBlind = bb;
  h.anteAmount = ante;

  if (isFourBlinds && fbIndex >= 0) {
    const fbActual = h.players[fbIndex].currentBet || (Number(h.fourthBlind) || (bb * 4));
    h.currentBet = fbActual;
    h.lastRaiseAmount = fbActual;
    h.raiseLevel = 1;
    h.currentPlayer = firstActiveAfter(h.players, fbIndex);
  } else if (isThreeBlinds && tbIndex >= 0) {
    const tbActual = h.players[tbIndex].currentBet || (Number(h.thirdBlind) || (bb * 2));
    h.currentBet = tbActual;
    h.lastRaiseAmount = tbActual;
    h.raiseLevel = 1;
    h.currentPlayer = firstActiveAfter(h.players, tbIndex);
  } else {
    const bbActual = h.players[bbIndex].currentBet || bb;
    h.currentBet = h.players.reduce((m, p) => Math.max(m, p.currentBet || 0), 0) || bbActual;
    h.lastRaiseAmount = bb;
    h.raiseLevel = 1;
    h.currentPlayer = firstActiveAfter(h.players, bbIndex);
  }
  if (bettingFrozen({ players: h.players, currentBet: h.currentBet })) {
    h.currentPlayer = -1;
    h.straddleOpen = false;
  }
  return h;
}

export function bbaPotOpts(hand) {
  if (!hand) return {};
  const n = hand.players.length;
  const buttonIndex = hand.players.findIndex((p) => p.seat === hand.buttonSeat);
  if (buttonIndex === -1) return {};

  const activeCount = (hand.players || []).filter((p) => p.status !== 'eliminated' && p.status !== 'out').length;
  const isShortHandedSB = hand.sbHalfAnteShortHanded && activeCount < (Number(hand.shortHandedThreshold) || 5);
  const effectiveAnte = hand.anteType === 'bba' && isShortHandedSB ? 'sb_half_ante' : hand.anteType;

  if (effectiveAnte === 'bba') {
    const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
    const curLevelNum = (hand.blindLevel || 0) + 1;
    const isBBAEarlyHalf = hand.bbaEarlyHalfAnte && curLevelNum <= (Number(hand.bbaEarlyHalfAnteLevel) || 2);
    const bbaAmount = isBBAEarlyHalf
      ? Math.round((Number(hand.bigBlind) || 0) * 0.5 * 100) / 100
      : (Number(hand.bigBlind) || 0);
    return { bbaAmount, bbIndex, bigBlind: Number(hand.bigBlind) || 0 };
  }
  if (effectiveAnte === 'btn_ante') {
    return { bbaAmount: Number(hand.bigBlind) || 0, bbIndex: buttonIndex, bigBlind: Number(hand.bigBlind) || 0 };
  }
  if (effectiveAnte === 'sb_half_ante') {
    const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
    return { bbaAmount: Math.round((Number(hand.bigBlind) || 0) * 0.5 * 100) / 100, bbIndex, bigBlind: Number(hand.bigBlind) || 0 };
  }
  return {};
}

function getDeadAnte(p, idx, opts = {}) {
  const contrib = Math.max(0, (p.initialStack ?? p.stack ?? 0) - (p.stack ?? 0));
  if (p.antePaid != null) return Math.min(contrib, Math.max(0, Number(p.antePaid) || 0));
  if (opts?.bbaAmount > 0 && idx === opts.bbIndex) {
    const bbCap = Number(opts.bigBlind) || 0;
    return Math.min(opts.bbaAmount, Math.max(0, contrib - bbCap));
  }
  return 0;
}

export function computePots(players, opts = {}) {
  // Dead antes (BBA, BTN ante, traditional antes) are dead money in the pot
  // and can be won by any non-folded contender regardless of whether they cover
  // the ante. Side-pot layers are derived solely from live (non-ante) bets.
  const contribs = players.map((p, idx) => {
    const contrib = Math.max(0, (p.initialStack ?? p.stack ?? 0) - (p.stack ?? 0));
    const deadAnte = Math.min(contrib, getDeadAnte(p, idx, opts));
    const liveContrib = Math.max(0, contrib - deadAnte);
    return { id: p.id, name: p.name, contrib, deadAnte, liveContrib, status: p.status };
  });
  const totalPot = Math.round(contribs.reduce((s, c) => s + c.contrib, 0) * 100) / 100;
  const totalDeadAnte = Math.round(contribs.reduce((s, c) => s + c.deadAnte, 0) * 100) / 100;
  const hasAllIn = contribs.some((c) => c.status === 'allin' && c.contrib > 0);
  const allNonFoldedWithContrib = contribs.filter((c) => c.contrib > 0 && c.status !== 'folded').map((c) => c.id);
  const liveLevels = [...new Set(contribs.filter((c) => c.liveContrib > 0).map((c) => c.liveContrib))].sort((a, b) => a - b);

  if (!hasAllIn || liveLevels.length === 0) {
    return [{ amount: totalPot, eligible: allNonFoldedWithContrib }];
  }

  const pots = [];
  let prev = 0;
  for (const level of liveLevels) {
    const amount = level - prev;
    const contributors = contribs.filter((c) => c.liveContrib >= level);
    const potAmount = Math.round(amount * contributors.length * 100) / 100;
    const eligible = contribs
      .filter((c) => c.liveContrib >= level && c.status !== 'folded')
      .map((c) => c.id);
    pots.push({ amount: potAmount, eligible });
    prev = level;
  }

  if (totalDeadAnte > 0) {
    if (pots.length > 0 && JSON.stringify(pots[0].eligible) === JSON.stringify(allNonFoldedWithContrib)) {
      pots[0].amount = Math.round((pots[0].amount + totalDeadAnte) * 100) / 100;
    } else {
      pots.unshift({ amount: totalDeadAnte, eligible: allNonFoldedWithContrib });
    }
  }

  const merged = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && JSON.stringify(last.eligible) === JSON.stringify(pot.eligible)) {
      last.amount = Math.round((last.amount + pot.amount) * 100) / 100;
    } else {
      merged.push({ ...pot });
    }
  }
  return merged;
}

// Returns the part of a live bet no other player could match (an all-in shove
// covered by a shorter stack, or an active player's blind/bet against a short
// all-in) to the player who made it. Dead antes stay in the pot for everyone.
export function refundUncontestedPots(hand) {
  const h = clone(hand);
  if (h._refundsApplied) return h;
  const opts = bbaPotOpts(h);
  const entries = h.players.map((p, idx) => {
    const contrib = Math.max(0, (p.initialStack ?? p.stack ?? 0) - (p.stack ?? 0));
    const deadAnte = Math.min(contrib, getDeadAnte(p, idx, opts));
    const live = Math.max(0, contrib - deadAnte);
    return { p, live };
  });
  entries.sort((a, b) => b.live - a.live);
  const top = entries[0];
  const second = entries[1];
  const uncalled = top ? Math.max(0, top.live - (second ? second.live : 0)) : 0;
  const nonFolded = h.players.filter((p) => p.status !== 'folded');
  const isAllInPot = nonFolded.length >= 2 && nonFolded.some((p) => p.status === 'allin');
  // Only refund when the top bettor is all-in (e.g. shoved over a shorter stack
  // who called or folded) OR in a multi-way/heads-up all-in showdown where a
  // covering player put in more live chips (including a big blind vs short SB).
  if (!top || uncalled <= 0 || top.p.status === 'folded' || (top.p.status !== 'allin' && !isAllInPot)) {
    h._refundsApplied = true;
    return h;
  }
  const excess = Math.round(uncalled * 100) / 100;
  const hadStreetBet = (top.p.currentBet || 0) > 0;
  top.p.stack = Math.round((top.p.stack + excess) * 100) / 100;
  top.p.totalBet = Math.max(0, Math.round(((top.p.totalBet || 0) - excess) * 100) / 100);
  if (hadStreetBet) {
    top.p.currentBet = Math.max(0, Math.round(((top.p.currentBet || 0) - excess) * 100) / 100);
    if (top.p.lastAction && typeof top.p.lastAction.amount === 'number') {
      top.p.lastAction = {
        ...top.p.lastAction,
        amount: Math.max(0, Math.round((top.p.lastAction.amount - excess) * 100) / 100),
      };
    }
    h.currentBet = Math.max(0, ...h.players.filter((pl) => pl.status !== 'folded').map((pl) => pl.currentBet || 0));
  }
  top.p.refunded = Math.round(((top.p.refunded || 0) + excess) * 100) / 100;
  h.refunds = [{ playerId: top.p.id, amount: excess }];
  h._refundsApplied = true;
  return h;
}

function chopOrder(winners, players, buttonSeat) {
  const buttonIdx = players.findIndex((p) => p.seat === buttonSeat);
  if (buttonIdx === -1) return winners.slice();
  function distFromButton(playerId) {
    const idx = players.findIndex((p) => p.id === playerId);
    if (idx === -1) return 999;
    const d = (idx - buttonIdx + players.length) % players.length;
    return d === 0 ? players.length : d;
  }
  return winners.slice().sort((a, b) => distFromButton(a) - distFromButton(b));
}

function effectiveSplitUnit(amount, unit) {
  const u = Number(unit) || 1;
  if (u > 1 && Math.abs(amount - Math.round(amount / u) * u) < 1e-6) {
    return u;
  }
  const cents = Math.round(amount * 100);
  return cents % 100 === 0 ? 1 : 0.01;
}

function chopSplit(amount, winners, players, buttonSeat, unit) {
  if (winners.length <= 1) {
    return [{ playerId: winners[0], amount }];
  }
  const u = effectiveSplitUnit(amount, unit);
  const totalUnits = Math.round(amount / u);
  const baseUnits = Math.floor(totalUnits / winners.length);
  const extraUnits = totalUnits - baseUnits * winners.length;
  const sorted = chopOrder(winners, players, buttonSeat);
  return sorted.map((wid, i) => ({
    playerId: wid,
    amount: Math.round((baseUnits + (i < extraUnits ? 1 : 0)) * u * 100) / 100,
  }));
}

export function resolveBountyHunter(h, victim) {
  if (!victim || !h.pots || !h.winners) return null;
  const victimInit = victim.initialStack != null ? victim.initialStack : victim.stack;

  // 1. Find the specific pot containing the victim's final chips
  let targetPotIndex = -1;
  for (let i = 0; i < h.pots.length; i++) {
    const pot = h.pots[i];
    if (pot.eligible && pot.eligible.includes(victim.id)) {
      targetPotIndex = i;
    }
  }
  if (targetPotIndex === -1) targetPotIndex = 0;

  // Helper to get unique players who won potIdx and covered victim at start of hand
  const getCoveringWinnersForPot = (potIdx) => {
    const potWinners = h.winners.filter((w) => w.potIndex === potIdx);
    const uniqueIds = [...new Set(potWinners.map((w) => w.playerId))];
    const players = uniqueIds.map((id) => h.players.find((p) => p.id === id)).filter(Boolean);
    return players.filter((p) => (p.initialStack != null ? p.initialStack : p.stack) >= victimInit);
  };

  // Check the specific pot containing the victim's final chips
  const coveringWinners = getCoveringWinnersForPot(targetPotIndex);

  // If a shorter stack wins the main pot and survives, the bounty goes to the player who wins the side pot among the remaining stacks
  if (coveringWinners.length === 0) {
    for (let sideIdx = targetPotIndex + 1; sideIdx < h.pots.length; sideIdx++) {
      const sideWinners = getCoveringWinnersForPot(sideIdx);
      if (sideWinners.length > 0) {
        return { winners: sideWinners, potIndex: sideIdx };
      }
    }
  } else {
    return { winners: coveringWinners, potIndex: targetPotIndex };
  }

  // Fallback: Check any winner across all pots that had victim covered
  const allCovering = h.winners
    .map((w) => h.players.find((p) => p.id === w.playerId))
    .filter((p) => p && (p.initialStack != null ? p.initialStack : p.stack) >= victimInit);
  const uniqueAll = [...new Set(allCovering)];
  if (uniqueAll.length > 0) {
    return { winners: uniqueAll, potIndex: targetPotIndex };
  }

  // Fallback to pot winners
  const fallbackWinners = [...new Set(h.winners.filter((w) => w.potIndex === targetPotIndex).map((w) => h.players.find((p) => p.id === w.playerId)).filter(Boolean))];
  return { winners: fallbackWinners, potIndex: targetPotIndex };
}

export function awardPots(hand, winnersMap, options = {}) {
  const h = clone(hand);
  const pots = computePots(h.players, bbaPotOpts(h));
  h.pots = pots;
  h.winners = [];
  const arrOf = (val) => Array.isArray(val) ? val : (val == null ? [] : [val]);
  const denoms = (h.chipDenominations || []).map(Number).filter((d) => d > 0);
  const unit = minChipInPlay(h) || (denoms.length ? Math.min(...denoms) : 1);

  pots.forEach((pot, i) => {
    const aArr = arrOf(winnersMap[i]);
    const bArr = options.winnersB ? arrOf(options.winnersB[i]) : null;
    const cArr = options.winnersC ? arrOf(options.winnersC[i]) : null;
    const lowArr = options.winnersLow ? arrOf(options.winnersLow[i]) : null;

    if (cArr && cArr.length && bArr && bArr.length) {
      const effUnit = effectiveSplitUnit(pot.amount, unit);
      const totalUnits = Math.round(pot.amount / effUnit);
      const thirdUnits = Math.floor(totalUnits / 3);
      const aAmount = Math.round(thirdUnits * effUnit * 100) / 100;
      const bAmount = Math.round(thirdUnits * effUnit * 100) / 100;
      const cAmount = Math.round((pot.amount - aAmount - bAmount) * 100) / 100;
      const aShares = chopSplit(aAmount, aArr, h.players, h.buttonSeat, effUnit);
      const bShares = chopSplit(bAmount, bArr, h.players, h.buttonSeat, effUnit);
      const cShares = chopSplit(cAmount, cArr, h.players, h.buttonSeat, effUnit);
      aShares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, board: 'a', playerId: s.playerId, amount: s.amount });
      });
      bShares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, board: 'b', playerId: s.playerId, amount: s.amount });
      });
      cShares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, board: 'c', playerId: s.playerId, amount: s.amount });
      });
    } else if (lowArr && lowArr.length && aArr.length
      && !(lowArr.length === aArr.length && aArr.every((id) => lowArr.includes(id)))) {
      // Hi/Lo (PLO8): half the pot to the best high hand, half to the best low,
      // with the odd chip going to the high half.
      const effUnit = effectiveSplitUnit(pot.amount, unit);
      const totalUnits = Math.round(pot.amount / effUnit);
      const lowUnits = Math.floor(totalUnits / 2);
      const lowAmount = Math.round(lowUnits * effUnit * 100) / 100;
      const highAmount = Math.round((pot.amount - lowAmount) * 100) / 100;
      const highShares = chopSplit(highAmount, aArr, h.players, h.buttonSeat, effUnit);
      const lowShares = chopSplit(lowAmount, lowArr, h.players, h.buttonSeat, effUnit);
      highShares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, playerId: s.playerId, amount: s.amount, part: 'high' });
      });
      lowShares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, playerId: s.playerId, amount: s.amount, part: 'low' });
      });
    } else if (bArr && bArr.length) {
      const effUnit = effectiveSplitUnit(pot.amount, unit);
      const totalUnits = Math.round(pot.amount / effUnit);
      const halfUnits = Math.floor(totalUnits / 2);
      const aAmount = Math.round(halfUnits * effUnit * 100) / 100;
      const bAmount = Math.round((pot.amount - aAmount) * 100) / 100;
      const aShares = chopSplit(aAmount, aArr, h.players, h.buttonSeat, effUnit);
      const bShares = chopSplit(bAmount, bArr, h.players, h.buttonSeat, effUnit);
      aShares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, board: 'a', playerId: s.playerId, amount: s.amount });
      });
      bShares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, board: 'b', playerId: s.playerId, amount: s.amount });
      });
    } else {
      if (aArr.length === 0) return;
      const shares = chopSplit(pot.amount, aArr, h.players, h.buttonSeat, unit);
      shares.forEach((s) => {
        const w = h.players.find((p) => p.id === s.playerId);
        if (w) w.stack += s.amount;
        h.winners.push({ potIndex: i, playerId: s.playerId, amount: s.amount });
      });
    }
  });

  const sg = h.sideGames || {};
  h.sideNotes = [];
  if (h.bombPot) h.sideNotes.push('Bomb pot – flop dealt immediately, no preflop action');
  if (sg.killPot) h.sideNotes.push('Kill pot');
  if (sg.halfKill) h.sideNotes.push('Half-kill pot');

  if (Array.isArray(options.bonuses)) {
    for (const b of options.bonuses) {
      const player = h.players.find((p) => p.id === b.playerId);
      if (!player) continue;
      const amt = Number(b.amount) || 0;
      if (amt <= 0) continue;
      if (b.type === 'sevenTwo') {
        let collected = 0;
        h.players.forEach((p) => {
          if (p.id === player.id) return;
          const pay = Math.min(amt, p.stack);
          p.stack -= pay;
          player.stack += pay;
          collected += pay;
        });
        h.sideNotes.push(`7-2: ${player.name} collected ${money(collected, h.currency)}`);
      } else if (b.type === 'bounty') {
        player.stack += amt;
        h.sideNotes.push(`Bounty: ${player.name} collected ${money(amt, h.currency)}`);
      } else if (b.type === 'mysteryBounty') {
        player.stack += amt;
        h.sideNotes.push(`Mystery bounty: ${player.name} collected ${money(amt, h.currency)}`);
      }
    }
  }

  // Process tournament bounties according to official bounty rules
  const isTournament = h.mode === 'tournament';
  const hasBounty = isTournament && Boolean((sg.bounty || h.bountyConfig?.bounty) && Number(sg.bountyAmount || h.bountyConfig?.bountyAmount) > 0);
  const hasMysteryBounty = isTournament && Boolean(sg.mysteryBounty || h.bountyConfig?.mysteryBounty);

  if (isTournament && (hasBounty || hasMysteryBounty)) {
    h.bountyAwards = h.bountyAwards || [];
    h.pendingMysteryBounties = h.pendingMysteryBounties || [];

    const eliminated = h.players.filter((p) => {
      const init = p.initialStack != null ? p.initialStack : 0;
      return init > 0 && p.stack <= 0;
    });

    for (const victim of eliminated) {
      const outcome = resolveBountyHunter(h, victim);
      if (outcome && outcome.winners.length > 0) {
        if (hasBounty) {
          const totalAmt = Number(sg.bountyAmount || h.bountyConfig?.bountyAmount) || 0;
          const share = totalAmt / outcome.winners.length;
          outcome.winners.forEach((winner) => {
            winner.bountiesCount = (winner.bountiesCount || 0) + 1;
            winner.bountyEarnings = (winner.bountyEarnings || 0) + share;
            h.bountyAwards.push({
              victimId: victim.id,
              victimName: victim.name,
              hunterId: winner.id,
              hunterName: winner.name,
              amount: share,
              potIndex: outcome.potIndex,
            });
          });
          const winnerNames = outcome.winners.map((w) => w.name).join(' & ');
          h.sideNotes.push(`Bounty: ${winnerNames} eliminated ${victim.name} (${money(totalAmt, h.currency)})`);
        }
        if (hasMysteryBounty) {
          h.pendingMysteryBounties.push({
            victimId: victim.id,
            victimName: victim.name,
            hunterIds: outcome.winners.map((w) => w.id),
            hunterNames: outcome.winners.map((w) => w.name),
            potIndex: outcome.potIndex,
          });
        }
      }
    }
  }

  let wonPots = new Set((h.wonPots || []).map((s) => Number(s)));
  h.winners.forEach((w) => {
    const p = h.players.find((pl) => pl.id === w.playerId);
    if (p) wonPots.add(Number(p.seat));
  });

  const mainIds = h.winners.filter((w) => w.potIndex === 0 && w.board !== 'b').map((w) => w.playerId);
  let lastWinnerSeat = h.lastWinnerSeat ?? null;
  let consecWins = h.consecWins || 0;
  if (mainIds.length === 1) {
    const w = h.players.find((pl) => pl.id === mainIds[0]);
    const wSeat = w ? Number(w.seat) : null;
    if (wSeat !== null && wSeat === lastWinnerSeat) consecWins += 1;
    else { lastWinnerSeat = wSeat; consecWins = 1; }
  } else {
    consecWins = 0;
  }
  h.lastWinnerSeat = lastWinnerSeat;
  h.consecWins = consecWins;

  const killOn = !!(sg.killPot || sg.halfKill);
  h.killType = sg.halfKill ? 'half' : 'kill';
  if (killOn) {
    if (consecWins >= 2 && lastWinnerSeat !== null) {
      h.killActive = true;
      h.killSeat = lastWinnerSeat;
    } else if (h.killActive && lastWinnerSeat !== null) {
      h.killActive = true;
      h.killSeat = lastWinnerSeat;
    }
  } else {
    h.killActive = false;
    h.killSeat = null;
  }

  if (sg.standUp) {
    const remaining = h.players.filter((p) => p.stack > 0);
    const nitters = remaining.filter((p) => !wonPots.has(Number(p.seat)));
    if (nitters.length === 1) {
      const nit = nitters[0];
      const penalty = Number(sg.standUpPenalty) || 0;
      if (penalty > 0) {
        const others = remaining.filter((p) => p.id !== nit.id);
        let total = 0;
        others.forEach((o) => {
          const pay = Math.min(penalty, nit.stack);
          nit.stack -= pay;
          o.stack += pay;
          total += pay;
        });
        h.sideNotes.push(`Nit: ${nit.name} paid ${money(total, h.currency)} (${money(penalty, h.currency)} × ${others.length})`);
      }
      wonPots = new Set();
    }
  }
  // A player can hold chips after a capped shove is refunded, or when they win a
  // side pot while short; such a player is not all-in any more, and leaving status
  // 'allin' shows a leftover stack next to an all-in badge.
  h.players.forEach((p) => {
    if (p.status === 'allin' && Math.round((p.stack || 0) * 100) / 100 > 0) p.status = 'active';
  });
  h.wonPots = [...wonPots];
  h.phase = 'awarded';
  return h;
}

export function nextHand(hand) {
  const adj = hand.pendingAdjust || {};
  const live = hand.players
    .map((p) => ({
      name: p.name,
      seat: p.seat,
      stack: Math.max(0, p.stack + (adj[p.id] || 0)),
      reentries: p.reentries || 0,
      rebuys: p.rebuys || 0,
      timeBanks: p.timeBanks != null ? p.timeBanks : (hand.clockConfig?.initialTimeBanks ?? 3),
      usedBanks: 0,
    }))
    .filter((p) => p.stack > 0);
  const pending = hand.pendingPlayers || [];
  const remaining = [...live, ...pending].sort((a, b) => a.seat - b.seat);
  const remainingNames = new Set(remaining.map((p) => p.name));
  const newlyBusted = hand.players
    .filter((p) => p.stack + (adj[p.id] || 0) <= 0)
    .map((p) => ({ name: p.name, seat: p.seat, reentries: p.reentries || 0 }));
  const stillEliminated = (hand.eliminatedPlayers || []).filter((e) => !remainingNames.has(e.name));
  const eliminatedPlayers = [...stillEliminated, ...newlyBusted].filter((e) => !remainingNames.has(e.name));

  if (remaining.length <= 1) {
    return { gameOver: true, remaining, eliminatedPlayers };
  }

  if (hand.mode === 'cash') {
    remaining.forEach((p, idx) => {
      p.seat = idx + 1;
    });
  }

  let newButtonSeat;
  if (hand.variant === 'win_button' && hand.winners && hand.winners.length > 0) {
    const winnerId = hand.winners[0]?.playerId;
    const winnerPlayer = hand.players.find((p) => p.id === winnerId);
    const inRemaining = winnerPlayer ? remaining.find((p) => p.name === winnerPlayer.name) : null;
    if (inRemaining) {
      newButtonSeat = inRemaining.seat;
    } else {
      const oldButtonIdx = remaining.findIndex((p) => p.seat === hand.buttonSeat);
      const startIdx = oldButtonIdx === -1 ? 0 : (oldButtonIdx + 1) % remaining.length;
      newButtonSeat = remaining[startIdx].seat;
    }
  } else {
    const oldButtonIdx = remaining.findIndex((p) => p.seat === hand.buttonSeat);
    const startIdx = oldButtonIdx === -1 ? 0 : (oldButtonIdx + 1) % remaining.length;
    newButtonSeat = remaining[startIdx].seat;
  }

  const config = {
    players: remaining,
    smallBlind: hand.smallBlind,
    bigBlind: hand.bigBlind,
    thirdBlind: hand.thirdBlind,
    fourthBlind: hand.fourthBlind,
    anteType: hand.anteType,
    anteAmount: hand.anteAmount,
    sbHalfAnteShortHanded: hand.sbHalfAnteShortHanded,
    shortHandedThreshold: hand.shortHandedThreshold,
    mode: hand.mode,
    currency: hand.currency,
    allowStraddle: hand.allowStraddle,
    allowMultiStraddle: hand.allowMultiStraddle,
    mandatoryStraddle: hand.mandatoryStraddle,
    mandatoryDoubleStraddle: hand.mandatoryDoubleStraddle,
    straddleAmount: hand.straddleAmount,
    mandatoryStraddleAmount: hand.mandatoryStraddleAmount,
    mandatoryDoubleStraddleAmount: hand.mandatoryDoubleStraddleAmount,
    blindSchedule: hand.blindSchedule,
    blindLevel: hand.blindLevel,
    levelConfig: hand.levelConfig,
    levelStartEpoch: hand.levelStartEpoch,
    levelHandsCompleted: hand.levelHandsCompleted,
    levelCount: hand.levelCount,
    tLevel: hand.tLevel,
    inBreak: hand.inBreak,
    pausedMs: hand.pausedMs,
    pauseStart: hand.pauseStart,
    pendingLevelIdx: hand.pendingLevelIdx,
    variant: hand.nextHandBombPot
      ? (hand.nextHandBombPot.variant || 'plo6')
      : isBombPotVariant(hand.variant)
      ? hand.variant
      : hand.bombPot
      ? (hand.baseVariant || 'holdem')
      : hand.variant,
    baseVariant: isBombPotVariant(hand.variant) ? hand.variant : (hand.baseVariant || hand.variant),
    baseDoubleBoard: isBombPotVariant(hand.variant)
      ? (hand.variant === 'double_board_bomb_pot')
      : (hand.baseDoubleBoard !== undefined ? hand.baseDoubleBoard : (hand.doubleBoard ?? false)),
    bombPot: isBombPotVariant(hand.variant) || !!hand.nextHandBombPot,
    bombAmount: hand.nextHandBombPot
      ? (hand.nextHandBombPot.anteAmount || hand.nextHandBombPot.bombAmount || hand.bombAmount || (hand.bigBlind * 5))
      : isBombPotVariant(hand.variant)
      ? (Number(hand.anteAmount) || Number(hand.bombAmount) || 10)
      : hand.bombAmount,
    bombBoards: hand.nextHandBombPot
      ? (hand.nextHandBombPot.boardCount || hand.nextHandBombPot.bombBoards || 2)
      : isBombPotVariant(hand.variant)
      ? (hand.variant === 'double_board_bomb_pot' ? 2 : 1)
      : (hand.baseDoubleBoard ? 2 : 1),
    doubleBoard: hand.nextHandBombPot
      ? ((hand.nextHandBombPot.boardCount || hand.nextHandBombPot.bombBoards || 2) >= 2)
      : isBombPotVariant(hand.variant)
      ? (hand.variant === 'double_board_bomb_pot')
      : (hand.baseDoubleBoard ?? false),
    runTimes: 1,
    boardB: [],
    boardC: [],
    nextHandBombPot: null,
    smallBet: hand.smallBet,
    bigBet: hand.bigBet,
    flMaxRaises: hand.flMaxRaises,
    chipDenominations: hand.chipDenominations,
    tableSize: hand.mode === 'cash' ? remaining.length : hand.tableSize,
    tournamentFormat: hand.tournamentFormat,
    maxReEntries: hand.maxReEntries,
    lateRegLevel: hand.lateRegLevel,
    lateRegEnabled: hand.lateRegEnabled,
    startingStack: hand.startingStack,
    rebuyPrice: hand.rebuyPrice,
    rebuyChips: hand.rebuyChips,
    rebuyRules: hand.rebuyRules || null,
    allowAddOn: hand.allowAddOn,
    addOnPrice: hand.addOnPrice,
    addOnChips: hand.addOnChips,
    eliminatedPlayers,
    clockConfig: hand.clockConfig,
    shotClockEnabled: hand.shotClockEnabled,
    temporaryGames: hand.temporaryGames || [],
    isTemporaryGame: !!hand.isTemporaryGame,
    temporaryGameTitle: hand.temporaryGameTitle || null,
    baseGameType: hand.baseGameType || hand.gameType || 'no_limit',
    baseBombPot: hand.baseBombPot !== undefined ? hand.baseBombPot : !!hand.bombPot,
    baseBombBoards: hand.baseBombBoards || (hand.bombBoards || 1),
    sideGames: hand.sideGames || {},
    wonPots: hand.wonPots || [],
    lastWinnerSeat: hand.lastWinnerSeat ?? null,
    consecWins: hand.consecWins || 0,
    killActive: hand.killActive,
    killSeat: hand.killSeat,
    killType: hand.killType,
  };
  return { hand: startHand(config, newButtonSeat, hand.handNumber + 1) };
}

export function fmt(n) {
  const parsed = parseAmount(n);
  const num = parsed != null ? parsed : (Number(n) || 0);
  return num.toLocaleString('en-US');
}

export function money(n, currency = '') {
  const parsed = parseAmount(n);
  const num = parsed != null ? parsed : (Number(n) || 0);
  const absN = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const sym = currency || '';

  const hasDec = !Number.isInteger(num);
  const str = absN.toLocaleString('en-US', { minimumFractionDigits: hasDec ? 2 : 0, maximumFractionDigits: 2 });
  return `${sign}${sym}${str}`;
}

export function formatPotAmount(n, currency = '', hand = null, displayUnit = 'chips') {
  if (n == null || n === '') return '';
  const parsed = parseAmount(n);
  const num = parsed != null ? parsed : (Number(n) || 0);
  const absN = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const isTourney = hand?.mode === 'tournament';
  const sym = isTourney ? '' : (currency || '');
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';

  if (activeUnit === 'bb' || activeUnit === 'both') {
    const bbVal = Number(hand?.bigBlind) || 0;
    if (bbVal > 0) {
      const bbs = absN / bbVal;
      const rounded = Math.round(bbs * 10) / 10;
      const str = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
      if (activeUnit === 'bb') return `${sign}${str} BB`;
      // 'both' is used at an all-in when players picked different stack units.
      return `${formatPotAmount(n, currency, hand, 'chips')} (${str} BB)`;
    }
  }

  const hasDec = !Number.isInteger(num);
  const str = absN.toLocaleString('en-US', {
    minimumFractionDigits: hasDec ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${sign}${sym}${str}`;
}

export function formatSessionName(hand) {
  if (!hand) return "Hold'em - Hand #1";
  if (hand.sessionName) return hand.sessionName;
  if (hand.config?.sessionName) return hand.config.sessionName;
  const num = hand.handNumber || 1;
  const isBomb = !!hand.bombPot;
  const v = (hand.variant || 'nlh').toLowerCase();
  if (v === 'bomb_pot') return `Bomb Pot - Hand #${num}`;
  if (v === 'double_board_bomb_pot') return `Double Board Bomb Pot - Hand #${num}`;

  let label = "Hold'em";
  if (v === 'plo6') label = 'PLO6';
  else if (v === 'plo5') label = 'PLO5';
  else if (v === 'plo' || v === 'plo4') label = 'PLO';
  else if (v === 'short_deck') label = 'Short Deck';
  else if (v === 'pineapple') label = 'Pineapple';
  else if (v === 'lazy_pineapple') label = 'Lazy Pineapple';
  else if (v === 'crazy_pineapple') label = 'Crazy Pineapple';
  else if (v === 'super_holdem') label = "Super Hold'em";
  else if (v === 'dramaha') label = 'Dramaha';
  else if (v === 'plo8') label = 'Omaha Hi/Lo';
  else if (v === 'ace_to_five') label = 'A-5 Lowball';
  else if (v === 'deuce_to_seven') label = '2-7 Lowball';
  else if (VARIANTS[v]?.label) label = VARIANTS[v].label;

  if (isBomb) {
    return `${label} Bomb Pot - Hand #${num}`;
  }
  return `${label} - Hand #${num}`;
}

export function formatPotOutcome(pot, potIndex, winners = [], players = [], currency = '') {
  const potLabel = potIndex === 0 ? 'Main pot' : `Side pot ${potIndex}`;
  const potWinners = (winners || []).filter((w) => w.potIndex === potIndex);
  if (!potWinners.length) return null;

  const playerCounts = {};
  potWinners.forEach((w) => {
    playerCounts[w.playerId] = (playerCounts[w.playerId] || 0) + 1;
  });

  const uniquePids = Object.keys(playerCounts);
  const totalShares = potWinners.length;
  const potFormatted = money(pot.amount, currency);

  const getPlayerName = (pid) => {
    const byId = (players || []).find((p) => String(p.id) === String(pid));
    if (byId) return byId.name;
    const bySeat = (players || []).find((p) => String(p.seat) === String(pid));
    return bySeat?.name || `Player ${pid}`;
  };

  const hiWinners = potWinners.filter((w) => w.part === 'high');
  const loWinners = potWinners.filter((w) => w.part === 'low');
  if (hiWinners.length && loWinners.length) {
    const fmtPart = (part, list) => {
      const amt = list.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
      const names = [...new Set(list.map((w) => w.playerId))]
        .map((pid) => {
          const n = list.filter((w) => w.playerId === pid).length;
          return n > 1 ? `${getPlayerName(pid)} (${n}/${list.length})` : getPlayerName(pid);
        });
      return `${names.join(' & ')} ${part} ${money(amt, currency)}`;
    };
    return `${potLabel}: ${fmtPart('high', hiWinners)} · ${fmtPart('low', loWinners)}`;
  }

  if (uniquePids.length === 1) {
    const winnerName = getPlayerName(uniquePids[0]);
    return `${potLabel}: ${winnerName} wins ${potFormatted}`;
  }

  // Multiple winners splitting the pot
  const parts = uniquePids.map((pid) => {
    const name = getPlayerName(pid);
    const count = playerCounts[pid];
    if (totalShares > uniquePids.length) {
      return `${name} (${count}/${totalShares})`;
    }
    return name;
  });

  const names = parts.join(' & ');
  return `${potLabel}: ${names} split ${potFormatted}`;
}

export function rankDisplay(r) {
  return r === 'T' ? '10' : r;
}

const RV = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

function cmpScore(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function evaluate7(cards, shortDeck = false) {
  const vals = cards.map((c) => RV[c.rank]).sort((a, b) => b - a);
  const suitCount = { s: 0, h: 0, d: 0, c: 0 };
  const suitRanks = { s: [], h: [], d: [], c: [] };
  for (const c of cards) {
    suitCount[c.suit]++;
    suitRanks[c.suit].push(RV[c.rank]);
  }
  let flushSuit = null;
  for (const s of SUITS) if (suitCount[s] >= 5) flushSuit = s;
  const rc = {};
  for (const v of vals) rc[v] = (rc[v] || 0) + 1;
  const groups = Object.entries(rc).map(([r, c]) => [Number(r), c]);
  groups.sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  function straightHigh(rankArr) {
    const u = [...new Set(rankArr)].sort((a, b) => b - a);
    const arr = u.includes(14) ? [...u, 1] : u;
    for (let i = 0; i <= arr.length - 5; i++) {
      if (arr[i] - arr[i + 4] === 4) return arr[i];
    }
    return 0;
  }

  if (flushSuit) {
    const sf = straightHigh(suitRanks[flushSuit]);
    if (sf) return [8, sf];
  }
  if (groups[0][1] === 4) {
    const k = vals.find((v) => v !== groups[0][0]);
    return [7, groups[0][0], k];
  }
  if (groups[0][1] === 3 && groups[1] && groups[1][1] >= 2) {
    return [shortDeck ? 5 : 6, groups[0][0], groups[1][0]];
  }
  if (flushSuit) {
    const fv = suitRanks[flushSuit].slice().sort((a, b) => b - a).slice(0, 5);
    return [shortDeck ? 6 : 5, ...fv];
  }
  const sh = straightHigh(vals);
  if (sh) return [4, sh];
  if (groups[0][1] === 3) {
    const k = vals.filter((v) => v !== groups[0][0]).slice(0, 2);
    return [3, groups[0][0], ...k];
  }
  if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) {
    const k = vals.find((v) => v !== groups[0][0] && v !== groups[1][0]);
    return [2, groups[0][0], groups[1][0], k];
  }
  if (groups[0][1] === 2) {
    const k = vals.filter((v) => v !== groups[0][0]).slice(0, 3);
    return [1, groups[0][0], ...k];
  }
  return [0, ...vals.slice(0, 5)];
}

export function evaluateOmahaStyle(hole, board) {
  let best = null;
  for (let i = 0; i < hole.length; i++) {
    for (let j = i + 1; j < hole.length; j++) {
      for (let a = 0; a < board.length; a++) {
        for (let b = a + 1; b < board.length; b++) {
          for (let c = b + 1; c < board.length; c++) {
            const sc = evaluate7([hole[i], hole[j], board[a], board[b], board[c]]);
            if (!best || cmpScore(sc, best) > 0) best = sc;
          }
        }
      }
    }
  }
  return best;
}

function lowScore5(cards, acesLow, countSF) {
  const vals = cards.map((c) => (c.rank === 'A' ? (acesLow ? 1 : 14) : RV[c.rank])).sort((a, b) => a - b);
  const counts = {};
  vals.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const dup = vals.length - Object.keys(counts).length;
  const distinct = [...new Set(vals)].sort((a, b) => a - b);
  let isStraight = distinct.length === 5 && distinct[4] - distinct[0] === 4;
  if (acesLow && isStraight && distinct[0] === 1) isStraight = false;
  const isFlush = new Set(cards.map((c) => c.suit)).size === 1;
  const penalty = (countSF && (isStraight || isFlush)) ? 1 : 0;
  const desc = [...vals].sort((a, b) => b - a);
  return [penalty, dup, ...desc];
}

export function evaluateLow(cards, acesLow, countSF) {
  const n = cards.length;
  if (n <= 5) return lowScore5(cards, acesLow, countSF);
  let best = null;
  const combo = (start, picked) => {
    if (picked.length === 5) {
      const sc = lowScore5(picked.map((i) => cards[i]), acesLow, countSF);
      if (!best || cmpScore(sc, best) < 0) best = sc;
      return;
    }
    for (let i = start; i < n; i++) {
      picked.push(i);
      combo(i + 1, picked);
      picked.pop();
    }
  };
  combo(0, []);
  return best;
}

const LOW8_RANKS = new Set(['A', '2', '3', '4', '5', '6', '7', '8']);

// Omaha Hi/Lo low half: exactly two hole cards plus three board cards, five
// unpaired ranks of eight or lower (aces low). Returns null when no low qualifies.
export function omahaLowScore(hole, board) {
  if (!hole || !board || hole.length < 2 || board.length < 3) return null;
  let best = null;
  for (let a = 0; a < hole.length - 1; a++) {
    for (let b = a + 1; b < hole.length; b++) {
      for (let x = 0; x < board.length - 2; x++) {
        for (let y = x + 1; y < board.length - 1; y++) {
          for (let z = y + 1; z < board.length; z++) {
            const cards = [hole[a], hole[b], board[x], board[y], board[z]];
            if (!cards.every((c) => c && LOW8_RANKS.has(c.rank))) continue;
            if (new Set(cards.map((c) => c.rank)).size !== 5) continue;
            const sc = evaluateLow(cards, true);
            if (!best || cmpScore(sc, best) < 0) best = sc;
          }
        }
      }
    }
  }
  return best;
}

function fitsStraightWindow(ranks, H) {
  const win = [H, H - 1, H - 2, H - 3, H - 4];
  const used = new Set();
  for (const r of ranks) {
    const v = RV[r];
    let matched = false;
    if (win.includes(v) && !used.has(v)) {
      used.add(v);
      matched = true;
    } else if (v === 14 && win.includes(1) && !used.has(1)) {
      used.add(1);
      matched = true;
    }
    if (!matched) return false;
  }
  return true;
}

export function evaluate5DeucesWild(cards5) {
  const deuces = cards5.filter((c) => c && c.rank === '2');
  const naturals = cards5.filter((c) => c && c.rank !== '2');
  const w = deuces.length;

  if (w === 0) {
    const sc = evaluate7(cards5);
    if (sc[0] === 8 && sc[1] === 14) return [9, 14];
    return sc;
  }

  if (w >= 5) return [9, 14];

  const candidateRanks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3'];
  const candidateSuits = ['s', 'h', 'd', 'c'];

  if (w === 4) {
    const c1 = naturals[0];
    if (['A', 'K', 'Q', 'J', 'T'].includes(c1.rank)) {
      return [9, 14]; // Royal Flush
    }
    return [8.5, RV[c1.rank]]; // Five of a Kind
  }

  if (w === 3) {
    const [c1, c2] = naturals;
    const v1 = RV[c1.rank];
    const v2 = RV[c2.rank];

    if (v1 === v2) {
      return [8.5, v1]; // Five of a Kind
    }

    if (c1.suit === c2.suit && ['A', 'K', 'Q', 'J', 'T'].includes(c1.rank) && ['A', 'K', 'Q', 'J', 'T'].includes(c2.rank)) {
      return [9, 14]; // Royal Flush
    }

    if (c1.suit === c2.suit) {
      for (let h = 13; h >= 5; h--) {
        if (fitsStraightWindow([c1.rank, c2.rank], h)) {
          return [8, h];
        }
      }
    }

    const rHigh = Math.max(v1, v2);
    const rLow = Math.min(v1, v2);
    return [7, rHigh, rLow];
  }

  if (w === 2) {
    const [c1, c2, c3] = naturals;
    const v1 = RV[c1.rank];
    const v2 = RV[c2.rank];
    const v3 = RV[c3.rank];

    if (v1 === v2 && v2 === v3) {
      return [8.5, v1]; // Five of a Kind
    }

    const sameSuit3 = c1.suit === c2.suit && c2.suit === c3.suit;
    const allRoyal = ['A', 'K', 'Q', 'J', 'T'].includes(c1.rank) &&
                     ['A', 'K', 'Q', 'J', 'T'].includes(c2.rank) &&
                     ['A', 'K', 'Q', 'J', 'T'].includes(c3.rank);
    if (sameSuit3 && allRoyal) {
      return [9, 14]; // Royal Flush
    }

    if (sameSuit3) {
      for (let h = 13; h >= 5; h--) {
        if (fitsStraightWindow([c1.rank, c2.rank, c3.rank], h)) {
          return [8, h];
        }
      }
    }

    if (v1 === v2 || v1 === v3 || v2 === v3) {
      const quadRank = (v1 === v2 || v1 === v3) ? v1 : v2;
      const kicker = (v1 === v2) ? v3 : (v1 === v3 ? v2 : v1);
      return [7, quadRank, kicker];
    }

    if (sameSuit3) {
      const naturalVals = [v1, v2, v3];
      const avail = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3].filter((val) => !naturalVals.includes(val));
      const flushVals = [...naturalVals, avail[0], avail[1]].sort((a, b) => b - a);
      return [5, ...flushVals];
    }

    for (let h = 14; h >= 5; h--) {
      if (fitsStraightWindow([c1.rank, c2.rank, c3.rank], h)) {
        return [4, h];
      }
    }

    const sortedVals = [v1, v2, v3].sort((a, b) => b - a);
    return [3, sortedVals[0], sortedVals[1], sortedVals[2]];
  }

  // w === 1
  const natRanks = naturals.map((c) => RV[c.rank]);
  if (natRanks[0] === natRanks[1] && natRanks[1] === natRanks[2] && natRanks[2] === natRanks[3]) {
    return [8.5, natRanks[0]]; // Five of a Kind
  }

  const existingKeys = new Set(naturals.map((c) => c.rank + c.suit));
  let bestScore = null;
  for (const r of candidateRanks) {
    for (const s of candidateSuits) {
      if (existingKeys.has(r + s)) continue;
      const sc = evaluate7([...naturals, { rank: r, suit: s }]);
      const finalSc = (sc[0] === 8 && sc[1] === 14) ? [9, 14] : sc;
      if (!bestScore || cmpScore(finalSc, bestScore) > 0) {
        bestScore = finalSc;
      }
    }
  }
  return bestScore || evaluate7(cards5);
}

export function evaluate7DeucesWild(cards) {
  const n = cards.length;
  if (n < 5) return evaluate7(cards);
  let bestScore = null;
  const combos = [];
  const generateCombos = (start, chosen) => {
    if (chosen.length === 5) {
      combos.push([...chosen]);
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(cards[i]);
      generateCombos(i + 1, chosen);
      chosen.pop();
    }
  };
  generateCombos(0, []);

  for (const combo of combos) {
    const score = evaluate5DeucesWild(combo);
    if (!bestScore || cmpScore(score, bestScore) > 0) bestScore = score;
  }
  return bestScore || evaluate7(cards);
}

export function best5OfDeucesWild(cards) {
  const n = cards.length;
  if (n <= 5) return cards;
  let bestScore = null;
  let bestCards = null;
  const combos = [];
  const generateCombos = (start, chosen) => {
    if (chosen.length === 5) {
      combos.push([...chosen]);
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(cards[i]);
      generateCombos(i + 1, chosen);
      chosen.pop();
    }
  };
  generateCombos(0, []);

  for (const combo of combos) {
    const score = evaluate5DeucesWild(combo);
    if (!bestScore || cmpScore(score, bestScore) > 0) {
      bestScore = score;
      bestCards = combo;
    }
  }
  return bestCards || cards.slice(0, 5);
}

export function calcEquity(holes, board, iterations = 20000, variant = 'nlh', holeSizeOverride, deadCards = []) {
  const meta = variantMeta(variant);
  const holeSize = holeSizeOverride || meta.holeSize;
  const numPlayers = holes.length;
  const realBoard = Array.isArray(board) ? board.filter((c) => c && !c.hidden) : [];
  const lowGame = meta.group === 'low';
  const effectiveIters = variant === 'deuces_wild' ? Math.min(iterations, 3000) : iterations;
  const used = new Set();
  for (const h of holes) if (h) for (const c of h) used.add(c.rank + c.suit);
  for (const c of realBoard) used.add(c.rank + c.suit);
  if (Array.isArray(deadCards)) {
    for (const c of deadCards) if (c && !c.hidden) used.add(c.rank + c.suit);
  }
  const deckRanks = meta.deck === 'short' ? ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] : RANKS;
  const deck = [];
  for (const r of deckRanks) {
    for (const s of SUITS) {
      const key = r + s;
      if (!used.has(key)) deck.push({ rank: r, suit: s });
    }
  }
  let needBoard;
  if (lowGame) {
    needBoard = 0;
  } else if (variant === 'red_river') {
    if (realBoard.length < 5) {
      needBoard = 5 - realBoard.length;
    } else {
      const lastCard = realBoard[realBoard.length - 1];
      const isRed = lastCard && (lastCard.suit === 'd' || lastCard.suit === 'h' || lastCard.suit === '♦' || lastCard.suit === '♥');
      needBoard = isRed ? 1 : 0;
    }
  } else if (variant === 'three_two_one' || variant === 'ocean') {
    needBoard = Math.max(0, 6 - realBoard.length);
  } else {
    needBoard = Math.max(0, 5 - realBoard.length);
  }
  let unknownHoles = 0;
  for (let i = 0; i < numPlayers; i++) if (!holes[i]) unknownHoles++;
  const totalDraw = needBoard + unknownHoles * holeSize;
  const evalFn = variant === 'lazy_pineapple'
    ? (h, b) => evaluateLazyPineapple(h, b, meta.deck === 'short')
    : meta.group === 'omaha'
    ? (h, b) => evaluateOmahaStyle(h, b)
    : meta.group === 'low'
    ? (h, b) => evaluateLow([...h, ...b], meta.lowKind === 'a5', meta.lowKind === '27')
    : variant === 'deuces_wild'
    ? (h, b) => evaluate7DeucesWild([...h, ...b])
    : (h, b) => evaluate7([...h, ...b], meta.deck === 'short');
  const isSecondBest = variant === 'second_best';
  const wins = new Array(numPlayers).fill(0);
  let splits = 0;
  for (let it = 0; it < effectiveIters; it++) {
    for (let i = 0; i < totalDraw; i++) {
      const j = i + Math.floor(Math.random() * (deck.length - i));
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    let di = 0;
    const playerCards = [];
    for (let i = 0; i < numPlayers; i++) {
      if (holes[i]) playerCards.push(holes[i]);
      else {
        const drawn = [];
        for (let k = 0; k < holeSize; k++) drawn.push(deck[di++]);
        playerCards.push(drawn);
      }
    }
    const fullBoard = realBoard.slice();
    for (let i = 0; i < needBoard; i++) fullBoard.push(deck[di++]);
    const scores = playerCards.map((h) => evalFn(h, fullBoard));

    let targetScore;
    if (isSecondBest && numPlayers >= 2) {
      const sorted = [...scores].sort((a, b) => cmpScore(b, a));
      const topScore = sorted[0];
      const secondScoreObj = sorted.find((s) => cmpScore(s, topScore) !== 0);
      targetScore = secondScoreObj ? secondScoreObj : topScore;
    } else {
      let best = scores[0];
      for (let i = 1; i < numPlayers; i++) {
        const c = cmpScore(scores[i], best);
        if (meta.low ? c < 0 : c > 0) best = scores[i];
      }
      targetScore = best;
    }

    const winners = [];
    for (let i = 0; i < numPlayers; i++) if (cmpScore(scores[i], targetScore) === 0) winners.push(i);
    if (winners.length === 1) wins[winners[0]]++;
    else splits++;
  }
  const results = [];
  for (let i = 0; i < numPlayers; i++) results.push({ win: (wins[i] / effectiveIters) * 100 });
  return { results, split: (splits / effectiveIters) * 100 };
}

export function calculateEffectiveM(player, hand) {
  if (!hand || hand.mode === 'cash' || !player) return null;
  const stack = Number(player.stack) || 0;
  const sb = Number(hand.smallBlind) || 0;
  const bb = Number(hand.bigBlind) || 0;
  const playersRemaining = (hand.players || []).filter((p) => (p.stack || 0) > 0).length || (hand.players || []).length || 1;

  if (isBombPotVariant(hand.variant) || (sb === 0 && bb === 0 && hand.bombPot)) {
    const anteVal = Number(hand.bombAmount || hand.anteAmount) || 0;
    const orbitCost = anteVal * playersRemaining;
    if (orbitCost <= 0) return null;
    const basicM = stack / orbitCost;
    return basicM * (playersRemaining / 10);
  }

  let antes = 0;
  if (hand.anteType === 'traditional' && Number(hand.anteAmount) > 0) {
    antes = Number(hand.anteAmount) * playersRemaining;
  } else if (hand.anteType === 'bba') {
    antes = Number(hand.anteAmount) > 0 ? Number(hand.anteAmount) : bb;
  }

  const orbitCost = sb + bb + antes;
  if (orbitCost <= 0) return null;

  const basicM = stack / orbitCost;
  const effectiveM = basicM * (playersRemaining / 10);
  return effectiveM;
}

export function calculateAllInOuts(hand, holeCards) {
  if (!hand || !holeCards) return [];
  const players = hand.players || [];
  const nf = players.filter((p) => p.status !== 'folded');
  if (nf.length < 2) return [];

  // Must be an all-in situation (at least one player is allin or no further action / currentPlayer === -1)
  const hasAllIn = nf.some((p) => p.status === 'allin' || p.stack === 0);
  if (!hasAllIn && hand.currentPlayer !== -1) return [];

  const variant = hand.variant || 'nlh';
  const meta = variantMeta(variant);
  const lowGame = meta.group === 'low';

  // Ensure all active contestants have complete known hole cards
  const contestants = [];
  for (const p of nf) {
    const h = holeCards[p.id];
    if (!h || !holeCardsComplete(hand, h)) return [];
    contestants.push(p);
  }

  const isTripleRun = (Number(hand.bombBoards) >= 3) || (hand.boardC && hand.boardC.length > 0) || (Number(hand.runTimes) >= 3);
  const isMultiRun = (Number(hand.runTimes) >= 2) || hand.doubleBoard || isTripleRun;

  const boardA = (hand.communityCards || []).filter((c) => c && !c.hidden);
  const boardB = (hand.boardB || []).filter((c) => c && !c.hidden);
  const boardC = (hand.boardC || []).filter((c) => c && !c.hidden);

  let board = boardA;
  const targetLen = (variant === 'three_two_one' || variant === 'ocean') ? 6 : 5;
  if (boardA.length >= targetLen && isMultiRun) {
    if (boardB.length < targetLen) {
      board = boardB;
    } else if (isTripleRun && boardC.length < targetLen) {
      board = boardC;
    } else {
      return [];
    }
  }

  // If board is complete: no future outs
  if (board.length >= targetLen) return [];

  // Omaha requires at least 3 community cards
  if (meta.group === 'omaha' && board.length < 3) return [];

  const evalFn = variant === 'lazy_pineapple'
    ? (h, b) => evaluateLazyPineapple(h, b, meta.deck === 'short')
    : meta.group === 'omaha'
    ? (h, b) => evaluateOmahaStyle(h, b)
    : lowGame
    ? (h, b) => evaluateLow([...h, ...b], meta.lowKind === 'a5', meta.lowKind === '27')
    : variant === 'deuces_wild'
    ? (h, b) => evaluate7DeucesWild([...h, ...b])
    : (h, b) => evaluate7([...h, ...b], meta.deck === 'short');

  const isSecondBest = variant === 'second_best';
  const isHeadsUp = contestants.length === 2;
  const scores = contestants.map((p) => evalFn(holeCards[p.id], board));

  let currentTargetScore;
  if (isSecondBest && contestants.length >= 2) {
    const sorted = [...scores].sort((a, b) => cmpScore(b, a));
    const topScore = sorted[0];
    currentTargetScore = sorted.find((s) => cmpScore(s, topScore) !== 0) || topScore;
  } else {
    let best = scores[0];
    for (let i = 1; i < contestants.length; i++) {
      const c = cmpScore(scores[i], best);
      if (lowGame ? c < 0 : c > 0) best = scores[i];
    }
    currentTargetScore = best;
  }

  // Identify contestants who are currently trailing or tied for leader
  const candidates = [];
  contestants.forEach((p, idx) => {
    const diff = cmpScore(scores[idx], currentTargetScore);
    if (diff !== 0) {
      candidates.push({ player: p, currentScore: scores[idx], isTied: false });
    } else {
      const tiedCount = contestants.filter((_, oIdx) => cmpScore(scores[oIdx], currentTargetScore) === 0).length;
      if (tiedCount > 1) {
        candidates.push({ player: p, currentScore: scores[idx], isTied: true });
      }
    }
  });

  if (candidates.length === 0) return [];

  // Build remaining unseen cards in deck (excluding all hole cards, folded cards, and board cards)
  const used = new Set();
  for (const p of players) {
    const h = holeCards[p.id];
    if (h) for (const c of h) if (c && !c.hidden) used.add(c.rank + c.suit);
  }
  if (Array.isArray(hand.foldedCards)) {
    for (const c of hand.foldedCards) if (c && !c.hidden) used.add(c.rank + c.suit);
  }
  for (const c of boardA) if (c && !c.hidden) used.add(c.rank + c.suit);
  for (const c of boardB) if (c && !c.hidden) used.add(c.rank + c.suit);
  for (const c of boardC) if (c && !c.hidden) used.add(c.rank + c.suit);

  const deckRanks = meta.deck === 'short' ? ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] : RANKS;
  const remainingDeck = [];
  for (const r of deckRanks) {
    for (const s of SUITS) {
      if (!used.has(r + s)) remainingDeck.push({ rank: r, suit: s });
    }
  }

  // Ranking orders: A to 2, then spades, hearts, diamonds, clubs
  const RANK_ORDER = { A: 14, K: 13, Q: 12, J: 11, T: 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
  const SUIT_ORDER = { s: 0, h: 1, d: 2, c: 3 };

  const beats = (score1, score2) => {
    const c = cmpScore(score1, score2);
    return lowGame ? c < 0 : c > 0;
  };
  const ties = (score1, score2) => cmpScore(score1, score2) === 0;
  const loses = (score1, score2) => {
    const c = cmpScore(score1, score2);
    return lowGame ? c > 0 : c < 0;
  };

  const isValidDirtyOut = (myHole, curBoard, card, myCandidateScore) => {
    if (lowGame || !myCandidateScore) return false;
    const cat = myCandidateScore[0];
    // Rule A (Board-Pair Trap): Card C pairs the board AND Hero's best hand is only One Pair -> brick
    const pairsBoard = curBoard.some((b) => b && !b.hidden && b.rank === card.rank);
    if (pairsBoard && cat === 1) return false;
    // Rule B (True Dirty Out Definition): Must give Hero Straight, Flush, Full House, Trips, or Two Pair (or better) using Hero's own hole cards
    if (cat < 2) return false;
    if (variant === 'deuces_wild' && (myHole || []).some((c) => c && c.rank === '2')) {
      return true;
    }
    const candidateBoard = [...curBoard, card];
    const isShort = meta.deck === 'short';
    const holeRankVals = new Set((myHole || []).filter(Boolean).map((c) => RV[c.rank]));
    const boardRankVals = new Set(candidateBoard.filter(Boolean).map((c) => RV[c.rank]));
    const fullHouseCat = isShort ? 5 : 6;
    const flushCat = isShort ? 6 : 5;

    if (meta.group === 'omaha') {
      if (cat === 3 || cat === 7) return holeRankVals.has(myCandidateScore[1]);
      if (cat === fullHouseCat) return holeRankVals.has(myCandidateScore[1]) || holeRankVals.has(myCandidateScore[2]);
      return true;
    }

    if (cat === 2) {
      return holeRankVals.has(myCandidateScore[1]) || holeRankVals.has(myCandidateScore[2]);
    }
    if (cat === 3 || cat === 7) {
      return holeRankVals.has(myCandidateScore[1]);
    }
    if (cat === fullHouseCat) {
      return holeRankVals.has(myCandidateScore[1]) || holeRankVals.has(myCandidateScore[2]);
    }
    if (cat === 4) {
      const h = myCandidateScore[1];
      const needed = [h, h - 1, h - 2, h - 3, h - 4].map((v) => (v === 1 ? 14 : v));
      return needed.some((v) => holeRankVals.has(v) && !boardRankVals.has(v));
    }
    if (cat === flushCat) {
      const combined = [
        ...(myHole || []).filter(Boolean).map((c) => ({ ...c, _h: true })),
        ...candidateBoard.filter(Boolean).map((c) => ({ ...c, _h: false })),
      ];
      for (const s of SUITS) {
        const suited = combined.filter((c) => c.suit === s);
        if (suited.length >= 5) {
          suited.sort((a, b) => RV[b.rank] - RV[a.rank]);
          return suited.slice(0, 5).some((c) => c._h);
        }
      }
      return false;
    }
    if (cat >= 8) {
      if (cat >= 8.5 && variant === 'deuces_wild') return true;
      const sfHigh = myCandidateScore[1];
      const sfNeeded = new Set([sfHigh, sfHigh - 1, sfHigh - 2, sfHigh - 3, sfHigh - 4].map((v) => (v === 1 ? 14 : v)));
      for (const s of SUITS) {
        const holeSuited = new Set((myHole || []).filter((c) => c && c.suit === s).map((c) => RV[c.rank]));
        const boardSuited = new Set(candidateBoard.filter((c) => c && c.suit === s).map((c) => RV[c.rank]));
        const allMatch = [...sfNeeded].every((v) => holeSuited.has(v) || boardSuited.has(v));
        if (allMatch) {
          return [...sfNeeded].some((v) => holeSuited.has(v) && !boardSuited.has(v));
        }
      }
      return false;
    }
    return false;
  };

  const results = [];
  for (const item of candidates) {
    const p = item.player;
    const currentScore = item.currentScore;
    const winOuts = [];
    const chopOuts = [];
    const dirtyOuts = [];
    const myHole = holeCards[p.id];

    for (const card of remainingDeck) {
      const candidateBoard = [...board, card];
      const myCandidateScore = evalFn(myHole, candidateBoard);

      if (isSecondBest && contestants.length >= 2) {
        const candidateScores = contestants.map((cPlayer) => evalFn(holeCards[cPlayer.id], candidateBoard));
        const sorted = [...candidateScores].sort((a, b) => cmpScore(b, a));
        const top = sorted[0];
        const sec = sorted.find((s) => cmpScore(s, top) !== 0) || top;

        if (cmpScore(myCandidateScore, sec) === 0) {
          winOuts.push({ ...card, isDirty: false, isChop: false });
        }
        continue;
      }

      if (isHeadsUp) {
        const opp = contestants.find((c) => c.id !== p.id);
        const oppId = opp.id;
        const oppCurrentScore = evalFn(holeCards[oppId], board);
        const oppCandidateScore = evalFn(holeCards[oppId], candidateBoard);

        if (item.isTied) {
          // Reminder: if tied at the moment, only show outs for the player who has a chance to win.
          // Do NOT show chop outs if tied at the moment.
          if (beats(myCandidateScore, oppCandidateScore)) {
            winOuts.push({ ...card, isDirty: false, isChop: false });
          }
        } else {
          // Hero is currently behind!
          // Check 1 (The "Actual Out" Test): Does Hero's new hand (with card C) beat Villain's current, static hand (evaluated without card C)?
          // • If NO: Stop immediately. Card C is a Brick / Non-Out.
          // • If YES: Card C is a valid out. Proceed to Check 2.
          if (!beats(myCandidateScore, oppCurrentScore)) {
            continue;
          }

          // Check 2 (The "Clean vs. Dirty" Test): Does Hero's new hand (with card C) also beat Villain's new hand (evaluated with card C)?
          // • If YES: Card C is a Clean Out.
          // • If TIE: Card C is a Chop Out.
          // • If NO: Card C is a Dirty Out (only if Rule A & Rule B pass).
          if (beats(myCandidateScore, oppCandidateScore)) {
            winOuts.push({ ...card, isDirty: false, isChop: false });
          } else if (ties(myCandidateScore, oppCandidateScore)) {
            chopOuts.push({ ...card, isDirty: false, isChop: true });
          } else if (isValidDirtyOut(myHole, board, card, myCandidateScore)) {
            dirtyOuts.push({ ...card, isDirty: true, isChop: false });
          }
        }
      } else {
        // Multi-way (3+ contestants)
        if (item.isTied) {
          // If tied at the moment, only show outs for player who has a chance to win
          let beatsAll = true;
          for (const other of contestants) {
            if (other.id === p.id) continue;
            const otherCandidateScore = evalFn(holeCards[other.id], candidateBoard);
            if (!beats(myCandidateScore, otherCandidateScore)) {
              beatsAll = false;
              break;
            }
          }
          if (beatsAll) {
            winOuts.push({ ...card, isDirty: false, isChop: false });
          }
        } else {
          // Hero is behind:
          // Check 1: Does Hero's new hand beat the current static best hand?
          if (!beats(myCandidateScore, currentTargetScore)) {
            continue;
          }

          // Check 2: Does Hero's new hand also beat all opponents' new hands?
          let beatsAll = true;
          let tiesForWin = true;
          for (const other of contestants) {
            if (other.id === p.id) continue;
            const otherCandidateScore = evalFn(holeCards[other.id], candidateBoard);
            if (!beats(myCandidateScore, otherCandidateScore)) {
              beatsAll = false;
            }
            if (loses(myCandidateScore, otherCandidateScore)) {
              tiesForWin = false;
            }
          }

          if (beatsAll) {
            winOuts.push({ ...card, isDirty: false, isChop: false });
          } else if (tiesForWin) {
            chopOuts.push({ ...card, isDirty: false, isChop: true });
          }
        }
      }
    }

    const sortCards = (arr) => arr.sort((a, b) => {
      const rd = (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0);
      if (rd !== 0) return rd;
      return (SUIT_ORDER[a.suit] ?? 99) - (SUIT_ORDER[b.suit] ?? 99);
    });

    sortCards(winOuts);
    sortCards(chopOuts);
    sortCards(dirtyOuts);

    const isChopOnly = !item.isTied && winOuts.length === 0 && chopOuts.length > 0;
    let outs = [];
    if (item.isTied) {
      // If tied at the moment, only show outs for player with a chance to win
      outs = [...winOuts];
    } else if (isHeadsUp) {
      outs = [...winOuts, ...chopOuts, ...dirtyOuts];
    } else if (isChopOnly) {
      outs = [...chopOuts];
    } else {
      outs = [...winOuts, ...chopOuts];
    }

    if (outs.length > 0) {
      results.push({
        player: p,
        outs,
        winOuts,
        chopOuts,
        dirtyOuts,
        isChopOnly,
        isHeadsUp,
      });
    }
  }

  return results;
}

export function isAllInSituation(hand, holeCards) {
  if (!hand || !hand.players || hand.phase === 'awarded') return false;
  const nf = hand.players.filter((p) => p.status !== 'folded');
  if (nf.length < 2) return false;
  const hasAllin = nf.some((p) => p.status === 'allin' || p.stack <= 0 || p.lastAction?.type === 'allin');
  if (!hasAllin) return false;
  const inAllin = isAllInShowdown(hand);
  if (!inAllin) return false;
  if (!holeCards) return false;
  return nf.every((p) => holeCards[p.id] && holeCardsComplete(hand, holeCards[p.id]));
}

export function isAllInShowdown(hand) {
  if (!hand || !hand.players || hand.phase === 'awarded') return false;
  const nf = hand.players.filter((p) => p.status !== 'folded');
  if (nf.length < 2) return false;
  const hasAllin = nf.some((p) => p.status === 'allin' || p.stack <= 0 || p.lastAction?.type === 'allin');
  if (!hasAllin) return false;
  return bettingFrozen(hand);
}

function best5Of(cards, shortDeck) {
  let best = null;
  let bestCards = null;
  const n = cards.length;
  const pick = (start, acc) => {
    if (acc.length === 5) {
      const sc = evaluate7(acc, shortDeck);
      if (!best || cmpScore(sc, best) > 0) { best = sc; bestCards = acc.slice(); }
      return;
    }
    for (let i = start; i < n; i++) { acc.push(cards[i]); pick(i + 1, acc); acc.pop(); }
  };
  pick(0, []);
  return bestCards;
}

function bestOmaha5(hole, board, shortDeck) {
  let best = null;
  let bestCards = null;
  for (let i = 0; i < hole.length; i++) {
    for (let j = i + 1; j < hole.length; j++) {
      for (let a = 0; a < board.length; a++) {
        for (let b = a + 1; b < board.length; b++) {
          for (let c = b + 1; c < board.length; c++) {
            const five = [hole[i], hole[j], board[a], board[b], board[c]];
            const sc = evaluate7(five, shortDeck);
            if (!best || cmpScore(sc, best) > 0) { best = sc; bestCards = five; }
          }
        }
      }
    }
  }
  return bestCards;
}

function evaluateLazyPineapple(hole, board, shortDeck) {
  const realBoard = (board || []).filter((c) => !c.hidden);
  if (realBoard.length < 3) return null;
  let best = null;
  const try5 = (cards) => { const sc = evaluate7(cards, shortDeck); if (!best || cmpScore(sc, best) > 0) best = sc; };
  const boardCombos = (k) => {
    const out = [];
    const pick = (start, acc) => {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < realBoard.length; i++) { acc.push(realBoard[i]); pick(i + 1, acc); acc.pop(); }
    };
    pick(0, []);
    return out;
  };
  if (realBoard.length >= 5) boardCombos(5).forEach((bc) => try5(bc));
  if (realBoard.length >= 4) {
    const bc4 = boardCombos(4);
    for (const hc of hole) for (const bc of bc4) try5([hc, ...bc]);
  }
  if (realBoard.length >= 3) {
    const bc3 = boardCombos(3);
    for (let i = 0; i < hole.length; i++) {
      for (let j = i + 1; j < hole.length; j++) {
        for (const bc of bc3) try5([hole[i], hole[j], ...bc]);
      }
    }
  }
  return best;
}

export function winningHandCards(hole, board, variant = 'nlh') {
  if (!hole || hole.length === 0) return null;
  const meta = variantMeta(variant);
  if (meta.group === 'low') return hole.slice(0, 5);
  const realBoard = (board || []).filter((c) => !c.hidden);
  if (realBoard.length < 5) return null;
  if (variant === 'lazy_pineapple') return bestLazyPineapple5(hole, realBoard, meta.deck === 'short');
  if (meta.group === 'omaha') return bestOmaha5(hole, realBoard, meta.deck === 'short');
  if (variant === 'deuces_wild') return best5OfDeucesWild([...hole, ...realBoard]);
  return best5Of([...hole, ...realBoard], meta.deck === 'short');
}

function bestLazyPineapple5(hole, board, shortDeck) {
  let best = null;
  let bestCards = null;
  const boardCombos = (k) => {
    const out = [];
    const pick = (start, acc) => {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < board.length; i++) { acc.push(board[i]); pick(i + 1, acc); acc.pop(); }
    };
    pick(0, []);
    return out;
  };
  const try5 = (cards) => { const sc = evaluate7(cards, shortDeck); if (!best || cmpScore(sc, best) > 0) { best = sc; bestCards = cards; } };
  if (board.length >= 5) boardCombos(5).forEach((bc) => try5(bc));
  if (board.length >= 4) {
    const bc4 = boardCombos(4);
    for (const hc of hole) for (const bc of bc4) try5([hc, ...bc]);
  }
  if (board.length >= 3) {
    const bc3 = boardCombos(3);
    for (let i = 0; i < hole.length; i++) for (let j = i + 1; j < hole.length; j++) for (const bc of bc3) try5([hole[i], hole[j], ...bc]);
  }
  return bestCards;
}

export function evaluateWinners(eligible, holeCards, board, variant = 'nlh', holeSize) {
  const meta = variantMeta(variant);
  const lowGame = meta.group === 'low';
  const realBoard = lowGame ? [] : (board ? board.filter((c) => !c.hidden) : []);
  const minBoard = (variant === 'three_two_one' || variant === 'ocean') ? 6 : 5;
  if (!lowGame && realBoard.length < minBoard) return null;
  const hs = holeSize || meta.holeSize;
  const accepts = (pid) => {
    const c = holeCards[pid];
    if (!c) return false;
    if (variant === 'lazy_pineapple' && c.length >= 2 && c.length <= 3) return true;
    return c.length === hs;
  };
  const scoreable = eligible.filter((pid) => accepts(pid));
  if (scoreable.length !== eligible.length) return null;
  const evalFn = variant === 'lazy_pineapple'
    ? (h) => evaluateLazyPineapple(h, realBoard, meta.deck === 'short')
    : meta.group === 'omaha'
    ? (h) => evaluateOmahaStyle(h, realBoard)
    : meta.group === 'low'
    ? (h) => evaluateLow([...h, ...realBoard], meta.lowKind === 'a5', meta.lowKind === '27')
    : variant === 'deuces_wild'
    ? (h) => evaluate7DeucesWild([...h, ...realBoard])
    : (h) => evaluate7([...h, ...realBoard], meta.deck === 'short');
  const scores = eligible.map((pid) => ({ pid, score: evalFn(holeCards[pid]) }));
  if (variant === 'second_best' && scores.length >= 2) {
    const sorted = [...scores].sort((a, b) => cmpScore(b.score, a.score));
    const bestScore = sorted[0].score;
    const secondBestObj = sorted.find((s) => cmpScore(s.score, bestScore) !== 0);
    const targetScore = secondBestObj ? secondBestObj.score : bestScore;
    return scores.filter((s) => cmpScore(s.score, targetScore) === 0).map((s) => s.pid);
  }
  let best = scores[0].score;
  for (const s of scores) {
    const c = cmpScore(s.score, best);
    if (meta.low ? c < 0 : c > 0) best = s.score;
  }
  return scores.filter((s) => cmpScore(s.score, best) === 0).map((s) => s.pid);
}

export function tryAutoWinners(hand, holeCards) {
  if (!hand) return null;
  const variant = hand.variant || 'nlh';
  const meta = variantMeta(variant);
  const holeSize = effectiveHoleSize(hand);
  const nonFolded = hand.players.filter((p) => p.status !== 'folded');
  if (nonFolded.length < 2) return null;
  if (['pineapple', 'crazy_pineapple', 'lazy_pineapple'].includes(variant) && hand.cpNeedsDiscard && !hand.cpDiscarded) return null;
  const lowGame = meta.group === 'low';
  const isTriple = (Number(hand.bombBoards) >= 3) || (hand.boardC && hand.boardC.length > 0) || (Number(hand.runTimes) >= 3);
  const isDouble = hand.doubleBoard || isTriple || (Number(hand.runTimes) >= 2);
  const targetLen = (variant === 'three_two_one' || variant === 'ocean') ? 6 : 5;
  if (!lowGame) {
    const boardComplete = (hand.communityCards || []).length >= targetLen && (hand.communityCards || []).every((c) => !c.hidden);
    if (!boardComplete) return null;
    if (isDouble) {
      const bComplete = (hand.boardB || []).length >= targetLen && (hand.boardB || []).every((c) => !c.hidden);
      if (!bComplete) return null;
    }
    if (isTriple) {
      const cComplete = (hand.boardC || []).length >= targetLen && (hand.boardC || []).every((c) => !c.hidden);
      if (!cComplete) return null;
    }
  }
  if (!nonFolded.every((p) => holeCardsComplete(hand, holeCards[p.id]))) return null;
  const pots = computePots(hand.players, bbaPotOpts(hand));
  const winnersA = {};
  let winnersB = isDouble ? {} : null;
  let winnersC = isTriple ? {} : null;
  for (let i = 0; i < pots.length; i++) {
    if (pots[i].eligible.length === 1) {
      winnersA[i] = [pots[i].eligible[0]];
      if (winnersB) winnersB[i] = [pots[i].eligible[0]];
      if (winnersC) winnersC[i] = [pots[i].eligible[0]];
      continue;
    }
    const wa = evaluateWinners(pots[i].eligible, holeCards, hand.communityCards, variant, holeSize);
    if (!wa) return null;
    winnersA[i] = wa;
    if (winnersB) {
      const wb = evaluateWinners(pots[i].eligible, holeCards, hand.boardB, variant, holeSize);
      if (!wb) return null;
      winnersB[i] = wb;
    }
    if (winnersC) {
      const wc = evaluateWinners(pots[i].eligible, holeCards, hand.boardC, variant, holeSize);
      if (!wc) return null;
      winnersC[i] = wc;
    }
  }
  let winnersLow = null;
  if (variant === 'plo8') {
    winnersLow = {};
    for (let i = 0; i < pots.length; i++) {
      const board = (hand.communityCards || []).filter((c) => !c.hidden);
      const scores = pots[i].eligible
        .map((pid) => ({ pid, sc: omahaLowScore(holeCards[pid], board) }))
        .filter((x) => x.sc);
      if (!scores.length) {
        winnersLow[i] = [];
        continue;
      }
      let bestLow = scores[0].sc;
      for (const x of scores) if (cmpScore(x.sc, bestLow) < 0) bestLow = x.sc;
      winnersLow[i] = scores.filter((x) => cmpScore(x.sc, bestLow) === 0).map((x) => x.pid);
    }
  }
  return { winnersA, winnersB, winnersC, winnersLow };
}

export function getMultipleBoardWinPercentages(hand, holeCards) {
  if (!hand) return null;
  const isTriple = (Number(hand.bombBoards) >= 3) || (hand.boardC && hand.boardC.length > 0) || (Number(hand.runTimes) >= 3);
  const isDouble = hand.doubleBoard || isTriple || (Number(hand.runTimes) >= 2);
  if (!isDouble) return null;

  const numBoards = isTriple ? 3 : 2;

  // 1. If hand.winners is already awarded:
  if (hand.winners && hand.winners.length > 0) {
    const boardShares = {};
    for (let potIdx = 0; potIdx < (hand.pots?.length || 1); potIdx++) {
      const potWinners = hand.winners.filter((w) => w.potIndex === potIdx);
      if (potWinners.length === 0) continue;
      const boardsPresent = [...new Set(potWinners.map((w) => w.board || 'a'))];
      boardsPresent.forEach((b) => {
        const bWinners = potWinners.filter((w) => (w.board || 'a') === b);
        const uniquePids = [...new Set(bWinners.map((w) => w.playerId))];
        uniquePids.forEach((pid) => {
          boardShares[pid] = (boardShares[pid] || 0) + (1 / uniquePids.length);
        });
      });
      break;
    }
    const result = {};
    (hand.players || []).forEach((p) => {
      const shares = boardShares[p.id] || 0;
      const pct = (shares / numBoards) * 100;
      result[p.id] = Math.round(pct);
    });
    return result;
  }

  // 2. If auto winners can be determined from complete boards:
  const auto = tryAutoWinners(hand, holeCards);
  if (auto && auto.winnersA) {
    const result = {};
    const wA = auto.winnersA[0] || [];
    const wB = auto.winnersB ? (auto.winnersB[0] || []) : [];
    const wC = auto.winnersC ? (auto.winnersC[0] || []) : [];

    (hand.players || []).forEach((p) => {
      let shares = 0;
      if (wA.includes(p.id)) shares += (1 / wA.length);
      if (wB.includes(p.id)) shares += (1 / wB.length);
      if (isTriple && wC.includes(p.id)) shares += (1 / wC.length);

      const pct = (shares / numBoards) * 100;
      result[p.id] = Math.round(pct);
    });
    return result;
  }

  return null;
}

const RANK_SHORT = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
const VAL_TO_RANK = (() => {
  const m = {};
  for (const [r, v] of Object.entries(RV)) m[v] = r;
  return m;
})();

function preflopLabel(cards) {
  if (!cards || cards.length === 0) return '';
  const counts = {};
  cards.forEach((c) => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => (b[1] - a[1]) || (RV[b[0]] - RV[a[0]]));
  const sh = (rc) => RANK_SHORT[rc];
  const shp = (rc) => RANK_SHORT[rc] + 's';
  if (entries[0][1] >= 4) return `Quad ${shp(entries[0][0])}`;
  if (entries[0][1] === 3) return `Trips ${shp(entries[0][0])}`;
  if (entries[0][1] === 2 && entries[1] && entries[1][1] === 2) return `${shp(entries[0][0])} and ${shp(entries[1][0])}`;
  if (entries[0][1] === 2) return `Pair of ${shp(entries[0][0])}`;
  const high = cards.slice().sort((a, b) => RV[b.rank] - RV[a.rank])[0];
  return `${sh(high.rank)}-high`;
}

function normCat(score, shortDeck) {
  const c = score[0];
  if (shortDeck) {
    if (c === 5) return 6;
    if (c === 6) return 5;
  }
  return c;
}

function labelFromScore(score, hole, bestCards, shortDeck) {
  const cat = normCat(score, shortDeck);
  const sh = (v) => RANK_SHORT[VAL_TO_RANK[v]];
  const shp = (v) => RANK_SHORT[VAL_TO_RANK[v]] + 's';
  const setOrTrips = (rankV) => {
    const rc = VAL_TO_RANK[rankV];
    const used = (bestCards || []).filter((c) => c.rank === rc && (hole || []).some((h) => h.rank === c.rank && h.suit === c.suit)).length;
    return used >= 2 ? 'Set' : 'Trips';
  };
  if (cat === 9) return 'Royal Flush';
  if (cat === 8.5) return `Five of a Kind (${shp(score[1])})`;
  switch (cat) {
    case 8: return score[1] === 14 ? 'Royal Flush' : `${sh(score[1])}-high SF`;
    case 7: return `Quad ${shp(score[1])}`;
    case 6: return `${shp(score[1])} full of ${shp(score[2])}`;
    case 5: return `${sh(score[1])}-high flush`;
    case 4: return `${sh(score[1])}-high straight`;
    case 3: return `${setOrTrips(score[1])} ${shp(score[1])}`;
    case 2: return `${shp(score[1])} and ${shp(score[2])}`;
    case 1: return `Pair of ${shp(score[1])}`;
    default: return `${sh(score[1])}-high`;
  }
}

function describeLowHand(hole, meta) {
  if (!hole || hole.length < 5) return '';
  const vals = hole.map((c) => (meta.lowKind === 'a5' ? (c.rank === 'A' ? 1 : RV[c.rank]) : RV[c.rank])).sort((a, b) => a - b);
  return vals.map((v) => (v === 1 ? 'A' : RANK_SHORT[VAL_TO_RANK[v]])).join('-');
}

export function describeHandShort(hole) {
  if (!hole || hole.length < 2) return '';
  const r = (c) => c.rank === 'T' ? '10' : c.rank;
  return `${r(hole[0])}${r(hole[1])}`;
}

export function describeHand(hole, board, variant = 'nlh') {
  const meta = variantMeta(variant);
  if (meta.group === 'low') return describeLowHand(hole, meta);
  const realBoard = (board || []).filter((c) => !c.hidden);
  const all = [...(hole || []), ...realBoard];
  if (all.length < 5) return preflopLabel(all);
  if (variant === 'lazy_pineapple') {
    if (realBoard.length < 3) return preflopLabel(hole);
    const best = bestLazyPineapple5(hole, realBoard, meta.deck === 'short');
    const score = evaluate7(best, meta.deck === 'short');
    return labelFromScore(score, hole, best, meta.deck === 'short');
  }
  if (meta.group === 'omaha') {
    if (realBoard.length < 3) return preflopLabel(hole);
    const best = bestOmaha5(hole, realBoard, meta.deck === 'short');
    const score = evaluate7(best, meta.deck === 'short');
    return labelFromScore(score, hole, best, meta.deck === 'short');
  }
  if (variant === 'deuces_wild') {
    const best = best5OfDeucesWild(all);
    const score = evaluate5DeucesWild(best);
    return labelFromScore(score, hole, best, false);
  }
  const best = best5Of([...(hole || []), ...realBoard], meta.deck === 'short');
  const score = evaluate7(best, meta.deck === 'short');
  return labelFromScore(score, hole, best, meta.deck === 'short');
}

export function evalPlayerHand(hole, board, variant = 'nlh') {
  if (!hole || !hole.length) return null;
  const meta = variantMeta(variant);
  const realBoard = (board || []).filter((c) => !c.hidden);
  if (variant === 'lazy_pineapple') {
    if (realBoard.length < 3) return evaluate7(hole, meta.deck === 'short');
    return evaluateLazyPineapple(hole, realBoard, meta.deck === 'short');
  }
  if (meta.group === 'omaha') {
    if (realBoard.length < 3) return evaluate7(hole, meta.deck === 'short');
    return evaluateOmahaStyle(hole, realBoard);
  }
  if (meta.group === 'low') {
    return evaluateLow([...hole, ...realBoard], meta.lowKind === 'a5', meta.lowKind === '27');
  }
  if (variant === 'deuces_wild') {
    return evaluate7DeucesWild([...hole, ...realBoard]);
  }
  return evaluate7([...hole, ...realBoard], meta.deck === 'short');
}

export function calcOuts(playersWithHoles, communityCards, variant = 'nlh') {
  const realBoard = (communityCards || []).filter((c) => !c.hidden);
  if (realBoard.length >= 5) return [];
  if (!playersWithHoles || playersWithHoles.length < 2) return [];

  const meta = variantMeta(variant);
  const isLow = !!meta.low;
  const deckRanks = meta.deck === 'short' ? ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] : RANKS;

  const used = new Set();
  playersWithHoles.forEach((p) => {
    (p.hole || []).forEach((c) => used.add(c.rank + c.suit));
  });
  realBoard.forEach((c) => used.add(c.rank + c.suit));

  const deck = [];
  for (const r of deckRanks) {
    for (const s of SUITS) {
      if (!used.has(r + s)) {
        deck.push({ rank: r, suit: s });
      }
    }
  }

  const currentScores = {};
  playersWithHoles.forEach((p) => {
    currentScores[p.id] = evalPlayerHand(p.hole, realBoard, variant);
  });

  let bestScore = null;
  playersWithHoles.forEach((p) => {
    const sc = currentScores[p.id];
    if (!sc) return;
    if (!bestScore) {
      bestScore = sc;
    } else {
      const cmp = cmpScore(sc, bestScore);
      if (isLow ? cmp < 0 : cmp > 0) {
        bestScore = sc;
      }
    }
  });

  const trailingPlayers = playersWithHoles.filter((p) => {
    const sc = currentScores[p.id];
    if (!sc || !bestScore) return false;
    return cmpScore(sc, bestScore) !== 0;
  });

  if (!trailingPlayers.length) return [];

  const RANK_ORDER = { A: 0, K: 1, Q: 2, J: 3, T: 4, '9': 5, '8': 6, '7': 7, '6': 8, '5': 9, '4': 10, '3': 11, '2': 12 };
  const SUIT_ORDER = { s: 0, h: 1, d: 2, c: 3 };

  const results = [];
  trailingPlayers.forEach((tp) => {
    const playerOuts = [];
    deck.forEach((card) => {
      const nextBoard = [...realBoard, card];
      const myScore = evalPlayerHand(tp.hole, nextBoard, variant);
      if (!myScore) return;

      let wins = true;
      for (const op of playersWithHoles) {
        if (op.id === tp.id) continue;
        const otherScore = evalPlayerHand(op.hole, nextBoard, variant);
        if (!otherScore) continue;
        const cmp = cmpScore(myScore, otherScore);
        if (isLow ? cmp >= 0 : cmp <= 0) {
          wins = false;
          break;
        }
      }

      if (wins) {
        playerOuts.push(card);
      }
    });

    playerOuts.sort((a, b) => {
      const rA = RANK_ORDER[a.rank] ?? 99;
      const rB = RANK_ORDER[b.rank] ?? 99;
      if (rA !== rB) return rA - rB;
      const sA = SUIT_ORDER[a.suit] ?? 99;
      const sB = SUIT_ORDER[b.suit] ?? 99;
      return sA - sB;
    });

    results.push({
      player: tp,
      outs: playerOuts,
      count: playerOuts.length,
    });
  });

  return results;
}

export function getLastActionPlayerName(hand) {
  if (!hand) return null;
  if (Array.isArray(hand.actionHistory) && hand.actionHistory.length > 0) {
    const streetActions = hand.actionHistory.filter((a) => a.street === hand.street);
    if (streetActions.length > 0) {
      return streetActions[streetActions.length - 1]?.player || null;
    }
    // If on preflop and no actionHistory entries on preflop yet, check blind posters
    if (hand.street === 'preflop' && Array.isArray(hand.players)) {
      const withAction = hand.players.filter((p) => p.lastAction);
      const straddleOrBB = [...withAction].reverse().find(
        (p) =>
          p.lastAction?.type === 'straddle' ||
          p.lastAction?.type === 'kill' ||
          p.lastAction?.type === 'bb' ||
          p.lastAction?.type === '4b' ||
          p.lastAction?.type === '3b' ||
          p.lastAction?.type === 'sb'
      );
      if (straddleOrBB) return straddleOrBB.name;
    }
    // If action is frozen, ended, or awarded, return the last overall action
    if (bettingFrozen(hand) || hand.phase === 'ended' || hand.phase === 'awarded' || hand.currentPlayer === -1) {
      return hand.actionHistory[hand.actionHistory.length - 1]?.player || null;
    }
    return null;
  }
  if (Array.isArray(hand.players) && hand.players.length > 0) {
    const playersWithAction = hand.players.filter((p) => p.lastAction);
    if (playersWithAction.length > 0) {
      const straddleOrBB = [...playersWithAction].reverse().find(
        (p) =>
          p.lastAction?.type === 'straddle' ||
          p.lastAction?.type === 'kill' ||
          p.lastAction?.type === 'bb' ||
          p.lastAction?.type === '4b' ||
          p.lastAction?.type === '3b' ||
          p.lastAction?.type === 'sb'
      );
      if (straddleOrBB) return straddleOrBB.name;
      return playersWithAction[playersWithAction.length - 1].name;
    }
  }
  return null;
}

