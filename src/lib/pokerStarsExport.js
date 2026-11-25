// PokerStars-hand-history text export.
// Produces one .txt file per session in the layout PokerStars writes, so the
// file can be replayed by GTO Wizard, PokerTracker and Holdem Manager.
import { evalPlayerHand, VARIANTS } from './poker.js';

const EPS = 1e-6;
const DEFAULT_TOURNAMENT_ID = '555555555';
const DEFAULT_HAND_ID = 100000001;

const RANK_WORD = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
  8: 'Eight', 9: 'Nine', T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace',
};
const VALUE_TO_RANK = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

function pluralWord(rank) {
  const w = RANK_WORD[rank];
  if (!w) return '';
  if (w === 'Six') return 'Sixes';
  return `${w}s`;
}

function num(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return String(v);
}

function cardText(card) {
  if (!card || card.hidden) return null;
  let rank = String(card.rank ?? '').toUpperCase();
  if (rank === '10') rank = 'T';
  const suit = String(card.suit ?? '').toLowerCase();
  if (!rank || !'SHDC'.includes(suit.toUpperCase())) return null;
  return `${rank}${suit}`;
}

function cardsText(cards) {
  return (cards || []).map(cardText).filter(Boolean);
}

function boardCards(hand) {
  return cardsText(hand.communityCards || []);
}

// "(a pair of Aces)", "(a flush, Ace high)", … from an evaluate7-style score.
export function describeScore(score, shortDeck = false) {
  if (!Array.isArray(score) || !score.length) return '';
  let cat = score[0];
  if (shortDeck) {
    if (cat === 5) cat = 6;
    else if (cat === 6) cat = 5;
  }
  const name = (v) => RANK_WORD[VALUE_TO_RANK[v]] || '';
  const pl = (v) => pluralWord(VALUE_TO_RANK[v]);
  const straightWord = (high) => (high === 5 ? 'Five to Ace' : `${name(high)} to ${name(high - 4)}`);

  if (cat === 9) return 'a royal flush';
  if (cat === 8.5) return `five of a kind, ${pl(score[1])}`;
  switch (cat) {
    case 8: return score[1] === 14 ? 'a royal flush' : `a straight flush, ${straightWord(score[1])}`;
    case 7: return `four of a kind, ${pl(score[1])}`;
    case 6: return `a full house, ${pl(score[1])} full of ${pl(score[2])}`;
    case 5: return `a flush, ${name(score[1])} high`;
    case 4: return `a straight, ${straightWord(score[1])}`;
    case 3: return `three of a kind, ${pl(score[1])}`;
    case 2: return `two pair, ${pl(score[1])} and ${pl(score[2])}`;
    case 1: return `a pair of ${pl(score[1])}`;
    default: return `high card ${name(score[1])}`;
  }
}

function handDescription(hand, hole, board) {
  if (!hole || hole.length < 2 || board.length < 5) return '';
  try {
    const variant = hand.variant || 'nlh';
    const score = evalPlayerHand(hole, hand.communityCards || [], variant);
    const shortDeck = (VARIANTS[variant] || {}).deck === 'short';
    return describeScore(score, shortDeck);
  } catch {
    return '';
  }
}

function roman(n) {
  let v = Math.max(1, Math.round(Number(n) || 1));
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [value, sym] of table) {
    while (v >= value) { out += sym; v -= value; }
  }
  return out;
}

