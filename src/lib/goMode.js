import { RANKS, SUITS, variantMeta, variantRanks } from '@/lib/poker';

export const ROUNDING_OPTIONS = [
  { label: 'Exact', value: 'exact' },
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '250', value: 250 },
  { label: '500', value: 500 },
  { label: '1K', value: 1000 },
  { label: '5K', value: 5000 },
  { label: '10K', value: 10000 },
  { label: '25K', value: 25000 },
];

export function isRoundingOptionDisabled(optionValue, smallBlind) {
  if (optionValue === 'exact') return false;
  const sb = Number(smallBlind) || 0;
  if (sb <= 0) return false;
  return Number(optionValue) < sb;
}

export function getDefaultStackRounding(lowestDenom) {
  const d = Number(lowestDenom) || 25;
  if (d <= 5) return 25;
  if (d <= 10) return 50;
  if (d <= 25) return 100;   // 4x 25 = 100
  if (d <= 50) return 250;   // 5x 50 = 250
  if (d <= 100) return 500;  // 5x 100 = 500
  if (d <= 250) return 1000; // 4x 250 = 1000
  if (d <= 500) return 2500; // 5x 500 = 2500
  if (d <= 1000) return 5000; // 5x 1000 = 5000
  if (d <= 5000) return 25000; // 5x 5000 = 25000
  return d * 5;
}

export function roundStack(amount, roundingStep) {
  if (roundingStep === 'exact' || !roundingStep) return amount;
  const step = Number(roundingStep);
  if (!step || isNaN(step) || step <= 0) return amount;
  return Math.max(0, Math.round(amount / step) * step);
}

const RANK_VALUE = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10, '10': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

const SUIT_VALUE = {
  's': 4, 'spades': 4, '♠': 4,
  'h': 3, 'hearts': 3, '♥': 3,
  'd': 2, 'diamonds': 2, '♦': 2,
  'c': 1, 'clubs': 1, '♣': 1,
};

/**
 * Sort hole cards so the bigger rank is on the left (first card higher rank, second lower rank).
 * If pocket pair, sort by suit hierarchy: Spades > Hearts > Diamonds > Clubs.
 * Handles both object cards ({ rank, suit }) and string notation ('As', 'Kd').
 */
export function sortGoHoleCards(cards) {
  if (!cards || !Array.isArray(cards)) return [];

  const parseItem = (c) => {
    if (!c) return { rank: '', suit: '' };
    if (typeof c === 'string') {
      const trimmed = c.trim();
      return { rank: trimmed.slice(0, -1), suit: trimmed.slice(-1) };
    }
    return { rank: c.rank || '', suit: c.suit || '' };
  };

  return [...cards].sort((rawA, rawB) => {
    if (!rawA || !rawB) return 0;
    const a = parseItem(rawA);
    const b = parseItem(rawB);
    const valA = RANK_VALUE[String(a.rank).toUpperCase()] || 0;
    const valB = RANK_VALUE[String(b.rank).toUpperCase()] || 0;
    if (valA !== valB) {
      return valB - valA; // Descending rank (higher card first)
    }
    const suitA = SUIT_VALUE[String(a.suit).toLowerCase()] || 0;
    const suitB = SUIT_VALUE[String(b.suit).toLowerCase()] || 0;
    return suitB - suitA; // Descending suit
  });
}

/**
 * Parse shorthand bet notation:
 * '5k' / '5K' -> 5000
 * '2.5m' / '2.5M' -> 2500000
 * '500' -> 500
 */
