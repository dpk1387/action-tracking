import { startHand, applyAction, positionForSeat } from '@/lib/poker';
import { decideBotAction, resolveStyle } from '@/lib/bots';
import { generateGoDeck } from '@/lib/goMode';

const STEAL_POSITIONS = new Set(['CO', 'BTN', 'SB', 'D', 'D/SB']);
const FORCED_TYPES = new Set(['sb', 'bb', 'bba', '3b', '4b', 'straddle', 'ante', 'btn_ante', 'kill']);

const isFold = (a) => /^fold$/i.test(a.action || '');
const isCheck = (a) => /^check$/i.test(a.action || '');
const isCall = (a) => /^call/i.test(a.action || '');
const isForced = (a) => FORCED_TYPES.has(String(a.type || a.action || '').toLowerCase());
/** actionHistory stores display labels ("Bet", "3-bet", "All-in"), not types. */
export const isAggressiveAction = (a) => /^(bet|raise|all[- ]?in|\d+-bet)/i.test(a.action || '');

function isActionAggressive(a, beforeLevel = null) {
  if (a.isAggressive != null) return Boolean(a.isAggressive);
  if (isCall(a) || isFold(a) || isCheck(a)) return false;
  if (/^(bet|raise|\d+-bet)/i.test(a.action || '')) return true;
  if (/^all[- ]?in$/i.test(a.action || '')) {
    if (beforeLevel != null && a.raiseLevel != null && Number(a.raiseLevel) <= beforeLevel && beforeLevel > 0) {
      return false;
    }
    return true;
  }
  return false;
}

function isCallAction(a, beforeLevel = null) {
  if (isCall(a)) return true;
  if (/^all[- ]?in$/i.test(a.action || '') && !isActionAggressive(a, beforeLevel)) return true;
  return false;
}

function normPos(pos) {
  if (!pos) return '';
  if (pos === 'BTN' || pos === 'D/SB') return 'D';
  if (/^UTG\+\d+$/.test(pos)) return pos.slice(3);
  return pos;
}

const COUNT_KEYS = [
  'hands', 'vpip', 'pfr', 'threeBetOpps', 'threeBets', 'stealOpps', 'steals',
  'cbetOpps', 'cbets', 'foldCbetOpps', 'foldCbets', 'postAgg', 'postCalls', 'vpipOpps',
  'rfiOpps', 'rfis', 'fold3BetOpps', 'fold3Bets', 'foldStealOpps', 'foldSteals',
  'limpOpps', 'limps', 'postFolds', 'sawFlop', 'wtsd', 'wsd', 'wonPostflop',
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
    vpipOpps: 0,
    rfiOpps: 0,
    rfis: 0,
    fold3BetOpps: 0,
    fold3Bets: 0,
    foldStealOpps: 0,
    foldSteals: 0,
    limpOpps: 0,
    limps: 0,
    postFolds: 0,
    sawFlop: 0,
    wtsd: 0,
    wsd: 0,
    wonPostflop: 0,
  };
}

/** Compact per-hand tally used for rolling stat windows. */
export function countsToRow(counts) {
  return COUNT_KEYS.map((k) => Number(counts?.[k]) || 0);
}

