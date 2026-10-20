// Pure poker engine helpers for the action tracker.
import { minChipInPlay, isMakeableBet } from './chipMath';

export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
export const SUITS = ['s','h','d','c'];
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_RED = { s: false, h: true, d: true, c: false };

export const POS = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
  10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO'],
};

export const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];
export const STREET_LABEL = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

export const VARIANTS = {
  nlh: { label: "Hold'em", group: 'holdem', holeSize: 2, deck: 'full' },
  plo: { label: 'Omaha', group: 'omaha', holeSize: 4, deck: 'full' },
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
  ace_to_five: { label: 'A-5 Lowball', group: 'low', holeSize: 5, deck: 'full', low: true, lowKind: 'a5' },
  deuce_to_seven: { label: '2-7 Lowball', group: 'low', holeSize: 5, deck: 'full', low: true, lowKind: '27' },
};

export const GAME_TYPES = { nl: 'No Limit', pl: 'Pot Limit', fl: 'Fixed Limit' };

export function variantMeta(v) {
  if (v === 'holdem') return VARIANTS.nlh;
  return VARIANTS[v] || VARIANTS.nlh;
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

export function formatBlinds(hand) {
  if (!hand) return '';
  const cur = hand.currency || '';
  const sb = money(hand.smallBlind, cur);
  const bb = money(hand.bigBlind, cur);
  if (hand.anteType === 'bba') {
    const bbaAmt = hand.anteAmount || hand.bigBlind;
    const bba = money(bbaAmt, cur);
    return `${sb} / ${bb} - ${bba} (BBA)`;
  }
  if (hand.anteType === 'traditional' && (parseAmount(hand.anteAmount) ?? Number(hand.anteAmount)) > 0) {
    const ante = money(hand.anteAmount, cur);
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

export function formatKM(val) {
  if (val == null || val === '') return '';
  const n = typeof val === 'number' ? val : (parseAmount(val) ?? Number(val));
  if (isNaN(n) || !isFinite(n)) return String(val);
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (absN >= 1000000) {
    const m = absN / 1000000;
    const maxDec = absN < 10000000 ? 1 : 2;
    const mStr = m % 1 === 0 ? m.toFixed(0) : m.toFixed(maxDec).replace(/\.?0+$/, '');
    return `${sign}${mStr}M`;
  }
  if (absN >= 1000) {
    const k = absN / 1000;
    const kStr = k % 1 === 0 ? k.toFixed(0) : k.toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${kStr}K`;
  }
  return `${sign}${absN}`;
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

export function formatPlayerTagAmount(val, currency = '', hand = null) {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (!isFinite(n)) return '';
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const sym = currency || '';

  // Regardless of smallest chip:
  // <100K: full number
  if (absN < 100000) {
    const hasDec = !Number.isInteger(absN);
    const numStr = absN.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: hasDec ? 2 : 0,
    });
    return `${sign}${sym}${numStr}`;
  }

  // 100K-999,999: use K, no decimal digits, do round
  if (absN >= 100000 && absN < 1000000) {
    return `${sign}${sym}${Math.round(absN / 1000)}K`;
  }

  // 100M-999,999,999 (and 1B+): use M, no decimal digits, do round
  if (absN >= 100000000) {
    return `${sign}${sym}${Math.round(absN / 1000000)}M`;
  }

  const smallestChip = getSmallestChip(hand);

  // Small chip 100K+:
  // below 1M use K, no decimal digits
  // 1M+ use M, no decimal digits
  if (smallestChip >= 100000) {
    if (absN >= 1000000) {
      return `${sign}${sym}${Math.round(absN / 1000000)}M`;
    }
    return `${sign}${sym}${Math.round(absN / 1000)}K`;
  }

  // Small chip 10K or 25K:
  // below 1M use K, no decimal digits
  // 1M-<100M use M, up to 1 decimal digit
  if (smallestChip === 10000 || smallestChip === 25000) {
    if (absN >= 1000000) {
      const mStr = formatNumberTrimmed(absN / 1000000, 1);
      return `${sign}${sym}${mStr}M`;
    }
    return `${sign}${sym}${Math.round(absN / 1000)}K`;
  }

  // Small chip 1K, 5K:
  // below 100K use K, no decimal digits
  // 1M-<100M - use M, up to 1 decimal digit
  if (smallestChip === 1000 || smallestChip === 5000) {
    if (absN >= 1000000) {
      const mStr = formatNumberTrimmed(absN / 1000000, 1);
      return `${sign}${sym}${mStr}M`;
    }
    return `${sign}${sym}${Math.round(absN / 1000)}K`;
  }

  // Smallest chip within 25-500 (or below 25):
  // below 100K - use K, 1 decimal digit (eg 83,600 -> 83.6K)
  // 1M-<100M - use M, up to 1 decimal digit
  if (absN >= 1000000) {
    const mStr = formatNumberTrimmed(absN / 1000000, 1);
    return `${sign}${sym}${mStr}M`;
  }
  const kStr = formatNumberTrimmed(absN / 1000, 1);
  return `${sign}${sym}${kStr}K`;
}

export function formatSidePotAmount(amt, currency = '') {
  if (amt == null || amt === '') return '';
  const n = Number(amt);
  if (!isFinite(n)) return '';
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const sym = currency || '';

  // Show full number if under 10,000
  if (absN < 10000) {
    return `${sign}${sym}${absN.toLocaleString('en-US')}`;
  }

  // Only if between 10K-100K and 1M-100M should 1 decimal digit be used
  if (absN >= 10000 && absN < 100000) {
    const kStr = formatNumberTrimmed(absN / 1000, 1);
    return `${sign}${sym}${kStr}K`;
  }
  if (absN >= 1000000 && absN < 100000000) {
    const mStr = formatNumberTrimmed(absN / 1000000, 1);
    return `${sign}${sym}${mStr}M`;
  }

  // Otherwise show 0 decimal digits (100K-999,999, and >= 100M)
  if (absN >= 100000000) {
    return `${sign}${sym}${Math.round(absN / 1000000)}M`;
  }
  return `${sign}${sym}${Math.round(absN / 1000)}K`;
}

export function formatBetAmount(val, currency = '') {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (!isFinite(n)) return '';
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const sym = currency || '';

  if (absN < 1000) {
    const hasDec = !Number.isInteger(absN);
    const numStr = absN.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: hasDec ? 2 : 0,
    });
    return `${sign}${sym}${numStr}`;
  }

  if (absN >= 1000000) {
    const intPart = Math.floor(absN / 1000000);
    const rem = Math.floor(absN % 1000000);
    if (rem === 0) {
      return `${sign}${sym}${intPart}M`;
    }
    const remStr = String(rem).padStart(6, '0').replace(/0+$/, '');
    return `${sign}${sym}${intPart}.${remStr}M`;
  }

  const intPart = Math.floor(absN / 1000);
  const rem = Math.floor(absN % 1000);
  if (rem === 0) {
    return `${sign}${sym}${intPart}K`;
  }
  const remStr = String(rem).padStart(3, '0').replace(/0+$/, '');
  return `${sign}${sym}${intPart}.${remStr}K`;
}

export function positionForSeat(n, buttonIndex, seatOrderIndex) {
  const labels = POS[n] || POS[10];
  const offset = (seatOrderIndex - buttonIndex + n) % n;
  let label = labels[offset];
  if (n === 2 && label === 'BTN') label = 'D/SB';
  return label;
}

export function effectiveHoleSize(hand) {
  const variant = hand.variant || 'nlh';
  const meta = variantMeta(variant);
  if (variant === 'pineapple') return 2;
  if (variant === 'lazy_pineapple') return hand.street === 'river' ? 2 : 3;
  if (variant === 'crazy_pineapple') return hand.cpDiscarded ? 2 : (hand.cpNeedsDiscard ? 3 : 2);
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
  return { cards: sortHoleCards(cards) };
}

export function clone(h) {
  return JSON.parse(JSON.stringify(h));
}

export function getButtonIndex(h) {
  return h.players.findIndex((p) => p.seat === h.buttonSeat);
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
      return (p.currentBet || 0) >= h.currentBet && p.hasActed;
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

export function raiseLabel(level) {
  if (!level || level <= 1) return 'Bet';
  if (level === 2) return 'Raise';
  return `${level}-bet`;
}

export function actionLabel(la) {
  if (!la) return '';
  if (la.type === 'fold') return 'Fold';
  if (la.type === 'check') return 'Check';
  if (la.type === 'call') return 'Call';
  if (la.type === 'allin') return 'All-in';
  if (la.type === 'sb') return 'SB';
  if (la.type === 'bb') return 'BB';
  if (la.type === 'straddle') return 'Straddle';
  if (la.type === 'kill') return 'Kill';
  if (la.type === 'bet' || la.type === 'raise') return raiseLabel(la.raiseLevel);
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
    status: 'active',
    lastAction: null,
    hasActed: false,
    reentries: p.reentries || 0,
    timeBanks: p.timeBanks != null ? p.timeBanks : (config.clockConfig?.initialTimeBanks ?? 3),
    usedBanks: p.usedBanks || 0,
  }));
  const n = players.length;
  const buttonIndex = players.findIndex((p) => p.seat === buttonSeat);
  const sbIndex = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
  const bba = config.anteType === 'bba';
  const ante = bba ? config.bigBlind : (config.anteAmount || 0);
  const variant = config.variant || 'holdem';
  const bombPot = !!config.bombPot && (config.mode === 'cash');
  const bombAmount = Number(config.bombAmount) || config.bigBlind;
  const wasKill = !!config.killActive && config.killSeat != null;

  const common = {
    players,
    buttonSeat,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    anteType: config.anteType,
    anteAmount: bba ? config.bigBlind : (config.anteAmount || 0),
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
    bombPot,
    bombAmount,
    bombBoards: Number(config.bombBoards) || (config.doubleBoard ? 2 : 1),
    sideGames: config.sideGames || {},
    wonPots: config.wonPots || [],
    lastWinnerSeat: config.lastWinnerSeat ?? null,
    consecWins: config.consecWins || 0,
    killActive: false,
    killSeat: null,
    killType: config.killType || 'kill',
    killIdx: -1,
    killDeferred: false,
    gameType: config.gameType || 'nl',
    doubleBoard: !!config.doubleBoard || (Number(config.bombBoards) >= 2),
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
    allowAddOn: config.allowAddOn,
    addOnPrice: config.addOnPrice,
    addOnChips: config.addOnChips,
    eliminatedPlayers: config.eliminatedPlayers || [],
    clockConfig: config.clockConfig || { clockSystem: 'call_clock', callClockSeconds: 60 },
    shotClockEnabled: config.shotClockEnabled !== undefined ? config.shotClockEnabled : true,
  };

  if (config.inBreak && config.mode === 'tournament') {
    return {
      ...common,
      street: 'preflop',
      currentBet: 0,
      lastRaiseAmount: config.bigBlind,
      communityCards: [],
      currentPlayer: -1,
      message: 'Break in progress – resume play to post blinds and start the hand',
      raiseLevel: 0,
      allowStraddle: !!config.allowStraddle,
      allowMultiStraddle: !!config.allowMultiStraddle,
      mandatoryStraddle: !!config.mandatoryStraddle,
      maxStraddles: (config.allowStraddle || config.mandatoryStraddle) ? (config.allowMultiStraddle ? 99 : 1) : 0,
      straddleLevel: 0,
      straddleOpen: !!config.allowStraddle || !!config.mandatoryStraddle,
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
    });
    players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });
    const bCount = Number(config.bombBoards) || (common.doubleBoard ? 2 : 1);
    return {
      ...common,
      street: 'flop',
      currentBet: 0,
      lastRaiseAmount: config.bigBlind,
      raiseLevel: 0,
      communityCards: [{ hidden: true }, { hidden: true }, { hidden: true }],
      boardB: bCount >= 2 ? [{ hidden: true }, { hidden: true }, { hidden: true }] : [],
      boardC: bCount >= 3 ? [{ hidden: true }, { hidden: true }, { hidden: true }] : [],
      doubleBoard: bCount >= 2,
      bombBoards: bCount,
      currentPlayer: firstActiveAfter(players, buttonIndex),
      message: `Bomb pot (${bCount} board${bCount > 1 ? 's' : ''}) – flop is out, no preflop action`,
      allowStraddle: false,
      allowMultiStraddle: false,
      mandatoryStraddle: false,
      mandatoryDoubleStraddle: false,
      maxStraddles: 0,
      straddleLevel: 0,
      straddleOpen: false,
    };
  }

  if (config.anteType === 'traditional' && ante > 0) {
    players.forEach((p) => {
      const a = Math.min(ante, p.stack);
      p.stack -= a;
      p.totalBet += a;
    });
  }

  const sb = Math.min(config.smallBlind, players[sbIndex].stack);
  players[sbIndex].stack -= sb;
  players[sbIndex].currentBet = sb;
  players[sbIndex].totalBet += sb;
  players[sbIndex].lastAction = { type: 'sb', amount: sb };

  const bb = Math.min(config.bigBlind, players[bbIndex].stack);
  players[bbIndex].stack -= bb;
  players[bbIndex].currentBet = bb;
  players[bbIndex].totalBet += bb;
  players[bbIndex].lastAction = { type: 'bb', amount: bb };

  if (bba && ante > 0) {
    const a = Math.min(ante, players[bbIndex].stack);
    players[bbIndex].stack -= a;
    players[bbIndex].totalBet += a;
  }

  const allowStraddle = !!config.allowStraddle;
  const allowMulti = !!config.allowMultiStraddle;
  const mandatoryStraddle = !!config.mandatoryStraddle;
  const straddleEnabled = allowStraddle || mandatoryStraddle;
  const maxStraddles = straddleEnabled ? (allowMulti ? 99 : 1) : 0;
  let straddleLevel = 0;
  let straddleOpen = straddleEnabled;

  let currentBet = bb;
  let lastRaiseAmount = config.bigBlind;
  let raiseLevel = 1;
  let first = firstActiveAfter(players, bbIndex);

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
      raiseLevel = 2;
      first = firstActiveAfter(players, sidx);
      if (players[sidx].stack === 0) {
        players[sidx].status = 'allin';
        players[sidx].lastAction = { type: 'allin', amount: a, raiseLevel: 2 };
      } else {
        players[sidx].lastAction = { type: 'straddle', amount: a, raiseLevel: 2 };
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
          raiseLevel = 3;
          first = firstActiveAfter(players, dsidx);
          if (players[dsidx].stack === 0) {
            players[dsidx].status = 'allin';
            players[dsidx].lastAction = { type: 'allin', amount: da, raiseLevel: 3 };
          } else {
            players[dsidx].lastAction = { type: 'straddle', amount: da, raiseLevel: 3 };
          }
        }
      }
    }
  }

  players.forEach((p) => {
    if (p.stack === 0) p.status = 'allin';
  });

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
    applyOversizedCap(h);
  } else if (type === 'check') {
    p.lastAction = { type: 'check' };
    p.hasActed = true;
  } else if (type === 'call') {
    const pay = Math.min(toCall, p.stack);
    p.stack -= pay;
    p.currentBet += pay;
    p.totalBet += pay;
    const isShortAllinCall = p.stack === 0 && p.currentBet < h.currentBet;
    p.lastAction = { type: isShortAllinCall ? 'allin' : 'call', amount: p.currentBet, raiseLevel: h.raiseLevel || 1 };
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
    const prevLastRaise = h.lastRaiseAmount || h.bigBlind;
    const isShortRaise = wentAllin && increased && (p.currentBet - prevBet) < prevLastRaise;
    let level = h.raiseLevel;
    if (increased) {
      h.raiseLevel = isRaise ? (h.raiseLevel || 1) + 1 : 1;
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
    const isSoleDeepest = hasSoleDeepestStack(h, p.id);
    if (wentAllin && !isSoleDeepest) {
      p.lastAction = { type: 'allin', amount: p.currentBet, raiseLevel: level };
      p.status = 'allin';
    } else {
      const actionType = isRaise ? 'raise' : 'bet';
      p.lastAction = { type: actionType, amount: p.currentBet, raiseLevel: level };
      if (wentAllin) p.status = 'allin';
    }
    p.hasActed = true;
    applyOversizedCap(h);
    const postNonFoldedOthers = h.players.filter((o) => o.id !== p.id && o.status !== 'folded');
    const postOtherMaxBet = postNonFoldedOthers.length > 0 ? Math.max(...postNonFoldedOthers.map((o) => o.currentBet)) : 0;
    if (p.currentBet <= postOtherMaxBet || p._wasCapped) {
      p.lastAction = { type: 'call', amount: p.currentBet, raiseLevel: h.raiseLevel || 1 };
    }
  } else if (type === 'allin') {
    const pay = p.stack;
    const prevBet = h.currentBet;
    const prevLastRaise = h.lastRaiseAmount || h.bigBlind;
    p.stack = 0;
    p.currentBet += pay;
    p.totalBet += pay;
    const oldBet = p.currentBet - pay;
    const newBet = p.currentBet;
    const increased = newBet > prevBet;
    const isShortRaise = increased && (newBet - prevBet) < prevLastRaise;
    const isCoveredCall = newBet <= prevBet;
    let level = h.raiseLevel;
    let wasCapped = false;
    if (increased && !isCoveredCall) {
      h.raiseLevel = (prevBet > 0 || h.street === 'preflop') ? (h.raiseLevel || 1) + 1 : 1;
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
    const isSoleDeepest = hasSoleDeepestStack(h, p.id);
    if (isCoveredCall) {
      p.lastAction = { type: 'allin', amount: newBet, raiseLevel: level };
    } else if (isSoleDeepest) {
      const isRaise = prevBet > 0 || h.street === 'preflop';
      p.lastAction = { type: isRaise ? 'raise' : 'bet', amount: newBet, raiseLevel: level };
    } else {
      p.lastAction = { type: 'allin', amount: newBet, raiseLevel: level };
    }
    p.hasActed = true;
    p.status = 'allin';
    applyOversizedCap(h);

    if (p.stack > 0 && !isCoveredCall) {
      wasCapped = true;
      p._wasCapped = true;
      p._allInCapped = true;
      p.status = 'active';
      const cappedBet = p.currentBet;
      const wasJustCalling = cappedBet <= prevBet;
      if (wasJustCalling) {
        p.lastAction = { type: 'call', amount: cappedBet - oldBet, raiseLevel: h.raiseLevel };
      } else {
        const isRaise = prevBet > 0 || h.street === 'preflop';
        p.lastAction = {
          type: isRaise ? 'raise' : 'bet',
          amount: cappedBet,
          raiseLevel: h.raiseLevel,
        };
      }
    } else if (isCoveredCall && p.stack === 0) {
      p.lastAction = { type: 'allin', amount: newBet, raiseLevel: level };
    }

    if (wasCapped) {
      h._pendingCappedAction = true;
    }
  } else if (type === 'straddle') {
    const newLevel = (h.straddleLevel || 0) + 1;
    let target = targetAmount != null && targetAmount > 0
      ? Number(targetAmount)
      : (newLevel === 1 && h.straddleAmount ? Number(h.straddleAmount) : (h.bigBlind * Math.pow(2, newLevel)));
    const pay = Math.min(target - p.currentBet, p.stack);
    p.stack -= pay;
    p.currentBet += pay;
    p.totalBet += pay;
    h.straddleLevel = newLevel;
    h.raiseLevel = newLevel + 1;
    h.lastRaiseAmount = Math.max(p.currentBet - h.currentBet, h.bigBlind);
    h.currentBet = p.currentBet;
    if (p.stack === 0) {
      p.status = 'allin';
      p.lastAction = { type: 'allin', amount: p.currentBet, raiseLevel: h.raiseLevel };
    } else {
      p.lastAction = { type: 'straddle', amount: p.currentBet, raiseLevel: h.raiseLevel };
    }
    h.players.forEach((o) => {
      if (o.id !== p.id && o.status === 'active') o.hasActed = false;
    });
  }

  const potAfter = potTotal(h);
  const chips = p.lastAction && (p.lastAction.type === 'fold' || p.lastAction.type === 'check')
    ? 0
    : (p.lastAction && p.lastAction.amount) || 0;

  h.actionHistory.push({
    street: h.street,
    player: p.name,
    action: actionLabel(p.lastAction),
    chips,
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
    if (h.street === 'river') {
      h.phase = 'ended';
    } else {
      const next = { preflop: 'flop', flop: 'turn', turn: 'river' }[h.street];
      const frozen = bettingFrozen(h);
      if (!frozen) {
        const lowGame = variantMeta(h.variant).group === 'low';
        if (!lowGame) {
          const expected = next === 'flop' ? 3 : 1;
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
        h.lastRaiseAmount = h.bigBlind;
        h.raiseLevel = 0;
        h.straddleOpen = false;
        h.killDeferred = false;
        h.shortAllinOpen = false;
        h.ootActions = [];
        h.passiveBound = {};
        h.street = next;
        h.message = `Dealt the ${next.toUpperCase()}`;
        h.currentPlayer = firstActiveAfter(h.players, getButtonIndex(h));
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
  const next = { preflop: 'flop', flop: 'turn', turn: 'river' }[hand.street];
  if (!next) return { error: 'No more streets to deal.' };
  const expected = next === 'flop' ? 3 : 1;
  const totalExpected = hand.doubleBoard ? expected * 2 : expected;
  const h = clone(hand);
  if (hidden) {
    for (let i = 0; i < expected; i++) h.communityCards.push({ hidden: true });
    if (h.doubleBoard) for (let i = 0; i < expected; i++) h.boardB.push({ hidden: true });
  } else {
    if (cards.length !== totalExpected) {
      return { error: `Deal exactly ${totalExpected} card(s) for the ${next.toUpperCase()}.` };
    }
    h.communityCards.push(...cards.slice(0, expected));
    if (h.doubleBoard) h.boardB.push(...cards.slice(expected));
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
  h.lastRaiseAmount = h.bigBlind;
  h.raiseLevel = 0;
  h.straddleOpen = false;
  h.killDeferred = false;
  h.shortAllinOpen = false;
  h.ootActions = [];
  h.passiveBound = {};
  h.street = next;
  h.message = null;
  h.currentPlayer = firstActiveAfter(h.players, getButtonIndex(h));
  if (bettingFrozen(h)) {
    h.currentPlayer = -1;
    if (h.street === 'river') {
      h.phase = 'ended';
      h.message = 'Hand complete – award the pots to finish.';
    } else {
      const nextStreet = { flop: 'turn', turn: 'river' }[h.street];
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
  const hiddenA = hand.communityCards.filter((c) => c.hidden).length;
  const hiddenB = hand.doubleBoard ? (hand.boardB || []).filter((c) => c.hidden).length : 0;
  const total = hiddenA + hiddenB;
  if (total === 0) return { error: 'No hidden board cards to enter.' };
  if (cards.length !== total) return { error: `Enter ${total} card(s) for the board.` };
  const h = clone(hand);
  let ci = 0;
  h.communityCards = h.communityCards.map((c) => (c.hidden ? cards[ci++] : c));
  if (h.doubleBoard) h.boardB = h.boardB.map((c) => (c.hidden ? cards[ci++] : c));
  return { hand: h };
}

export function postBlinds(hand) {
  if (!hand || hand.blindsPosted) return hand;
  const h = clone(hand);
  const n = h.players.length;
  const buttonIndex = h.players.findIndex((p) => p.seat === h.buttonSeat);
  if (buttonIndex === -1) return h;
  const sbIndex = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
  const bba = h.anteType === 'bba';
  const ante = bba ? h.bigBlind : (h.anteAmount || 0);

  if (h.anteType === 'traditional' && ante > 0) {
    h.players.forEach((p) => {
      const a = Math.min(ante, p.stack);
      p.stack -= a;
      p.totalBet += a;
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

  if (bba && ante > 0) {
    const a = Math.min(ante, h.players[bbIndex].stack);
    h.players[bbIndex].stack -= a;
    h.players[bbIndex].totalBet += a;
  }

  h.players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });
  h.currentBet = bb;
  h.lastRaiseAmount = h.bigBlind;
  h.raiseLevel = 1;
  h.currentPlayer = firstActiveAfter(h.players, bbIndex);
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
  if (h.street !== 'preflop') return h;
  if (h.bombPot) return h;
  const sb = newSmallBlind;
  const bb = newBigBlind;
  const bba = h.anteType === 'bba';
  const ante = bba ? bb : (newAnte || 0);
  const n = h.players.length;
  const buttonIndex = h.players.findIndex((p) => p.seat === h.buttonSeat);
  const sbIndex = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;

  h.players.forEach((p) => {
    p.stack = p.initialStack;
    p.currentBet = 0;
    p.totalBet = 0;
    p.lastAction = null;
    p.hasActed = false;
    p.status = 'active';
    p._wasCapped = false;
  });

  if (h.anteType === 'traditional' && ante > 0) {
    h.players.forEach((p) => {
      const a = Math.min(ante, p.stack);
      p.stack -= a;
      p.totalBet += a;
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

  if (bba && ante > 0) {
    const a = Math.min(ante, h.players[bbIndex].stack);
    h.players[bbIndex].stack -= a;
    h.players[bbIndex].totalBet += a;
  }

  h.players.forEach((p) => { if (p.stack === 0) p.status = 'allin'; });
  h.smallBlind = sb;
  h.bigBlind = bb;
  h.anteAmount = ante;
  const bbActual = h.players[bbIndex].currentBet || bb;
  h.currentBet = bbActual;
  h.lastRaiseAmount = bb;
  h.raiseLevel = 1;
  h.currentPlayer = firstActiveAfter(h.players, bbIndex);
  return h;
}

export function bbaPotOpts(hand) {
  if (!hand || hand.anteType !== 'bba') return {};
  const n = hand.players.length;
  const buttonIndex = hand.players.findIndex((p) => p.seat === hand.buttonSeat);
  if (buttonIndex === -1) return {};
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
  return { bbaAmount: Number(hand.bigBlind) || 0, bbIndex };
}

export function computePots(players, opts = {}) {
  const contribs = players.map((p) => {
    const contrib = p.initialStack - p.stack;
    return { id: p.id, name: p.name, contrib, status: p.status };
  });
  const totalPot = players.reduce((s, p) => s + (p.initialStack - p.stack), 0);
  const hasAllIn = contribs.some((c) => c.status === 'allin' && c.contrib > 0);
  if (!hasAllIn) {
    const eligible = contribs.filter((c) => c.contrib > 0 && c.status !== 'folded').map((c) => c.id);
    return [{ amount: totalPot, eligible }];
  }
  const levels = [...new Set(contribs.filter((c) => c.contrib > 0).map((c) => c.contrib))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    const amount = level - prev;
    const contributors = contribs.filter((c) => c.contrib >= level);
    const potAmount = amount * contributors.length;
    const eligible = contribs
      .filter((c) => c.contrib >= level && c.status !== 'folded')
      .map((c) => c.id);
    pots.push({ amount: potAmount, eligible });
    prev = level;
  }
  const merged = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && JSON.stringify(last.eligible) === JSON.stringify(pot.eligible)) {
      last.amount += pot.amount;
    } else {
      merged.push({ ...pot });
    }
  }
  return merged;
}

export function refundUncontestedPots(hand) {
  const h = clone(hand);
  if (h._refundsApplied) return h;
  const pots = computePots(h.players, bbaPotOpts(h));
  const soleWinners = new Set();
  pots.forEach((pot) => {
    if (pot.eligible.length === 1) soleWinners.add(pot.eligible[0]);
  });
  if (soleWinners.size === 0) {
    h._refundsApplied = true;
    return h;
  }
  const contribs = {};
  h.players.forEach((p) => {
    contribs[p.id] = p.initialStack - p.stack;
  });
  h.refunds = [];
  for (const pid of soleWinners) {
    const p = h.players.find((pl) => pl.id === pid);
    if (!p) continue;
    const myContrib = contribs[pid];
    const maxOther = Math.max(0, ...h.players.filter((pl) => pl.id !== pid).map((pl) => contribs[pl.id]));
    const excess = Math.max(0, myContrib - maxOther);
    if (excess > 0) {
      p.stack += excess;
      p.totalBet -= excess;
      p.refunded = (p.refunded || 0) + excess;
      h.refunds.push({ playerId: pid, amount: excess });
    }
  }
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

function chopSplit(amount, winners, players, buttonSeat, unit) {
  if (winners.length <= 1) {
    return [{ playerId: winners[0], amount }];
  }
  const totalUnits = Math.round(amount / unit);
  const baseUnits = Math.floor(totalUnits / winners.length);
  const extraUnits = totalUnits - baseUnits * winners.length;
  const sorted = chopOrder(winners, players, buttonSeat);
  return sorted.map((wid, i) => ({
    playerId: wid,
    amount: (baseUnits + (i < extraUnits ? 1 : 0)) * unit,
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

    if (cArr && cArr.length && bArr && bArr.length) {
      const totalUnits = Math.round(pot.amount / unit);
      const thirdUnits = Math.floor(totalUnits / 3);
      const aAmount = thirdUnits * unit;
      const bAmount = thirdUnits * unit;
      const cAmount = (totalUnits - thirdUnits * 2) * unit;
      const aShares = chopSplit(aAmount, aArr, h.players, h.buttonSeat, unit);
      const bShares = chopSplit(bAmount, bArr, h.players, h.buttonSeat, unit);
      const cShares = chopSplit(cAmount, cArr, h.players, h.buttonSeat, unit);
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
    } else if (bArr && bArr.length) {
      const totalUnits = Math.round(pot.amount / unit);
      const halfUnits = Math.floor(totalUnits / 2);
      const aAmount = halfUnits * unit;
      const bAmount = (totalUnits - halfUnits) * unit;
      const aShares = chopSplit(aAmount, aArr, h.players, h.buttonSeat, unit);
      const bShares = chopSplit(bAmount, bArr, h.players, h.buttonSeat, unit);
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
  if (killOn && consecWins >= 2 && lastWinnerSeat !== null) {
    h.killActive = true;
    h.killSeat = lastWinnerSeat;
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
  const eliminatedPlayers = [...stillEliminated, ...newlyBusted];

  if (remaining.length <= 1) {
    return { gameOver: true, remaining, eliminatedPlayers };
  }

  const oldButtonIdx = remaining.findIndex((p) => p.seat === hand.buttonSeat);
  const startIdx = oldButtonIdx === -1 ? 0 : (oldButtonIdx + 1) % remaining.length;
  const newButtonSeat = remaining[startIdx].seat;

  const config = {
    players: remaining,
    smallBlind: hand.smallBlind,
    bigBlind: hand.bigBlind,
    anteType: hand.anteType,
    anteAmount: hand.anteAmount,
    mode: hand.mode,
    currency: hand.currency,
    allowStraddle: hand.allowStraddle,
    allowMultiStraddle: hand.allowMultiStraddle,
    mandatoryStraddle: hand.mandatoryStraddle,
    mandatoryDoubleStraddle: hand.mandatoryDoubleStraddle,
    straddleAmount: hand.straddleAmount,
    mandatoryStraddleAmount: hand.mandatoryStraddleAmount,
    mandatoryDoubleStraddleAmount: hand.mandatoryDoubleStraddleAmount,
    bombBoards: hand.bombBoards,
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
    variant: hand.variant,
    bombPot: hand.bombPot,
    bombAmount: hand.bombAmount,
    sideGames: hand.sideGames,
    wonPots: hand.wonPots,
    lastWinnerSeat: hand.lastWinnerSeat,
    consecWins: hand.consecWins,
    killActive: hand.killActive,
    killSeat: hand.killSeat,
    killType: hand.killType,
    gameType: hand.gameType,
    doubleBoard: hand.doubleBoard,
    smallBet: hand.smallBet,
    bigBet: hand.bigBet,
    flMaxRaises: hand.flMaxRaises,
    chipDenominations: hand.chipDenominations,
    tableSize: hand.tableSize,
    tournamentFormat: hand.tournamentFormat,
    maxReEntries: hand.maxReEntries,
    lateRegLevel: hand.lateRegLevel,
    lateRegEnabled: hand.lateRegEnabled,
    startingStack: hand.startingStack,
    rebuyPrice: hand.rebuyPrice,
    rebuyChips: hand.rebuyChips,
    allowAddOn: hand.allowAddOn,
    addOnPrice: hand.addOnPrice,
    addOnChips: hand.addOnChips,
    eliminatedPlayers,
    clockConfig: hand.clockConfig,
    shotClockEnabled: hand.shotClockEnabled,
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
  const hasDec = !Number.isInteger(num);
  const str = num.toLocaleString('en-US', { minimumFractionDigits: hasDec ? 2 : 0, maximumFractionDigits: 2 });
  return currency ? `${currency}${str}` : str;
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

export function calcEquity(holes, board, iterations = 20000, variant = 'nlh', holeSizeOverride) {
  const meta = variantMeta(variant);
  const holeSize = holeSizeOverride || meta.holeSize;
  const numPlayers = holes.length;
  const used = new Set();
  for (const h of holes) if (h) for (const c of h) used.add(c.rank + c.suit);
  for (const c of board) if (!c.hidden) used.add(c.rank + c.suit);
  const deckRanks = meta.deck === 'short' ? ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] : RANKS;
  const deck = [];
  for (const r of deckRanks) {
    for (const s of SUITS) {
      const key = r + s;
      if (!used.has(key)) deck.push({ rank: r, suit: s });
    }
  }
  const lowGame = meta.group === 'low';
  const realBoard = lowGame ? [] : board.filter((c) => !c.hidden);
  const needBoard = lowGame ? 0 : (5 - realBoard.length);
  let unknownHoles = 0;
  for (let i = 0; i < numPlayers; i++) if (!holes[i]) unknownHoles++;
  const totalDraw = needBoard + unknownHoles * holeSize;
  const evalFn = variant === 'lazy_pineapple'
    ? (h, b) => evaluateLazyPineapple(h, b, meta.deck === 'short')
    : meta.group === 'omaha'
    ? (h, b) => evaluateOmahaStyle(h, b)
    : meta.group === 'low'
    ? (h, b) => evaluateLow([...h, ...b], meta.lowKind === 'a5', meta.lowKind === '27')
    : (h, b) => evaluate7([...h, ...b], meta.deck === 'short');
  const wins = new Array(numPlayers).fill(0);
  let splits = 0;
  for (let it = 0; it < iterations; it++) {
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
    let best = scores[0];
    for (let i = 1; i < numPlayers; i++) {
      const c = cmpScore(scores[i], best);
      if (meta.low ? c < 0 : c > 0) best = scores[i];
    }
    const winners = [];
    for (let i = 0; i < numPlayers; i++) if (cmpScore(scores[i], best) === 0) winners.push(i);
    if (winners.length === 1) wins[winners[0]]++;
    else splits++;
  }
  const results = [];
  for (let i = 0; i < numPlayers; i++) results.push({ win: (wins[i] / iterations) * 100 });
  return { results, split: (splits / iterations) * 100 };
}

export function calculateEffectiveM(player, hand) {
  if (!hand || hand.mode === 'cash' || !player) return null;
  const stack = Number(player.stack) || 0;
  const sb = Number(hand.smallBlind) || 0;
  const bb = Number(hand.bigBlind) || 0;
  const playersRemaining = (hand.players || []).filter((p) => (p.stack || 0) > 0).length || (hand.players || []).length || 1;

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

  const board = (hand.communityCards || []).filter((c) => c && !c.hidden);
  // On river (5 cards), board is complete: no future outs
  if (board.length >= 5) return [];

  // Omaha requires at least 3 community cards
  if (meta.group === 'omaha' && board.length < 3) return [];

  const evalFn = variant === 'lazy_pineapple'
    ? (h, b) => evaluateLazyPineapple(h, b, meta.deck === 'short')
    : meta.group === 'omaha'
    ? (h, b) => evaluateOmahaStyle(h, b)
    : lowGame
    ? (h, b) => evaluateLow([...h, ...b], meta.lowKind === 'a5', meta.lowKind === '27')
    : (h, b) => evaluate7([...h, ...b], meta.deck === 'short');

  // Evaluate current hand strength for each contestant on current board
  const scores = contestants.map((p) => evalFn(holeCards[p.id], board));

  let bestScore = scores[0];
  for (let i = 1; i < contestants.length; i++) {
    const c = cmpScore(scores[i], bestScore);
    if (lowGame ? c < 0 : c > 0) {
      bestScore = scores[i];
    }
  }

  // Identify contestants who are currently NOT ahead
  const trailing = [];
  contestants.forEach((p, idx) => {
    const diff = cmpScore(scores[idx], bestScore);
    if (diff !== 0) {
      trailing.push(p);
    }
  });

  if (trailing.length === 0) return [];

  // Build remaining unseen cards in deck
  const used = new Set();
  for (const p of players) {
    const h = holeCards[p.id];
    if (h) for (const c of h) used.add(c.rank + c.suit);
  }
  for (const c of board) used.add(c.rank + c.suit);
  if (hand.doubleBoard && hand.boardB) {
    for (const c of hand.boardB) if (c && !c.hidden) used.add(c.rank + c.suit);
  }

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

  const results = [];
  for (const p of trailing) {
    const outs = [];
    const myHole = holeCards[p.id];

    for (const card of remainingDeck) {
      const candidateBoard = [...board, card];
      const myCandidateScore = evalFn(myHole, candidateBoard);

      let beatsAll = true;
      for (const other of contestants) {
        if (other.id === p.id) continue;
        const otherCandidateScore = evalFn(holeCards[other.id], candidateBoard);
        const comp = cmpScore(myCandidateScore, otherCandidateScore);
        const ahead = lowGame ? comp < 0 : comp > 0;
        if (!ahead) {
          beatsAll = false;
          break;
        }
      }

      if (beatsAll) {
        outs.push(card);
      }
    }

    // Sort outs: rank from A to 2, then suit (spades, hearts, diamonds, clubs)
    outs.sort((a, b) => {
      const rd = (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0);
      if (rd !== 0) return rd;
      return (SUIT_ORDER[a.suit] ?? 99) - (SUIT_ORDER[b.suit] ?? 99);
    });

    results.push({
      player: p,
      outs,
    });
  }

  return results;
}

export function isAllInSituation(hand, holeCards) {
  if (!hand || !hand.players || hand.phase === 'awarded') return false;
  const nf = hand.players.filter((p) => p.status !== 'folded');
  if (nf.length < 2) return false;
  const inAllin = isAllInShowdown(hand);
  if (!inAllin && hand.phase !== 'ended') return false;
  if (!holeCards) return false;
  return nf.every((p) => holeCards[p.id] && holeCardsComplete(hand, holeCards[p.id]));
}

export function isAllInShowdown(hand) {
  if (!hand || !hand.players || hand.phase === 'awarded') return false;
  const nf = hand.players.filter((p) => p.status !== 'folded');
  if (nf.length < 2) return false;
  if (hand.phase === 'ended') return true;
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
  if (!lowGame && realBoard.length !== 5) return null;
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
    : (h) => evaluate7([...h, ...realBoard], meta.deck === 'short');
  const scores = eligible.map((pid) => ({ pid, score: evalFn(holeCards[pid]) }));
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
  if (variant === 'crazy_pineapple' && hand.cpNeedsDiscard && !hand.cpDiscarded) return null;
  const lowGame = meta.group === 'low';
  if (!lowGame) {
    const boardComplete = hand.communityCards.length === 5 && hand.communityCards.every((c) => !c.hidden);
    if (!boardComplete) return null;
    if (hand.doubleBoard) {
      const bComplete = (hand.boardB || []).length === 5 && (hand.boardB || []).every((c) => !c.hidden);
      if (!bComplete) return null;
    }
  }
  if (!nonFolded.every((p) => holeCardsComplete(hand, holeCards[p.id]))) return null;
  const pots = computePots(hand.players, bbaPotOpts(hand));
  const winnersA = {};
  let winnersB = hand.doubleBoard ? {} : null;
  for (let i = 0; i < pots.length; i++) {
    if (pots[i].eligible.length === 1) {
      winnersA[i] = [pots[i].eligible[0]];
      if (winnersB) winnersB[i] = [pots[i].eligible[0]];
      continue;
    }
    const wa = evaluateWinners(pots[i].eligible, holeCards, hand.communityCards, variant, holeSize);
    if (!wa) return null;
    winnersA[i] = wa;
    if (hand.doubleBoard) {
      const wb = evaluateWinners(pots[i].eligible, holeCards, hand.boardB, variant, holeSize);
      if (!wb) return null;
      winnersB[i] = wb;
    }
  }
  return { winnersA, winnersB };
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
