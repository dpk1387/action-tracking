import { startHand, applyAction } from '@/lib/poker';
import { decideBotAction, resolveStyle } from '@/lib/bots';
import { generateGoDeck } from '@/lib/goMode';

const STEAL_POSITIONS = new Set(['CO', 'BTN', 'SB', 'D']);

const isFold = (a) => /^fold$/i.test(a.action || '');
const isCheck = (a) => /^check$/i.test(a.action || '');
const isCall = (a) => /^call/i.test(a.action || '');
/** actionHistory stores display labels ("Bet", "3-bet", "All-in"), not types. */
export const isAggressiveAction = (a) => /^(bet|raise|all[- ]?in|\d+-bet)/i.test(a.action || '');

const COUNT_KEYS = [
  'hands', 'vpip', 'pfr', 'threeBetOpps', 'threeBets', 'stealOpps', 'steals',
  'cbetOpps', 'cbets', 'foldCbetOpps', 'foldCbets', 'postAgg', 'postCalls',
];

export function emptyCounts() {
  return {
    hands: 0,
    vpip: 0,
    pfr: 0,
    threeBetOpps: 0,
    threeBets: 0,
    stealOpps: 0,
    steals: 0,
    cbetOpps: 0,
    cbets: 0,
    foldCbetOpps: 0,
    foldCbets: 0,
    postAgg: 0,
    postCalls: 0,
  };
}

/** Compact per-hand tally used for rolling stat windows. */
export function countsToRow(counts) {
  return COUNT_KEYS.map((k) => Number(counts?.[k]) || 0);
}

export function rowToCounts(row) {
  const out = emptyCounts();
  COUNT_KEYS.forEach((k, i) => { out[k] = Number(row?.[i]) || 0; });
  return out;
}

export function addCounts(target, counts) {
  COUNT_KEYS.forEach((k) => { target[k] = (target[k] || 0) + (Number(counts?.[k]) || 0); });
  return target;
}

export function sumRows(rows) {
  const out = emptyCounts();
  (rows || []).forEach((row) => addCounts(out, rowToCounts(row)));
  return out;
}

/** Percent with one decimal, or null when the player never had the chance. */
export function pct(made, opps) {
  if (!opps) return null;
  return Math.round((made / opps) * 1000) / 10;
}

/** One recorded hand's contribution to a player's stats. */
function tallyHand(rec, heroName, tally) {
  const actions = rec.actions || [];
  const positions = rec.positions || {};
  tally.hands += 1;

  const pre = actions.filter((a) => a.street === 'preflop');
  let level = 1;
  let firstIn = true;
  let heroVpip = false;
  let heroPfr = false;
  const heroPos = positions[heroName];

  pre.forEach((a) => {
    const before = level;
    const lvlAfter = Math.max(before, Number(a.raiseLevel) || before);
    const aggressive = isAggressiveAction(a);
    if (a.player === heroName) {
      const chips = Number(a.chips) || 0;
      if (!isFold(a) && !isCheck(a) && (chips > 0 || aggressive)) heroVpip = true;
      if (aggressive && lvlAfter >= 2) heroPfr = true;
      if (before >= 2) {
        tally.threeBetOpps += 1;
        if (aggressive && lvlAfter >= 3) tally.threeBets += 1;
      }
      if (STEAL_POSITIONS.has(heroPos) && before <= 1 && firstIn) {
        tally.stealOpps += 1;
        if (aggressive) tally.steals += 1;
      }
    } else if (aggressive || !isFold(a)) {
      firstIn = false;
    }
    level = lvlAfter;
  });

  if (heroVpip) tally.vpip += 1;
  if (heroPfr) tally.pfr += 1;

  // Continuation bets are measured on the flop against the preflop aggressor.
  const pfa = [...pre].reverse().find((a) => isAggressiveAction(a) && (Number(a.raiseLevel) || 0) >= 2)?.player;
  const flop = actions.filter((a) => a.street === 'flop');
  let betSeen = false;
  let heroFlopDone = false;
  flop.forEach((a) => {
    const aggressive = isAggressiveAction(a);
    if (a.player === heroName && !heroFlopDone) {
      heroFlopDone = true;
      if (betSeen) {
        tally.foldCbetOpps += 1;
        if (isFold(a)) tally.foldCbets += 1;
      } else if (pfa === heroName) {
        tally.cbetOpps += 1;
        if (aggressive) tally.cbets += 1;
      }
    }
    if (a.player !== heroName && aggressive) betSeen = true;
  });

  // Aggression factor: postflop bets/raises divided by postflop calls.
  actions.forEach((a) => {
    if (a.street === 'preflop' || a.player !== heroName) return;
    if (isAggressiveAction(a)) tally.postAgg += 1;
    else if (isCall(a)) tally.postCalls += 1;
  });
}