function etTimestamp(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}/${get('month')}/${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

function sanitizeName(name, seat, used) {
  let out = String(name ?? '').replace(/[:()]/g, '_').trim();
  if (!out) out = `Player ${seat}`;
  if (used.has(out)) {
    let i = 2;
    while (used.has(`${out}_${i}`)) i += 1;
    out = `${out}_${i}`;
  }
  used.add(out);
  return out;
}

function limitLabel(hand) {
  const group = (VARIANTS[hand.variant] || {}).group;
  // Omaha games are always pot limit; a stale gameType must not override that.
  if (group === 'omaha' || group === 'dramaha') return 'Pot Limit';
  const gt = hand.gameType;
  if (gt === 'pl') return 'Pot Limit';
  if (gt === 'fl') return 'Fixed Limit';
  return 'No Limit';
}

function gameName(hand) {
  const variant = hand.variant || 'nlh';
  const group = (VARIANTS[variant] || {}).group;
  const base = variant === 'plo8' || group === 'dramaha'
    ? 'Omaha Hi/Lo'
    : group === 'omaha'
    ? 'Omaha'
    : "Hold'em";
  return `${base} ${limitLabel(hand)}`;
}

function normalizePlayers(hand) {
  const used = new Set();
  return (hand.players || [])
    .filter((p) => p)
    .map((p, i) => {
      const seat = Number(p.seat) > 0 ? Number(p.seat) : i + 1;
      return {
        ...p,
        seat,
        rawName: p.name,
        name: sanitizeName(p.name, seat, used),
        startStack: Math.max(0, Number(p.initialStack != null ? p.initialStack : p.stack) || 0),
        totalBet: Math.max(0, Number(p.totalBet) || 0),
        antePaid: Math.max(0, Number(p.antePaid) || 0),
      };
    })
    .sort((a, b) => a.seat - b.seat);
}

function nextSeatAfter(players, seat) {
  const seats = players.map((p) => p.seat).sort((a, b) => a - b);
  return seats.find((s) => s > seat) ?? seats[0];
}

function splitEven(total, count) {
  if (count <= 0 || total <= 0) return Array(count).fill(0);
  // Keep whole-chip stacks whole; only fall back to cents for cash amounts.
  const unit = Math.abs(total - Math.round(total)) < 1e-9 ? 1 : 0.01;
  const totalUnits = Math.round(total / unit);
  const base = Math.floor(totalUnits / count);
  let rem = totalUnits - base * count;
  return Array.from({ length: count }, () => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return Math.round((base + extra) * unit * 100) / 100;
  });
}

function buildPotInfo(hand, players, contributed) {
  const nonFolded = players.filter((p) => p.status !== 'folded');
  const refunds = Array.isArray(hand.refunds) ? hand.refunds : [];
  let refund = refunds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  let refundPlayerId = refunds[0]?.playerId ?? null;
  // The engine already took a recorded refund out of totalBet, so it must not
  // be subtracted a second time. The walked postings still include it.
  const refundAlreadyExcluded = refund > EPS;

  if (!refund && nonFolded.length === 1) {
    const winner = nonFolded[0];
    const winnerChips = contributed.get(winner.id) || 0;
    const others = players.filter((p) => p.id !== winner.id).map((p) => contributed.get(p.id) || 0);
    const best = Math.max(0, ...others);
    const excess = Math.round((winnerChips - best) * 100) / 100;
    if (excess > EPS) {
      refund = excess;
      refundPlayerId = winner.id;
    }
  }

  const totalPot = Math.max(0, Math.round(
    (players.reduce((sum, p) => sum + (contributed.get(p.id) || 0), 0)
      - (refundAlreadyExcluded ? 0 : refund)) * 100,
  ) / 100);

  const pots = Array.isArray(hand.pots) && hand.pots.length
    ? hand.pots.map((p) => Math.round((Number(p.amount) || 0) * 100) / 100)
    : [totalPot];

  return { totalPot, refund, refundPlayerId, pots, nonFolded, refundAlreadyExcluded };
}

function resolveWinnerAmounts(hand, players, totalPot, nonFolded) {
  const amounts = new Map();
  const byPot = new Map();
  const winners = Array.isArray(hand.winners) ? hand.winners : [];
  winners.forEach((w) => {
    if (!w || w.playerId == null) return;
    const amount = Number(w.amount) || 0;
    if (amount <= 0) return;
    amounts.set(w.playerId, (amounts.get(w.playerId) || 0) + amount);
    const potIndex = Number(w.potIndex) || 0;
    if (!byPot.has(potIndex)) byPot.set(potIndex, new Map());
    const potMap = byPot.get(potIndex);
    potMap.set(w.playerId, (potMap.get(w.playerId) || 0) + amount);
  });
  if (amounts.size === 0 && nonFolded.length === 1 && totalPot > 0) {
    amounts.set(nonFolded[0].id, totalPot);
    byPot.set(0, new Map([[nonFolded[0].id, totalPot]]));
  }
  return { amounts, byPot };
}