export function rowToCounts(row) {
  const out = emptyCounts();
  COUNT_KEYS.forEach((k, i) => {
    if (k === 'vpipOpps' && row?.[i] == null) out[k] = out.hands;
    else out[k] = Number(row?.[i]) || 0;
  });
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
  const players = rec.players || [];
  if (Array.isArray(players) && players.length > 0 && !players.some((p) => p.name === heroName)) {
    return;
  }
  const actions = rec.actions || [];
  const rawPositions = rec.positions || {};
  const posByName = {};
  const hasSeatsAndBtn = rec.buttonSeat != null && players.some((p) => p?.seat != null);
  const sortedForPos = hasSeatsAndBtn ? [...players].sort((a, b) => a.seat - b.seat) : players;
  const btnIdxForPos = hasSeatsAndBtn ? sortedForPos.findIndex((p) => p.seat === rec.buttonSeat) : -1;
  players.forEach((p) => {
    if (!p?.name) return;
    let resolved = rawPositions[p.name] || p.position || '';
    if (!resolved && btnIdxForPos >= 0) {
      const sIdx = sortedForPos.findIndex((x) => x.name === p.name);
      if (sIdx >= 0) resolved = positionForSeat(sortedForPos.length, btnIdxForPos, sIdx, rec.variant);
    }
    posByName[p.name] = normPos(resolved);
  });
  Object.entries(rawPositions).forEach(([name, pos]) => {
    if (!posByName[name]) posByName[name] = normPos(pos);
  });
  const posOf = (name) => posByName[name] || '';

  tally.hands += 1;

  const pre = actions.filter((a) => (a.street || 'preflop') === 'preflop' && !isForced(a));
  let level = 1;
  let firstIn = true;
  let heroVpip = false;
  let heroPfr = false;
  let heroFirstPreDone = false;
  let heroOpenRaised = false;
  let heroActedVsOpen = false;
  let heroFacedThreeBetDone = false;
  let stealOpenActive = false;
  let stealerName = null;
  let heroFacedStealDone = false;
  const heroPos = posOf(heroName);

  pre.forEach((a) => {
    const before = level;
    const aggressive = isActionAggressive(a, before);
    const lvlAfter = Math.max(before, Number(a.raiseLevel) || (aggressive && before <= 1 ? 2 : before));

    if (a.player === heroName) {
      const chips = Number(a.chips) || 0;
      if (!isFold(a) && !isCheck(a) && (chips > 0 || aggressive)) heroVpip = true;
      if (aggressive && lvlAfter >= 2) heroPfr = true;

      if (!heroFirstPreDone) {
        heroFirstPreDone = true;
        // RFI% = open raises / unopened pot opportunities
        if (before <= 1 && firstIn) {
          tally.rfiOpps += 1;
          if (aggressive && lvlAfter >= 2) {
            tally.rfis += 1;
            heroOpenRaised = true;
          }
        }
        // Limp% = (open-limps + over-limps) / opportunities to limp (BB cannot limp)
        if (before <= 1 && heroPos !== 'BB') {
          tally.limpOpps += 1;
          if (!isFold(a) && !isCheck(a) && !aggressive) {
            tally.limps += 1;
          }
        }
        // ATS% = unopened open-raises from CO, D/BTN, SB
        if (STEAL_POSITIONS.has(heroPos) && before <= 1 && firstIn) {
          tally.stealOpps += 1;
          if (aggressive && lvlAfter >= 2) tally.steals += 1;
        }
      }

      // 3-bet%: facing an open raise (level === 2)
      if (before === 2 && !heroActedVsOpen) {
        heroActedVsOpen = true;
        tally.threeBetOpps += 1;
        if (aggressive && lvlAfter >= 3) tally.threeBets += 1;
      }

      // Fold to 3-bet%: folds to 3-bet / times faced 3-bet after open-raising
      if (heroOpenRaised && before === 3 && !heroFacedThreeBetDone) {
        heroFacedThreeBetDone = true;
        tally.fold3BetOpps += 1;
        if (isFold(a)) tally.fold3Bets += 1;
      }

      // Fold to Steal%: folds in SB/BB to late steal (unopened open-raise from CO, D/BTN, or SB)
      if ((heroPos === 'SB' || heroPos === 'BB') && stealOpenActive && before === 2 && stealerName !== heroName && !heroFacedStealDone) {
        heroFacedStealDone = true;
        tally.foldStealOpps += 1;
        if (isFold(a)) tally.foldSteals += 1;
      }
    } else {
      if (before <= 1 && firstIn && aggressive && lvlAfter === 2) {
        const actorPos = posOf(a.player);
        if (STEAL_POSITIONS.has(actorPos)) {
          stealOpenActive = true;
          stealerName = a.player;
        }
      }
      if (!isFold(a)) firstIn = false;
      if (lvlAfter >= 3) {
        stealOpenActive = false;
      }
    }
    level = lvlAfter;
  });

  // Big blind walks (everyone folds preflop to the BB) do not count toward the VPIP denominator.
  const isBbWalk = heroPos === 'BB'
    && !heroVpip
    && pre.length > 0
    && pre.every((a) => a.player !== heroName && isFold(a))
    && !(rec.communityCards && rec.communityCards.length > 0);
  if (!isBbWalk) tally.vpipOpps += 1;

  if (heroVpip) tally.vpip += 1;
  if (heroPfr) tally.pfr += 1;

  // Continuation bets are measured on the flop against the preflop aggressor.
  const pfa = [...pre].reverse().find((a) => isActionAggressive(a, 1) && (Number(a.raiseLevel) || 0) >= 2)?.player;
  const flop = actions.filter((a) => a.street === 'flop');
  let cbetActive = false;
  let donkSeen = false;
  let pfaActedFlop = false;
  let heroFacedCbetDone = false;
  flop.forEach((a) => {
    const aggressive = isActionAggressive(a, cbetActive || donkSeen ? 1 : 0);
    if (a.player === heroName) {
      if (cbetActive && !heroFacedCbetDone && pfa !== heroName) {
        heroFacedCbetDone = true;
        tally.foldCbetOpps += 1;
        if (isFold(a)) tally.foldCbets += 1;
      } else if (!cbetActive && !donkSeen && !pfaActedFlop && pfa === heroName) {
        tally.cbetOpps += 1;
        if (aggressive) tally.cbets += 1;
      }
    }
    if (aggressive) {
      if (!cbetActive && !donkSeen && !pfaActedFlop) {
        if (a.player === pfa) cbetActive = true;
        else donkSeen = true;
      } else if (cbetActive) {
        cbetActive = false;
      }
    }
    if (a.player === pfa) pfaActedFlop = true;
  });

  // Postflop aggression: AF = (bets + raises) / calls; AFq = (bets + raises) / (bets + raises + calls + folds)
  let postLevel = 0;
  let lastPostStreet = null;
  actions.forEach((a) => {
    const st = a.street || 'preflop';
    if (st === 'preflop') return;
    if (st !== lastPostStreet) {
      lastPostStreet = st;
      postLevel = 0;
    }
    const aggressive = isActionAggressive(a, postLevel);
    if (a.player === heroName) {
      if (aggressive) tally.postAgg += 1;
      else if (isCallAction(a, postLevel)) tally.postCalls += 1;
      else if (isFold(a)) tally.postFolds += 1;
    }
    postLevel = Math.max(postLevel, Number(a.raiseLevel) || (aggressive ? Math.max(1, postLevel + 1) : postLevel));
  });

  // Flop / Showdown / Postflop Winning stats (WWSF%, WTSD%, W$SD%)
  const realComm = (rec.communityCards || []).filter((c) => c && !c.hidden);
  const hasPostActions = actions.some((a) => a.street && a.street !== 'preflop');
  const hasFlop = realComm.length >= 3 || hasPostActions;
  const heroFoldedPre = pre.some((a) => a.player === heroName && isFold(a));
  if (hasFlop && !heroFoldedPre) {
    tally.sawFlop += 1;
    const heroPlayerObj = players.find((p) => p.name === heroName);
    const heroPid = heroPlayerObj?.id;
    const heroWon = heroPid != null
      && (rec.winners || []).some((w) => w.playerId === heroPid && (w.amount == null || Number(w.amount) > 0));
    if (heroWon) tally.wonPostflop += 1;

    const foldedSet = new Set(actions.filter(isFold).map((a) => a.player));
    const heroFoldedAny = foldedSet.has(heroName);
    const nonFoldedCount = players.filter((p) => !foldedSet.has(p.name)).length;
    const wentToShowdown = !heroFoldedAny && nonFoldedCount >= 2 && (rec.winners || []).length > 0;
    if (wentToShowdown) {
      tally.wtsd += 1;
      if (heroWon) tally.wsd += 1;
    }
  }
}