/** One recorded hand's contribution to a player's stats. */
export function handTally(rec, playerName) {
  const tally = emptyCounts();
  tallyHand(rec, playerName, tally);
  return tally;
}

export function summarizeStats(tally) {
  const af = tally.postCalls > 0
    ? Math.round((tally.postAgg / tally.postCalls) * 100) / 100
    : (tally.postAgg > 0 ? Number.POSITIVE_INFINITY : null);
  return {
    hands: tally.hands,
    vpip: pct(tally.vpip, tally.hands),
    pfr: pct(tally.pfr, tally.hands),
    threeBet: pct(tally.threeBets, tally.threeBetOpps),
    ats: pct(tally.steals, tally.stealOpps),
    cbet: pct(tally.cbets, tally.cbetOpps),
    foldToCbet: pct(tally.foldCbets, tally.foldCbetOpps),
    af,
    counts: tally,
  };
}

/** Session stats for one player from the recorded hands of a session. */
export function computePlayerStats(handRecords, playerName) {
  const tally = emptyCounts();
  (handRecords || []).forEach((rec) => tallyHand(rec, playerName, tally));
  return summarizeStats(tally);
}

/**
 * Simulated VPIP/PFR/3-bet for one playstyle. The style sits in a table of
 * common opponent styles and only the preflop betting runs: those three stats
 * are preflop-only, so this measures the real decision code without paying for
 * thousands of postflop equity simulations.
 */
const OPPONENT_MIX = ['tag', 'lag', 'nit', 'calling_station', 'shark', 'rock', 'maniac'];

/**
 * Simulate preflop hands for one style or one profile. Returns summary stats,
 * and with `collectRows` also the compact per-hand tallies so a caller can
 * keep a rolling window.
 */
export function simulateStyleStats({ styleId, profile = null, seats = 6, hands = 1200, difficulty = 'medium', live = false, collectRows = false }) {
  const tally = emptyCounts();
  const rows = collectRows ? [] : null;
  const tableSize = Math.max(2, Math.min(10, Number(seats) || 6));
  const heroStyle = profile ? null : resolveStyle(styleId);
  for (let n = 0; n < hands; n += 1) {
    const deck = generateGoDeck('nlh');
    const players = [];
    const holes = {};
    for (let i = 0; i < tableSize; i += 1) {
      players.push({ name: i === 0 ? '__hero__' : `opp${i}`, seat: i, stack: 10000 });
      holes[i] = [deck.pop(), deck.pop()];
    }
    const styles = players.map((_, i) => (i === 0 ? heroStyle : OPPONENT_MIX[(n + i) % OPPONENT_MIX.length]));
    const buttonSeat = n % tableSize;
    const sbSeat = (buttonSeat + (tableSize === 2 ? 0 : 1)) % tableSize;
    const bbSeat = (buttonSeat + (tableSize === 2 ? 1 : 2)) % tableSize;
    const positions = {};
    const order = Array.from({ length: tableSize }, (_, i) => (sbSeat + i) % tableSize);
    order.forEach((seat, i) => {
      if (i === 0) positions[players[seat].name] = tableSize === 2 ? 'BTN' : 'SB';
      else if (i === 1) positions[players[seat].name] = 'BB';
      else if (i === tableSize - 1) positions[players[seat].name] = 'BTN';
      else if (i === tableSize - 2) positions[players[seat].name] = 'CO';
      else positions[players[seat].name] = `MP${i - 1}`;
    });
    let hand = startHand({
      players,
      smallBlind: 50,
      bigBlind: 100,
      anteType: 'bba',
      anteAmount: 100,
      mode: 'cash',
      variant: 'nlh',
      blindSeats: { sbSeat, bbSeat },
      tableSize,
    }, buttonSeat, n + 1);
    let guard = 0;
    while (hand && hand.phase === 'playing' && hand.street === 'preflop' && hand.currentPlayer >= 0 && guard < 100) {
      guard += 1;
      const idx = hand.currentPlayer;
      const action = decideBotAction({
        hand,
        playerIndex: idx,
        holeCards: holes[hand.players[idx].id],
        styleId: styles[idx],
        profile: idx === 0 ? profile : null,
        difficulty,
        live,
      });
      let res = applyAction(hand, idx, action.type, action.amount);
      if (res && res.error) res = applyAction(hand, idx, action.type === 'raise' ? 'call' : 'check');
      if (res && res.error) res = applyAction(hand, idx, 'fold');
      if (!res || res.error) break;
      hand = res;
    }
    if (hand && Array.isArray(hand.actionHistory)) {
      const delta = emptyCounts();
      tallyHand({ actions: hand.actionHistory, positions }, '__hero__', delta);
      addCounts(tally, delta);
      if (rows) rows.push(countsToRow(delta));
    }
  }
  return collectRows ? { stats: summarizeStats(tally), rows } : summarizeStats(tally);
}