function bigBlindSeats(hand, players, buttonSeat) {
  let sbSeat = Number(hand.sbSeat) || null;
  let bbSeat = Number(hand.bbSeat) || null;
  if (players.length === 2) {
    if (!sbSeat) sbSeat = buttonSeat;
    if (!bbSeat) bbSeat = players.find((p) => p.seat !== buttonSeat)?.seat ?? null;
  } else {
    if (!sbSeat) sbSeat = nextSeatAfter(players, buttonSeat);
    if (!bbSeat) bbSeat = nextSeatAfter(players, sbSeat);
  }
  return { sbSeat, bbSeat };
}

// Walks the recorded action list and writes the PokerStars action lines.
function writeActions({ hand, players, state, lines, board, maxBetStart }) {
  const byStreet = (street) => (hand.actions || hand.actionHistory || []).filter((a) => (a.street || 'preflop') === street);
  const idFor = (action) => {
    if (action.playerId != null && state.byPlayer.has(action.playerId)) return action.playerId;
    const byName = players.find((p) => p.name === action.player || p.rawName === action.player);
    return byName ? byName.id : null;
  };

  const playStreet = (street, header) => {
    const actions = byStreet(street);
    if (header) lines.push(header);
    state.street = street;
    players.forEach((p) => { state.bets.set(p.id, street === 'preflop' ? (state.preflopBet.get(p.id) || 0) : 0); });
    let maxBet = street === 'preflop' ? maxBetStart : 0;
    if (street === 'preflop') {
      players.forEach((p) => {
        const b = state.preflopBet.get(p.id) || 0;
        if (b > maxBet) maxBet = b;
      });
    }

    actions.forEach((action) => {
      const pid = idFor(action);
      if (pid == null) return;
      const p = players.find((x) => x.id === pid);
      const seatState = state.byPlayer.get(pid);
      if (!p || !seatState) return;

      const label = String(action.action || '').toLowerCase();
      const prevBet = state.bets.get(pid) || 0;
      const rawChips = Number(action.chips);
      // betTo is the authoritative street total; the recorded chips field is a
      // total on some engine paths, so the added chips are derived from betTo.
      const target = Number.isFinite(Number(action.betTo))
        ? Number(action.betTo)
        : prevBet + (Number.isFinite(rawChips) ? Math.max(0, rawChips) : 0);
      const chips = Math.max(0, target - prevBet);
      const nextInvested = seatState.invested + chips;
      const goesAllIn = chips > EPS && nextInvested >= seatState.startStack - EPS;

      if (label.includes('fold')) {
        seatState.folded = true;
        seatState.foldStreet = street;
        lines.push(`${p.name}: folds`);
        return;
      }

      seatState.invested = nextInvested;
      if (chips > EPS) seatState.voluntary = true;

      if (target > maxBet + EPS) {
        if (maxBet <= EPS) {
          lines.push(`${p.name}: bets ${num(target)}${goesAllIn ? ' and is all-in' : ''}`);
        } else {
          lines.push(`${p.name}: raises ${num(target - maxBet)} to ${num(target)}${goesAllIn ? ' and is all-in' : ''}`);
        }
        maxBet = target;
        state.bets.set(pid, target);
      } else if (chips > EPS) {
        lines.push(`${p.name}: calls ${num(chips)}${goesAllIn ? ' and is all-in' : ''}`);
        if (target > prevBet) state.bets.set(pid, target);
      } else {
        lines.push(`${p.name}: checks`);
      }
    });
  };

  const flop = board.slice(0, 3);
  const turn = board[3];
  const river = board[4];

  playStreet('preflop', null);
  if (flop.length === 3) playStreet('flop', `*** FLOP *** [${flop.join(' ')}]`);
  if (turn) playStreet('turn', `*** TURN *** [${flop.join(' ')}] [${turn}]`);
  if (river) playStreet('river', `*** RIVER *** [${flop.slice(0, 3).join(' ')} ${turn}] [${river}]`);
}