/** One recorded hand's contribution to a player's stats. */
export function handTally(rec, playerName) {
  const tally = emptyCounts();
  tallyHand(rec, playerName, tally);
  return tally;
}

export function summarizeStats(tally) {
  const af = tally.postCalls > 0
    ? Math.round((tally.postAgg / tally.postCalls) * 10) / 10
    : (tally.postAgg > 0 ? Number.POSITIVE_INFINITY : null);
  const vpipOpps = tally.vpipOpps != null ? tally.vpipOpps : tally.hands;
  const afqDenom = (tally.postAgg || 0) + (tally.postCalls || 0) + (tally.postFolds || 0);
  return {
    hands: tally.hands,
    vpip: pct(tally.vpip, vpipOpps),
    pfr: pct(tally.pfr, tally.hands),
    rfi: pct(tally.rfis || 0, tally.rfiOpps || 0),
    limp: pct(tally.limps || 0, tally.limpOpps || 0),
    threeBet: pct(tally.threeBets, tally.threeBetOpps),
    foldToThreeBet: pct(tally.fold3Bets || 0, tally.fold3BetOpps || 0),
    ats: pct(tally.steals, tally.stealOpps),
    foldToSteal: pct(tally.foldSteals || 0, tally.foldStealOpps || 0),
    cbet: pct(tally.cbets, tally.cbetOpps),
    foldToCbet: pct(tally.foldCbets, tally.foldCbetOpps),
    af,
    afq: pct(tally.postAgg || 0, afqDenom),
    wwsf: pct(tally.wonPostflop || 0, tally.sawFlop || 0),
    wtsd: pct(tally.wtsd || 0, tally.sawFlop || 0),
    wsd: pct(tally.wsd || 0, tally.wtsd || 0),
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
    players.forEach((p, seatIdx) => {
      positions[p.name] = positionForSeat(tableSize, buttonSeat, seatIdx);
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
      tallyHand({ actions: hand.actionHistory, positions, communityCards: hand.communityCards }, '__hero__', delta);
      addCounts(tally, delta);
      if (rows) rows.push(countsToRow(delta));
    }
  }
  return collectRows ? { stats: summarizeStats(tally), rows } : summarizeStats(tally);
}