export function parseBetShorthand(input) {
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  if (!input) return 0;
  const cleaned = String(input).trim().toLowerCase();
  if (!cleaned) return 0;

  if (cleaned.endsWith('k')) {
    const num = parseFloat(cleaned.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }
  if (cleaned.endsWith('m')) {
    const num = parseFloat(cleaned.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num * 1000000);
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Adjust bet amount by step size for up/down arrow buttons.
 */
export function stepBetAmount(currentValStr, direction, stepSize, minBet = 0, maxBet = 0) {
  const curr = Math.max(0, parseBetShorthand(currentValStr));
  const step = Math.max(1, Math.round(Number(stepSize) || 1));
  let next;

  if (direction > 0) {
    const remainder = curr % step;
    if (remainder !== 0) {
      next = Math.ceil(curr / step) * step;
    } else {
      next = curr + step;
    }
  } else {
    const remainder = curr % step;
    if (remainder !== 0) {
      next = Math.floor(curr / step) * step;
    } else {
      next = curr - step;
    }
  }

  const boundedMin = Math.max(0, minBet || 0);
  const boundedMax = maxBet > 0 ? maxBet : Number.MAX_SAFE_INTEGER;
  return Math.max(boundedMin, Math.min(boundedMax, next));
}

export function generateGoDeck(variant = 'nlh') {
  const ranks = variant === 'short_deck' ? variantRanks(variant) : RANKS;
  const deck = [];
  SUITS.forEach((s) => {
    ranks.forEach((r) => {
      deck.push({ rank: r, suit: s });
    });
  });
  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Hole cards dealt in GO mode: pineapple games are dealt three and discard one later.
export function goHoleSize(hand) {
  const variant = (typeof hand === 'string' ? hand : hand?.variant) || 'nlh';
  if (variant === 'pineapple' || variant === 'crazy_pineapple') return 3;
  if (variant === 'lazy_pineapple') return (typeof hand === 'string' ? 'preflop' : hand?.street) === 'river' ? 2 : 3;
  return variantMeta(variant).holeSize;
}

export function dealGoHoleCards(players, holeSize = 2, existingCommunity = [], variant = 'nlh') {
  const deck = generateGoDeck(variant);
  const used = new Set();

  existingCommunity.forEach((c) => {
    if (c && !c.hidden) {
      used.add(c.rank + c.suit);
    }
  });

  const availableDeck = deck.filter((c) => !used.has(c.rank + c.suit));
  const result = {};

  (players || []).forEach((p) => {
    if (p.status === 'eliminated' || p.status === 'out') return;
    const cards = [];
    for (let k = 0; k < holeSize; k++) {
      if (availableDeck.length > 0) {
        cards.push(availableDeck.pop());
      }
    }
    result[p.id] = cards;
  });

  return result;
}

export function getLowestDenomination(hand) {
  if (!hand) return 25;

  if (Array.isArray(hand.chipDenominations) && hand.chipDenominations.length > 0) {
    const valid = hand.chipDenominations.map(Number).filter((d) => d > 0);
    if (valid.length > 0) return Math.min(...valid);
  }

  if (Array.isArray(hand.blindSchedule) && hand.blindSchedule.length > 0) {
    const firstLevel = hand.blindSchedule[0];
    const firstSB = Number(firstLevel?.smallBlind);
    if (firstSB > 0) return firstSB;
  }

  const sb = Number(hand.smallBlind);
  if (sb > 0) return sb;

  return 25;
}

/**
 * Auto-fill hidden community cards from the deck in GO Mode.
 */
export function fillGoCommunityCards(hand, goHoleCards = {}) {
  if (!hand || !hand.communityCards || !hand.communityCards.some((c) => c && c.hidden)) {
    return hand;
  }
  const deck = generateGoDeck(hand?.variant);
  const used = new Set();

  Object.values(goHoleCards).forEach((cards) => {
    if (Array.isArray(cards)) {
      cards.forEach((c) => {
        if (c && c.rank && c.suit) used.add(c.rank + c.suit);
      });
    }
  });

  (hand.communityCards || []).forEach((c) => {
    if (c && !c.hidden && c.rank && c.suit) {
      used.add(c.rank + c.suit);
    }
  });

  const availableDeck = deck.filter((c) => !used.has(c.rank + c.suit));
  const newCommunity = hand.communityCards.map((c) => {
    if (c && c.hidden && availableDeck.length > 0) {
      return availableDeck.pop();
    }
    return c;
  });

  return {
    ...hand,
    communityCards: newCommunity,
  };
}

/**
 * Run out remaining community cards up to 5 when betting is frozen (all-in) in GO Mode.
 */
export function runOutGoBoardIfFrozen(hand, goHoleCards = {}) {
  if (!hand) return hand;
  const nonFolded = (hand.players || []).filter((p) => p.status !== 'folded');
  if (nonFolded.length <= 1) return hand;

  const deck = generateGoDeck(hand?.variant);
  const used = new Set();

  Object.values(goHoleCards).forEach((cards) => {
    if (Array.isArray(cards)) {
      cards.forEach((c) => {
        if (c && c.rank && c.suit) used.add(c.rank + c.suit);
      });
    }
  });

  (hand.communityCards || []).forEach((c) => {
    if (c && !c.hidden && c.rank && c.suit) {
      used.add(c.rank + c.suit);
    }
  });

  const availableDeck = deck.filter((c) => !used.has(c.rank + c.suit));

  const newCommunity = (hand.communityCards || []).map((c) => {
    if (c && c.hidden && availableDeck.length > 0) {
      return availableDeck.pop();
    }
    return c;
  });

  const isOcean = hand.variant === 'ocean';
  const is321 = hand.variant === 'three_two_one';
  const targetLen = (isOcean || is321) ? 6 : 5;

  while (newCommunity.length < targetLen && availableDeck.length > 0) {
    newCommunity.push(availableDeck.pop());
  }

  return {
    ...hand,
    communityCards: newCommunity,
    street: isOcean ? 'ocean' : 'river',
    phase: 'ended',
    currentPlayer: -1,
  };
}

/**
 * Deal the next community street card(s) in GO Mode:
 * - Preflop (0 cards): deals 3 cards (Flop)
 * - Flop (3 cards): deals 1 card (Turn) or 2 for 3-2-1
 * - Turn (4 cards, or 5 for 3-2-1): deals 1 card (River)
 * - River (5 cards, Ocean only): deals 1 card (Ocean)
 */
export function dealNextGoStreet(hand, goHoleCards = {}) {
  if (!hand) return hand;
  const deck = generateGoDeck(hand?.variant);
  const used = new Set();

  Object.values(goHoleCards).forEach((cards) => {
    if (Array.isArray(cards)) {
      cards.forEach((c) => {
        if (c && c.rank && c.suit) used.add(c.rank + c.suit);
      });
    }
  });

  (hand.communityCards || []).forEach((c) => {
    if (c && !c.hidden && c.rank && c.suit) {
      used.add(c.rank + c.suit);
    }
  });

  const availableDeck = deck.filter((c) => !used.has(c.rank + c.suit));
  const currentCards = (hand.communityCards || []).filter((c) => c && !c.hidden);
  let nextStreet = hand.street || 'preflop';
  const newCards = [...currentCards];
  const isOcean = hand.variant === 'ocean';
  const is321 = hand.variant === 'three_two_one';
  const targetLen = (isOcean || is321) ? 6 : 5;

  if (currentCards.length < 3) {
    while (newCards.length < 3 && availableDeck.length > 0) {
      newCards.push(availableDeck.pop());
    }
    nextStreet = 'flop';
  } else if (currentCards.length === 3) {
    const turnCount = is321 ? 2 : 1;
    for (let i = 0; i < turnCount; i++) {
      if (availableDeck.length > 0) newCards.push(availableDeck.pop());
    }
    nextStreet = 'turn';
  } else if (currentCards.length === 4 || (is321 && currentCards.length === 5)) {
    if (availableDeck.length > 0) newCards.push(availableDeck.pop());
    nextStreet = 'river';
  } else if (isOcean && currentCards.length === 5) {
    if (availableDeck.length > 0) newCards.push(availableDeck.pop());
    nextStreet = 'ocean';
  }

  const isDone = newCards.length >= targetLen;

  return {
    ...hand,
    communityCards: newCards,
    street: nextStreet,
    phase: isDone ? 'ended' : hand.phase,
    currentPlayer: -1,
  };
}