function formatSingleHand(hand, ctx) {
  const lines = [];
  const players = normalizePlayers(hand);
  if (!players.length) return '';
  const byId = new Map(players.map((p) => [p.id, p]));

  const buttonSeat = Number(hand.buttonSeat) > 0 ? Number(hand.buttonSeat) : players[0].seat;
  const { sbSeat, bbSeat } = bigBlindSeats(hand, players, buttonSeat);
  const sbAmount = Math.max(0, Number(hand.smallBlind) || 0);
  const bbAmount = Math.max(0, Number(hand.bigBlind) || 0);
  // Short Deck in this app is ante-only: every seat antes one big blind and the
  // button antes a second one, so the level plays as 1bb/1bb (button = sb).
  const isShortDeck = String(hand.variant || '') === 'short_deck';
  const seatedMax = Math.max(...players.map((p) => p.seat));
  const declaredSeats = Number(hand.tableSize) > 0 ? Number(hand.tableSize) : players.length;
  const maxSeats = seatedMax >= 10 || declaredSeats >= 10 ? 10
    : declaredSeats > 6 || seatedMax > 6 ? 9
    : declaredSeats > 2 || seatedMax > 2 ? 6
    : 2;

  lines.push(`PokerStars Hand #${ctx.handId}: Tournament #${ctx.tournamentId}, $10+$0 USD ${gameName(hand)} - Level ${roman(ctx.level)} (${num(isShortDeck ? bbAmount : sbAmount)}/${num(bbAmount)}) - ${ctx.time} ET`);
  lines.push(`Table '${ctx.tournamentId} 1' ${maxSeats}-max Seat #${buttonSeat} is the button`);

  players.forEach((p) => {
    lines.push(`Seat ${p.seat}: ${p.name} (${num(p.startStack)} in chips)`);
  });

  // Antes: a big-blind ante is spread evenly so every seat posts one.
  const antePaid = players.reduce((sum, p) => sum + p.antePaid, 0);
  const anteType = hand.anteType || 'none';
  let anteTotal = antePaid;
  if (anteTotal <= 0 && Number(hand.anteAmount) > 0 && anteType !== 'none') {
    anteTotal = anteType === 'bba' || anteType === 'btn_ante'
      ? Number(hand.anteAmount)
      : Number(hand.anteAmount) * players.length;
  }
  const preflopBet = new Map();
  const introInvested = new Map();
  const anteByPlayer = new Map();
  const postBlind = (p, seat, amount, label) => {
    if (!p || !(amount > 0)) return;
    const ante = anteByPlayer.get(p.id) || 0;
    const paid = Math.min(amount, Math.max(0, p.startStack - ante));
    if (paid <= 0) return;
    const allIn = paid >= Math.max(0, p.startStack - ante) - EPS;
    lines.push(`${p.name}: posts ${label} ${num(paid)}${allIn ? ' and is all-in' : ''}`);
    preflopBet.set(p.id, paid);
    introInvested.set(p.id, ante + paid);
  };
  if (isShortDeck) {
    // Short Deck here has no blinds: every seat antes one big blind and the
    // button antes a second one, which is the engine's opening bet. The export
    // keeps those postings exact (the button's second ante is credited to
    // totalBet only, so it is rebuilt from the ante size and starting stack).
    players.forEach((p) => {
      let paid = Math.max(0, p.antePaid || 0);
      if (p.seat === buttonSeat) {
        const anteUnit = Number(hand.anteAmount) > 0 ? Number(hand.anteAmount) : (bbAmount || paid);
        paid += Math.min(anteUnit, Math.max(0, p.startStack - paid));
        preflopBet.set(p.id, paid - Math.max(0, p.antePaid || 0));
      }
      anteByPlayer.set(p.id, paid);
      if (paid <= 0) return;
      const allIn = paid >= p.startStack - EPS;
      lines.push(`${p.name}: posts the ante ${num(paid)}${allIn ? ' and is all-in' : ''}`);
    });
  } else if (anteTotal > 0) {
    // Post the ante on the seats the engine actually charged. A big blind ante
    // is paid by the big blind, which is also how PokerStars writes it, and any
    // even split here would make the exported pot disagree with the app's own
    // ledger the moment a non-blind seat folds.
    const shares = players.some((p) => p.antePaid > EPS)
      ? players.map((p) => Math.max(0, p.antePaid || 0))
      : splitEven(anteTotal, players.length);
    players.forEach((p, i) => anteByPlayer.set(p.id, shares[i]));
    players.forEach((p) => {
      const amount = anteByPlayer.get(p.id) || 0;
      if (amount <= 0) return;
      const allIn = amount >= p.startStack - EPS;
      lines.push(`${p.name}: posts the ante ${num(amount)}${allIn ? ' and is all-in' : ''}`);
    });
  }

  const sbPlayer = players.find((p) => p.seat === sbSeat);
  const bbPlayer = players.find((p) => p.seat === bbSeat);

  if (!isShortDeck) {
    postBlind(sbPlayer, sbSeat, sbAmount, 'small blind');
    postBlind(bbPlayer, bbSeat, bbAmount, 'big blind');
  }
  players.forEach((p) => {
    if (!introInvested.has(p.id)) introInvested.set(p.id, anteByPlayer.get(p.id) || 0);
  });

  const board = boardCards(hand);
  const holeMap = hand.holeCards || hand._holeCards || {};
  const heroId = pickHero(players, holeMap, ctx.heroName);
  const hero = heroId != null ? byId.get(heroId) : null;
  const heroCards = heroId != null ? cardsText(holeMap[heroId]) : [];

  lines.push('*** HOLE CARDS ***');
  if (hero && heroCards.length) lines.push(`Dealt to ${hero.name} [${heroCards.join(' ')}]`);

  const state = {
    byPlayer: new Map(players.map((p) => [p.id, {
      invested: introInvested.get(p.id) || 0,
      startStack: p.startStack,
      voluntary: false,
      folded: p.status === 'folded',
      foldStreet: p.status === 'folded' ? 'preflop' : null,
    }])),
    bets: new Map(),
    preflopBet,
    street: 'preflop',
  };
  const maxBetStart = Math.max(0, bbAmount, ...Array.from(preflopBet.values()));
  writeActions({ hand, players, state, lines, board, maxBetStart });

  players.forEach((p) => {
    if (state.byPlayer.get(p.id)?.folded) p.status = 'folded';
  });

  const contributed = new Map();
  const walkedByPlayer = new Map(players.map((p) => [p.id, state.byPlayer.get(p.id)?.invested || 0]));
  const hasLedger = players.some((p) => Number(p.totalBet) > 0);
  players.forEach((p) => {
    // totalBet is the engine's ledger and already has any returned excess removed.
    const chips = hasLedger ? p.totalBet : walkedByPlayer.get(p.id);
    contributed.set(p.id, Math.round(chips * 100) / 100);
  });

  const { totalPot, refund, refundPlayerId, pots, nonFolded, refundAlreadyExcluded } = buildPotInfo(hand, players, contributed);
  const { amounts, byPot } = resolveWinnerAmounts(hand, players, totalPot, nonFolded);
  // A showdown needs two players still in and at least one recorded hand, so a
  // walk or a record without hole cards does not print a fake showdown block.
  const hasReveal = nonFolded.some((p) => cardsText(holeMap[p.id]).length > 0);
  const isShowdown = nonFolded.length >= 2 && hasReveal;
  const revealed = new Set();

  // A bet nobody called is returned before the pot is paid, so the winner's
  // collection must not include it (unless the engine already refunded it).
  if (refund > EPS && refundPlayerId != null && !refundAlreadyExcluded && amounts.has(refundPlayerId)) {
    let left = refund;
    const potKeys = [...byPot.keys()]
      .filter((k) => byPot.get(k).has(refundPlayerId))
      .sort((a, b) => b - a);
    potKeys.forEach((k) => {
      const potMap = byPot.get(k);
      const value = potMap.get(refundPlayerId) || 0;
      const take = Math.min(value, left);
      if (take > 0) {
        potMap.set(refundPlayerId, value - take);
        left -= take;
      }
    });
    amounts.set(refundPlayerId, Math.max(0, (amounts.get(refundPlayerId) || 0) - refund));
  }

  if (refund > EPS && refundPlayerId != null) {
    const rp = byId.get(refundPlayerId);
    if (rp) lines.push(`Uncalled bet (${num(refund)}) returned to ${rp.name}`);
  }

  if (isShowdown) {
    lines.push('*** SHOW DOWN ***');
    const order = [...nonFolded].sort((a, b) => a.seat - b.seat);
    order.forEach((p) => {
      const cards = cardsText(holeMap[p.id]);
      revealed.add(p.id);
      if (!cards.length) {
        lines.push(`${p.name}: mucks hand`);
        return;
      }
      const desc = handDescription(hand, holeMap[p.id], board);
      lines.push(`${p.name}: shows [${cards.join(' ')}]${desc ? ` (${desc})` : ''}`);
    });
  }

  // Collection lines, side pots first resolved from pot index.
  const potLabel = (index) => (index === 0 || pots.length === 1 ? 'pot' : `side pot-${index}`);
  const collectLines = [];
  const orderedPots = [...byPot.keys()].sort((a, b) => a - b);
  orderedPots.forEach((potIndex) => {
    const potMap = byPot.get(potIndex);
    [...potMap.entries()].forEach(([pid, amount]) => {
      const p = byId.get(pid);
      if (!p || !(amount > 0)) return;
      collectLines.push(`${p.name} collected ${num(amount)} from ${potLabel(potIndex)}`);
    });
  });
  lines.push(...collectLines);

  if (isShowdown) {
    nonFolded.forEach((p) => {
      if (amounts.get(p.id) || revealed.has(p.id)) return;
      if (cardsText(holeMap[p.id]).length) return;
      lines.push(`${p.name}: doesn't show hand`);
    });
  } else if (nonFolded.length === 1) {
    lines.push(`${nonFolded[0].name}: doesn't show hand`);
  }

  lines.push('*** SUMMARY ***');
  if (pots.length > 1) {
    const [main, ...sides] = pots;
    const sideText = sides
      .map((amount, i) => ` Side pot${sides.length > 1 ? `-${i + 1}` : ''} ${num(amount)}.`)
      .join('');
    lines.push(`Total pot ${num(totalPot)} Main pot ${num(main)}.${sideText} | Rake 0`);
  } else {
    lines.push(`Total pot ${num(totalPot)} | Rake 0`);
  }
  if (board.length >= 3) lines.push(`Board [${board.join(' ')}]`);

  players.forEach((p) => {
    const tags = [];
    if (p.seat === buttonSeat) tags.push('(button)');
    if (p.seat === sbSeat) tags.push('(small blind)');
    if (p.seat === bbSeat) tags.push('(big blind)');
    const tagText = tags.length ? ` ${tags.join(' ')}` : '';
    const seatState = state.byPlayer.get(p.id);
    const won = amounts.get(p.id) || 0;
    const cards = cardsText(holeMap[p.id]);
    let outcome;
    if (seatState?.folded) {
      const street = seatState.foldStreet || 'preflop';
      const streetText = street === 'preflop' ? 'before Flop'
        : street === 'flop' ? 'on the Flop'
        : street === 'turn' ? 'on the Turn'
        : 'on the River';
      outcome = `folded ${streetText}${seatState.voluntary ? '' : " (didn't bet)"}`;
    } else if (won > 0 && isShowdown && cards.length) {
      const desc = handDescription(hand, holeMap[p.id], board);
      outcome = `showed [${cards.join(' ')}] and won (${num(won)})${desc ? ` with ${desc}` : ''}`;
    } else if (won > 0) {
      outcome = `collected (${num(won)})`;
    } else if (isShowdown && cards.length) {
      const desc = handDescription(hand, holeMap[p.id], board);
      outcome = `showed [${cards.join(' ')}] and lost${desc ? ` with ${desc}` : ''}`;
    } else if (isShowdown) {
      outcome = 'mucked hand';
    } else {
      outcome = 'folded before Flop';
    }
    lines.push(`Seat ${p.seat}: ${p.name}${tagText} ${outcome}`);
  });

  return lines.join('\n');
}

function pickHero(players, holeMap, heroName) {
  if (heroName) {
    const exact = players.find((p) => p.name === heroName || p.rawName === heroName);
    if (exact) return exact.id;
  }
  const you = players.find((p) => p.name === 'You');
  if (you && cardsText(holeMap[you.id]).length) return you.id;
  const withCards = players.find((p) => cardsText(holeMap[p.id]).length);
  if (withCards) return withCards.id;
  return you ? you.id : null;
}

function hashNumber(text, digits) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const base = 10 ** (digits - 1);
  return base + (Math.abs(h) % (9 * base));
}

export function buildPokerStarsText(hands, options = {}) {
  const list = (Array.isArray(hands) ? hands : []).filter((h) => h && Array.isArray(h.players) && h.players.length);
  if (!list.length) return '';
  const sorted = list.every((h) => Number.isFinite(Number(h.handNumber)))
    ? [...list].sort((a, b) => Number(a.handNumber) - Number(b.handNumber))
    : [...list];

  const sessionKey = options.sessionKey || sorted[0]?.id || 'session';
  const tournamentId = options.tournamentId || String(hashNumber(String(sessionKey), 9));
  const handIdStart = Number(options.handIdStart) || DEFAULT_HAND_ID;
  const baseTime = options.startTime ? new Date(options.startTime) : new Date();
  const base = baseTime.getTime() + (Number.isFinite(Number(options.timestampOffsetMs)) ? Number(options.timestampOffsetMs) : 0);

  const levelFor = new Map();
  let levelCounter = 0;
  if (typeof options.levelOf === 'function') {
    sorted.forEach((h) => levelFor.set(h, options.levelOf(h)));
  } else {
    sorted.forEach((h) => {
      const key = `${Number(h.smallBlind) || 0}/${Number(h.bigBlind) || 0}`;
      if (!levelFor.has(key)) {
        levelCounter += 1;
        levelFor.set(key, levelCounter);
      }
      levelFor.set(h, levelFor.get(key));
    });
  }

  const blocks = sorted.map((hand, i) => {
    const when = new Date(base + i * 60 * 1000);
    return formatSingleHand(hand, {
      handId: handIdStart + i,
      tournamentId,
      level: levelFor.get(hand) || 1,
      time: etTimestamp(when),
      heroName: options.heroName,
    });
  }).filter(Boolean);

  return `${blocks.join('\n\n\n')}\n`;
}

export function pokerStarsFilename(options = {}) {
  const prefix = options.filenamePrefix || 'PokerStars_Hand_History';
  const stamp = new Date().toISOString().slice(0, 10);
  const safeSession = options.sessionKey
    ? `_${String(options.sessionKey).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40)}`
    : '';
  return `${prefix}${safeSession}_${stamp}.txt`;
}

export function downloadPokerStarsTxt(hands, options = {}) {
  const text = buildPokerStarsText(hands, options);
  if (!text) throw new Error('No hands to export.');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', pokerStarsFilename(options));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return pokerStarsFilename(options);
}
