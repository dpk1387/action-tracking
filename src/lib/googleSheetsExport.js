import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  money,
  formatBlinds,
  positionForSeat,
  POS,
  shortDeckPositions,
} from '@/lib/poker';
import { sortGoHoleCards } from '@/lib/goMode';
import { computePlayerStats } from '@/lib/botStats';

// Initialize Firebase App
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

export async function getGoogleAccessToken() {
  if (cachedAccessToken) return cachedAccessToken;

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Failed to obtain Google Sheets access token');
  }
  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
}

const SUIT_UNICODE = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
  '♠': '♠',
  '♥': '♥',
  '♦': '♦',
  '♣': '♣',
};

const STYLE_NAME_MAP = {
  tag: 'TAG',
  lag: 'LAG',
  calling_station: 'Calling Station',
  rock: 'Rock',
  nit: 'Nit',
  shark: 'Shark',
  maniac: 'Maniac',
  sss: 'Short Stack Specialist',
  random: 'Random',
};

export function formatSingleCard(c) {
  if (!c) return '';
  if (typeof c === 'string') {
    const trimmed = c.trim();
    if (!trimmed || trimmed === '?') return trimmed;
    const s = trimmed.slice(-1);
    const r = trimmed.slice(0, -1);
    const rDisp = (r === 'T' || r === 't') ? '10' : r;
    return `${rDisp}${SUIT_UNICODE[s] || s}`;
  }
  if (c.hidden) return '?';
  const s = SUIT_UNICODE[c.suit] || c.suit || '';
  const rDisp = (c.rank === 'T' || c.rank === 't') ? '10' : (c.rank || '');
  return `${rDisp}${s}`;
}

export function formatCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return '';
  return cards
    .map(formatSingleCard)
    .filter(Boolean)
    .join(' ');
}

export function shouldResolveEffectiveActions(hand, options = {}) {
  const explicitGameType = options.gameType || hand?.gameType;
  const isBotsLive = explicitGameType === 'live' || options.live === true || hand?.isLive === true;
  if (isBotsLive) return false;
  const amountsHidden = options.hideAmounts === true || hand?.hideAmounts === true;
  if (amountsHidden) return false;
  return true;
}

export function resolveEffectiveOnlineActions(hand, rawHistory, seatedPlayers) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return rawHistory;

  const streetOrder = ['preflop', 'flop', 'turn', 'river', 'ocean'];
  const blindTypes = new Set(['sb', 'bb', 'bba', '3b', '4b', 'straddle', 'ante', 'btn_ante', 'kill']);

  const playerKey = (act) => {
    if (act.playerId != null) {
      const idx = seatedPlayers.findIndex((pl) => pl.id === act.playerId);
      if (idx >= 0) return idx;
    }
    if (act.player) {
      const idx = seatedPlayers.findIndex((pl) => pl.name === act.player);
      if (idx >= 0) return idx;
    }
    if (act.seat != null) {
      const idx = seatedPlayers.findIndex((pl) => pl.seat === Number(act.seat));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const initLiveStack = {};
  const actualLiveTotal = {};
  const anteType = String(hand.effectiveAnteType || hand.anteType || '').toLowerCase();
  const isBombPot = Boolean(hand.bombPot || hand.variant === 'bomb_pot' || hand.variant === 'double_board_bomb_pot');
  const anteAmt = isBombPot ? (Number(hand.bombAmount ?? hand.anteAmount) || 0) : (Number(hand.anteAmount) || 0);
  const bbAmt = Number(hand.bigBlind) || 0;
  const sbAmt = Number(hand.smallBlind) || 0;

  seatedPlayers.forEach((pl, idx) => {
    const startSt = pl.initialStack != null ? Number(pl.initialStack) : (pl.stack != null ? Number(pl.stack) : 0);
    let deadAnte = 0;
    if (pl.antePaid != null) {
      deadAnte = Math.min(startSt, Math.max(0, Number(pl.antePaid) || 0));
    } else if (anteAmt > 0) {
      if (isBombPot || anteType === 'traditional' || hand.variant === 'short_deck') {
        deadAnte = Math.min(anteAmt, startSt);
      } else if ((anteType === 'bba' || anteType === 'sb_half_ante') && hand.bbSeat != null && Number(pl.seat) === Number(hand.bbSeat)) {
        const bbPost = Math.min(bbAmt, startSt);
        deadAnte = Math.min(anteAmt, Math.max(0, startSt - bbPost));
      } else if (anteType === 'btn_ante' && hand.buttonSeat != null && Number(pl.seat) === Number(hand.buttonSeat)) {
        deadAnte = Math.min(anteAmt, startSt);
      }
    }
    initLiveStack[idx] = Math.max(0, startSt - deadAnte);
    actualLiveTotal[idx] = pl.totalBet != null ? Math.max(0, Number(pl.totalBet) - deadAnte) : null;
  });

  const byStreet = {};
  streetOrder.forEach((st) => { byStreet[st] = []; });
  rawHistory.forEach((act, seqIdx) => {
    const st = (act.street || 'preflop').toLowerCase();
    if (!byStreet[st]) byStreet[st] = [];
    byStreet[st].push({ act, seqIdx });
  });

  const remLiveStack = { ...initLiveStack };
  const hasFolded = {};
  seatedPlayers.forEach((_, idx) => { hasFolded[idx] = false; });
  const streetInfo = {};

  streetOrder.forEach((st) => {
    const list = byStreet[st] || [];
    if (list.length === 0 && st !== 'preflop') return;

    const foldedAtStreetStart = { ...hasFolded };
    const rawContrib = {};
    seatedPlayers.forEach((_, idx) => { rawContrib[idx] = 0; });

    if (st === 'preflop' && !isBombPot) {
      const hasBlindActs = list.some(({ act }) => blindTypes.has(String(act.type || act.action || '').toLowerCase()));
      if (!hasBlindActs) {
        if (hand.variant === 'short_deck') {
          if (hand.buttonSeat != null && anteAmt > 0) {
            const btnIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.buttonSeat));
            if (btnIdx >= 0) {
              rawContrib[btnIdx] = Math.min(anteAmt, remLiveStack[btnIdx]);
            }
          }
        } else {
          if (hand.sbSeat != null) {
            const sbIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.sbSeat));
            if (sbIdx >= 0) {
              rawContrib[sbIdx] = Math.min(sbAmt, remLiveStack[sbIdx]);
            }
          }
          if (hand.bbSeat != null) {
            const bbIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.bbSeat));
            if (bbIdx >= 0) {
              rawContrib[bbIdx] = Math.min(bbAmt, remLiveStack[bbIdx]);
            }
          }
        }
      }
    }

    const perActionRaw = [];
    list.forEach(({ act, seqIdx }) => {
      const pIdx = playerKey(act);
      const rawName = String(act.action || act.type || '');
      const lower = rawName.toLowerCase();
      if (pIdx < 0) {
        perActionRaw.push({ act, seqIdx, pIdx, rawBetTo: 0, isBlind: false });
        return;
      }
      if (lower === 'fold') {
        hasFolded[pIdx] = true;
        perActionRaw.push({ act, seqIdx, pIdx, rawBetTo: rawContrib[pIdx], isFold: true });
        return;
      }
      if (lower === 'check') {
        perActionRaw.push({ act, seqIdx, pIdx, rawBetTo: rawContrib[pIdx], isCheck: true });
        return;
      }
      const isBlind = blindTypes.has(lower);
      let newBetTo = rawContrib[pIdx];
      if (act.betTo != null) {
        newBetTo = Number(act.betTo);
      } else if (lower === 'call') {
        const pay = Number(act.callAmount != null ? act.callAmount : act.chips) || 0;
        newBetTo = rawContrib[pIdx] + pay;
      } else if (/^all[- ]?in$/i.test(rawName)) {
        newBetTo = remLiveStack[pIdx];
      } else if (isBlind) {
        if (['straddle', 'kill', 'sb', 'bb', '3b', '4b', 'btn_ante'].includes(lower)) {
          newBetTo = Number(act.chips ?? act.amount) || rawContrib[pIdx];
        }
      } else {
        newBetTo = Number(act.chips ?? act.amount) || rawContrib[pIdx];
      }
      newBetTo = Math.min(remLiveStack[pIdx], Math.max(rawContrib[pIdx], newBetTo));
      rawContrib[pIdx] = newBetTo;
      perActionRaw.push({ act, seqIdx, pIdx, rawBetTo: newBetTo, isBlind });
    });

    const contendersEnd = seatedPlayers
      .map((_, idx) => idx)
      .filter((idx) => !hasFolded[idx] && remLiveStack[idx] > 0);

    streetInfo[st] = {
      rawContrib,
      remStart: { ...remLiveStack },
      foldedAtStreetStart,
      contendersEnd,
      perActionRaw,
    };

    seatedPlayers.forEach((_, idx) => {
      remLiveStack[idx] = Math.max(0, remLiveStack[idx] - rawContrib[idx]);
    });
  });

  const activeStreets = streetOrder.filter((st) => streetInfo[st]);
  const nonFoldedAtHandEnd = seatedPlayers.filter((_, idx) => !hasFolded[idx]).length;

  if (nonFoldedAtHandEnd >= 2) {
    const totalRawLive = {};
    seatedPlayers.forEach((_, idx) => { totalRawLive[idx] = 0; });
    activeStreets.forEach((st) => {
      const info = streetInfo[st];
      seatedPlayers.forEach((_, idx) => {
        totalRawLive[idx] += info.rawContrib[idx] || 0;
      });
    });

    seatedPlayers.forEach((_, idx) => {
      const actual = actualLiveTotal[idx];
      const rawTot = totalRawLive[idx];
      let excessToRemove = actual != null && rawTot > actual ? (rawTot - actual) : 0;
      if (excessToRemove > 0) {
        for (let i = activeStreets.length - 1; i >= 0 && excessToRemove > 0; i--) {
          const info = streetInfo[activeStreets[i]];
          const c = info.rawContrib[idx] || 0;
          if (c > 0) {
            const cut = Math.min(c, excessToRemove);
            info.rawContrib[idx] = c - cut;
            excessToRemove -= cut;
          }
        }
      }
    });
  }

  activeStreets.forEach((st) => {
    const info = streetInfo[st];
    if (info.contendersEnd.length >= 2) {
      const entries = seatedPlayers
        .map((_, idx) => ({ idx, val: info.rawContrib[idx] || 0 }))
        .sort((a, b) => b.val - a.val);
      if (entries.length >= 2 && entries[0].val > entries[1].val) {
        info.rawContrib[entries[0].idx] = entries[1].val;
      }
    }
  });

  const rewrittenBySeq = {};
  activeStreets.forEach((st) => {
    const info = streetInfo[st];
    const effFinal = info.rawContrib;
    const foldedSoFar = { ...info.foldedAtStreetStart };
    const currBet = {};
    seatedPlayers.forEach((_, idx) => { currBet[idx] = 0; });

    let effMaxBet = 0;
    let effRaiseLevel = st === 'preflop' && !isBombPot ? 1 : 0;

    if (st === 'preflop' && !isBombPot) {
      const hasBlindActs = info.perActionRaw.some((x) => x.isBlind);
      if (!hasBlindActs) {
        if (hand.variant === 'short_deck') {
          if (hand.buttonSeat != null && anteAmt > 0) {
            const btnIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.buttonSeat));
            if (btnIdx >= 0) currBet[btnIdx] = Math.min(anteAmt, effFinal[btnIdx], info.remStart[btnIdx]);
          }
          effMaxBet = Math.max(anteAmt, ...Object.values(currBet));
        } else {
          if (hand.sbSeat != null) {
            const sbIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.sbSeat));
            if (sbIdx >= 0) currBet[sbIdx] = Math.min(sbAmt, effFinal[sbIdx], info.remStart[sbIdx]);
          }
          if (hand.bbSeat != null) {
            const bbIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.bbSeat));
            if (bbIdx >= 0) currBet[bbIdx] = Math.min(bbAmt, effFinal[bbIdx], info.remStart[bbIdx]);
          }
          effMaxBet = Math.max(bbAmt, ...Object.values(currBet));
        }
      } else {
        effMaxBet = Math.max(bbAmt, ...Object.values(currBet));
      }
    }

    info.perActionRaw.forEach(({ act, seqIdx, pIdx, rawBetTo, isFold, isCheck, isBlind }) => {
      if (isFold) {
        if (pIdx >= 0) foldedSoFar[pIdx] = true;
        rewrittenBySeq[seqIdx] = act;
        return;
      }
      if (pIdx < 0 || isCheck) {
        rewrittenBySeq[seqIdx] = act;
        return;
      }
      if (isBlind) {
        currBet[pIdx] = Math.min(rawBetTo, effFinal[pIdx]);
        effMaxBet = Math.max(effMaxBet, currBet[pIdx]);
        rewrittenBySeq[seqIdx] = act;
        return;
      }

      let maxCap = effFinal[pIdx];
      if (info.contendersEnd.length <= 1) {
        const maxOppRem = Math.max(
          0,
          ...seatedPlayers.map((_, qIdx) => (qIdx !== pIdx && !foldedSoFar[qIdx] ? info.remStart[qIdx] : 0))
        );
        if (maxOppRem > 0) {
          maxCap = Math.min(maxCap, maxOppRem);
        }
      }

      const effBetTo = Math.max(currBet[pIdx], Math.min(rawBetTo, maxCap));
      const effPay = Math.max(0, effBetTo - currBet[pIdx]);
      const isEffectiveAllIn = info.remStart[pIdx] > 0 && effBetTo >= info.remStart[pIdx];

      let nextAction = act.action;
      let nextChips = act.chips;
      let nextRaiseLevel = act.raiseLevel;
      let nextAggressive = act.isAggressive;

      if (effMaxBet === 0) {
        if (effBetTo > 0) {
          effMaxBet = effBetTo;
          effRaiseLevel = 1;
          nextAction = isEffectiveAllIn ? 'All-in' : 'Bet';
          nextChips = effBetTo;
          nextRaiseLevel = 1;
          nextAggressive = true;
        } else if (isEffectiveAllIn || /^all[- ]?in$/i.test(act.action || '')) {
          nextAction = 'All-in';
          nextChips = 0;
          nextRaiseLevel = 1;
          nextAggressive = true;
        }
      } else if (effBetTo > effMaxBet) {
        effMaxBet = effBetTo;
        effRaiseLevel = Math.max(effRaiseLevel + 1, 2);
        nextAction = effRaiseLevel >= 3 ? `${effRaiseLevel}-bet` : 'Raise';
        nextChips = effBetTo;
        nextRaiseLevel = effRaiseLevel;
        nextAggressive = true;
      } else {
        nextAction = 'Call';
        nextChips = effPay;
        nextRaiseLevel = effRaiseLevel;
        nextAggressive = false;
      }

      currBet[pIdx] = effBetTo;
      rewrittenBySeq[seqIdx] = {
        ...act,
        action: nextAction,
        chips: nextChips,
        raiseLevel: nextRaiseLevel,
        isAggressive: nextAggressive,
      };
    });
  });

  return rawHistory.map((act, idx) => rewrittenBySeq[idx] || act);
}

export function buildHandRows(hand, options = {}) {
  const isBB = options.unit === 'bb' || options.displayUnit === 'bb';
  const bb = Number(hand.bigBlind) || 1;
  const fmtVal = (num) => {
    if (num == null || num === '') return '';
    const val = Number(num) / bb;
    return Number.isInteger(val) ? `${val}` : val.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
  };

  const isTourney = Boolean(
    hand.mode === 'tournament' ||
    hand.tournament ||
    hand.isTourney ||
    hand.tournamentId ||
    (Array.isArray(hand.blindSchedule) && hand.blindSchedule.length > 0)
  );
  const cur = (isTourney || isBB) ? '' : (hand.currency !== undefined ? hand.currency : '$');
  const players = hand.players || [];

  const hasSeats = players.some((p) => p && p.seat != null);
  const seatedPlayers = hasSeats
    ? players.filter((p) => p && p.seat != null).sort((a, b) => a.seat - b.seat)
    : players.filter(Boolean);

  const n = seatedPlayers.length;

  const blindsText = formatBlinds(hand);
  const potVal = (hand.pots || []).reduce((sum, pt) => sum + (pt.amount || 0), 0)
    || players.reduce((sum, p) => sum + (p.totalBet || 0), 0);
  const potText = isBB ? `Pot ${fmtVal(potVal)}` : `Pot ${money(potVal, cur)}`;
  const headerRow = [`Hand #${hand.handNumber}   ·   ${blindsText}   ·   ${potText}`];

  const bCards = formatCards(hand.communityCards);
  const bCardsB = Array.isArray(hand.boardB) && hand.boardB.length > 0 ? formatCards(hand.boardB) : '';
  const bCardsC = Array.isArray(hand.boardC) && hand.boardC.length > 0 ? formatCards(hand.boardC) : '';
  const boardVal = bCardsB
    ? (bCardsC ? `Board 1: ${bCards}   |   Board 2: ${bCardsB}   |   Board 3: ${bCardsC}` : `Board 1: ${bCards}   |   Board 2: ${bCardsB}`)
    : bCards;
  const boardRow = ['Board', boardVal];

  const biSeated = hand.buttonSeat != null
    ? seatedPlayers.findIndex((p) => Number(p.seat) === Number(hand.buttonSeat))
    : -1;
  const resolveSeatPos = (p, sIdx) => {
    if (biSeated >= 0) return positionForSeat(n, biSeated, sIdx, hand.variant);
    if (hand.sbSeat != null) {
      const sbIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.sbSeat));
      if (sbIdx >= 0) {
        if (n === 2) return sIdx === sbIdx ? 'D/SB' : 'BB';
        const posList = (hand.variant === 'short_deck'
          ? shortDeckPositions(n + 1)
          : (POS[n + 1] || POS[10])
        ).filter((x) => x !== 'BTN');
        const offset = (sIdx - sbIdx + n) % n;
        return posList[offset] || '';
      }
    }
    if (hand.bbSeat != null) {
      const bbIdx = seatedPlayers.findIndex((pl) => Number(pl.seat) === Number(hand.bbSeat));
      if (bbIdx >= 0) {
        if (n === 2) return sIdx === bbIdx ? 'BB' : 'D/SB';
        const posList = (hand.variant === 'short_deck'
          ? shortDeckPositions(n + 1)
          : (POS[n + 1] || POS[10])
        ).filter((x) => x !== 'BTN' && x !== 'SB');
        const offset = (sIdx - bbIdx + n) % n;
        return posList[offset] || '';
      }
    }
    return p.position || '';
  };

  const seatHeaderRow = [''];
  seatedPlayers.forEach((p, sIdx) => {
    let pos = resolveSeatPos(p, sIdx);
    if (/^UTG\+\d+$/.test(pos)) pos = pos.slice(3);
    if (pos === 'BTN' || pos === 'D' || pos === 'D/SB') pos = n === 2 ? 'D/SB' : 'BTN';
    const label = pos ? `${p.name} · ${pos}` : p.name;
    seatHeaderRow.push(label);
  });

  const stackRow = ['Stack'];
  seatedPlayers.forEach((p) => {
    const st = p.initialStack != null ? p.initialStack : p.stack;
    stackRow.push(st != null ? (isBB ? fmtVal(st) : money(st, cur)) : '');
  });

  const holeCardsMap = hand.holeCards || hand._holeCards || {};
  const handRow = ['Hand'];
  seatedPlayers.forEach((p) => {
    const hc = holeCardsMap[p.id] ?? holeCardsMap[String(p.id)] ?? [];
    handRow.push(formatCards(sortGoHoleCards(hc)));
  });

  const rawActions = Array.isArray(hand.actions) && hand.actions.length > 0
    ? hand.actions
    : Array.isArray(hand.actionHistory)
    ? hand.actionHistory
    : [];

  const rawHistory = shouldResolveEffectiveActions(hand, options)
    ? resolveEffectiveOnlineActions(hand, rawActions, seatedPlayers)
    : rawActions;

  const streetOrder = ['preflop', 'flop', 'turn', 'river', 'ocean'];
  const actionsByStreet = {
    preflop: [],
    flop: [],
    turn: [],
    river: [],
    ocean: [],
  };

  rawHistory.forEach((act) => {
    const st = (act.street || 'preflop').toLowerCase();
    if (actionsByStreet[st]) {
      actionsByStreet[st].push(act);
    } else {
      actionsByStreet.preflop.push(act);
    }
  });

  const makeEmptyRow = (label = '') => {
    const row = [label];
    for (let i = 0; i < seatedPlayers.length; i++) row.push('');
    return row;
  };

  const getColForPlayer = (act) => {
    if (act.playerId != null) {
      const idx = seatedPlayers.findIndex((pl) => pl.id === act.playerId);
      if (idx >= 0) return idx + 1;
    }
    if (act.player) {
      const idx = seatedPlayers.findIndex((pl) => pl.name === act.player);
      if (idx >= 0) return idx + 1;
    }
    if (act.seat != null) {
      const idx = seatedPlayers.findIndex((pl) => pl.seat === Number(act.seat));
      if (idx >= 0) return idx + 1;
    }
    return -1;
  };

  const formatActionText = (act, fallbackRaiseLevel = 0) => {
    let actName = act.action || act.type || '';
    if (/^raise$/i.test(actName)) {
      const lvl = Number(act.raiseLevel) || fallbackRaiseLevel || 2;
      if (lvl >= 3) actName = `${lvl}-bet`;
    }
    const hasChips = act.chips != null || act.amount != null || act.callAmount != null;
    const chipsVal = act.chips != null ? act.chips : (act.callAmount != null ? act.callAmount : act.amount);
    let amtStr = '';
    if (hasChips && chipsVal > 0) {
      amtStr = isBB ? ` ${fmtVal(chipsVal)}` : ` ${money(chipsVal, cur)}`;
    }
    return `${actName}${amtStr}`.trim();
  };

  const nextStreetRaiseLevel = (act, currentLevel, isPreflop) => {
    if (act.raiseLevel != null && Number(act.raiseLevel) > 0) {
      return Math.max(currentLevel, Number(act.raiseLevel));
    }
    const raw = String(act.action || act.type || '');
    const m = raw.match(/^(\d+)-bet$/i);
    if (m) return Math.max(currentLevel, Number(m[1]));
    if (/^bet$/i.test(raw)) return Math.max(currentLevel, 1);
    if (/^raise$/i.test(raw)) return Math.max(currentLevel + 1, isPreflop ? 2 : 2);
    if (/^all[- ]?in$/i.test(raw) && act.isAggressive) return currentLevel + 1;
    return currentLevel;
  };

  const actionRows = [];
  const streetEndRowIndices = [];

  streetOrder.forEach((st) => {
    const acts = actionsByStreet[st];
    if (acts.length === 0 && st !== 'preflop') return;

    const streetLabel = st.charAt(0).toUpperCase() + st.slice(1);

    if (st === 'preflop') {
      const blinds = acts.filter((a) =>
        ['sb', 'bb', 'bba', '3b', '4b', 'straddle', 'ante', 'btn_ante', 'kill'].includes(String(a.type || a.action || '').toLowerCase())
      );
      const regular = acts.filter((a) => !blinds.includes(a));

      if (blinds.length > 0) {
        const blindRow = makeEmptyRow(streetLabel);
        blinds.forEach((b) => {
          const col = getColForPlayer(b);
          if (col > 0) {
            const txt = formatActionText(b);
            blindRow[col] = blindRow[col] ? `${blindRow[col]}, ${txt}` : txt;
          }
        });
        actionRows.push(blindRow);
      }

      let currentRow = blinds.length > 0 ? makeEmptyRow('') : makeEmptyRow(streetLabel);
      let lastColumnIndex = -1;
      let hasActionsInRow = false;
      let streetRaiseLevel = 1;

      regular.forEach((act) => {
        streetRaiseLevel = nextStreetRaiseLevel(act, streetRaiseLevel, true);
        const colIdx = getColForPlayer(act);
        if (colIdx <= 0) return;

        if (colIdx <= lastColumnIndex) {
          actionRows.push(currentRow);
          currentRow = makeEmptyRow('');
          hasActionsInRow = false;
        }

        currentRow[colIdx] = formatActionText(act, streetRaiseLevel);
        hasActionsInRow = true;
        lastColumnIndex = colIdx;
      });

      if (hasActionsInRow || (blinds.length === 0 && actionRows.length === 0)) {
        actionRows.push(currentRow);
      }
      streetEndRowIndices.push(actionRows.length - 1);
    } else {
      let currentRow = makeEmptyRow(streetLabel);
      let lastColumnIndex = -1;
      let hasActionsInRow = false;
      let streetRaiseLevel = 0;

      acts.forEach((act) => {
        streetRaiseLevel = nextStreetRaiseLevel(act, streetRaiseLevel, false);
        const colIdx = getColForPlayer(act);
        if (colIdx <= 0) return;

        if (colIdx <= lastColumnIndex) {
          actionRows.push(currentRow);
          currentRow = makeEmptyRow('');
          hasActionsInRow = false;
        }

        currentRow[colIdx] = formatActionText(act, streetRaiseLevel);
        hasActionsInRow = true;
        lastColumnIndex = colIdx;
      });

      if (hasActionsInRow) {
        actionRows.push(currentRow);
      }
      streetEndRowIndices.push(actionRows.length - 1);
    }
  });

  const winCellCoords = [];
  const winners = Array.isArray(hand.winners) ? hand.winners : [];
  if (winners.length > 0) {
    const winRow = makeEmptyRow('');
    const winRowOffset = actionRows.length;
    const wonByIdx = {};
    winners.forEach((w) => {
      const pid = typeof w === 'object' ? w.playerId : w;
      const amt = typeof w === 'object' ? (w.amount ?? potVal) : potVal;
      const idx = seatedPlayers.findIndex((pl) => pl.id === pid);
      if (idx >= 0) {
        wonByIdx[idx] = (wonByIdx[idx] || 0) + (Number(amt) || 0);
      }
    });
    seatedPlayers.forEach((pl, idx) => {
      const col = idx + 1;
      const wonAmt = wonByIdx[idx] || 0;
      const hasDistinctEnd = pl.endStack != null && pl.initialStack != null && pl.endStack !== pl.initialStack;
      const netProfit = hasDistinctEnd
        ? (pl.endStack - pl.initialStack)
        : (wonAmt - (Number(pl.totalBet) || 0));
      const startStack = pl.initialStack != null ? Number(pl.initialStack) : (pl.stack != null ? Number(pl.stack) : 0);
      const finalStack = pl.endStack != null ? Number(pl.endStack) : (startStack + netProfit);
      const isEliminated = startStack > 0 && finalStack <= 0;

      if (wonByIdx[idx] != null && netProfit >= 0) {
        winRow[col] = isBB ? `Win ${fmtVal(netProfit)}` : `Win ${money(netProfit, cur)}`;
        winCellCoords.push({ rowOffset: winRowOffset, colIndex: col });
      } else if (isEliminated) {
        winRow[col] = 'Eliminated';
        winCellCoords.push({ rowOffset: winRowOffset, colIndex: col });
      } else if (netProfit < 0) {
        const loss = Math.abs(netProfit);
        winRow[col] = isBB ? `-${fmtVal(loss)}` : money(-loss, cur);
      }
    });
    actionRows.push(winRow);
    streetEndRowIndices.push(actionRows.length - 1);
  }

  const rows = [
    headerRow,      // index 0
    boardRow,       // index 1
    seatHeaderRow,  // index 2
    stackRow,       // index 3
    handRow,        // index 4
    ...actionRows,
    [],             // Blank separator row
  ];

  const borderBottomOffsets = [
    0, // below headerRow
    1, // below boardRow
    4, // below handRow
    ...streetEndRowIndices.map((idx) => 5 + idx),
  ];

  const winCells = winCellCoords.map((c) => ({
    rowOffset: 5 + c.rowOffset,
    colIndex: c.colIndex,
  }));

  const numCols = Math.max(1, seatedPlayers.length + 1);

  return {
    rows,
    borderBottomOffsets,
    winCells,
    numCols,
  };
}

export function exportHandsToCSV(hands, options = {}) {
  if (!Array.isArray(hands) || hands.length === 0) {
    throw new Error('No hands played to export.');
  }

  const exportForUnit = (isBB) => {
    const sortedHands = [...hands].sort((a, b) => (a.handNumber || 0) - (b.handNumber || 0));
    const csvLines = [];

    sortedHands.forEach((h) => {
      const { rows } = buildHandRows(h, {
        ...options,
        unit: isBB ? 'bb' : 'chips',
        displayUnit: isBB ? 'bb' : 'chips',
      });
      rows.forEach((row) => {
        if (!row || row.length === 0) {
          csvLines.push('');
        } else {
          const escaped = row.map((cell) => {
            if (cell == null) return '';
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          });
          csvLines.push(escaped.join(','));
        }
      });
    });

    const csvString = csvLines.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const prefix = options.filenamePrefix || 'Poker_Hand_History';
    link.setAttribute('href', url);
    link.setAttribute('download', `${prefix}_${isBB ? 'BB' : 'Chips'}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (options.singleUnit) {
    exportForUnit(options.unit === 'bb');
  } else {
    exportForUnit(false);
    setTimeout(() => exportForUnit(true), 250);
  }
}

export const STATS_SHEET_COLUMNS = [
  { key: 'player', label: 'Player' },
  { key: 'rank', label: 'Rank' },
  { key: 'playstyle', label: 'Playstyle' },
  { key: 'hands', label: 'Hands' },
  { key: 'vpip', label: 'VPIP%' },
  { key: 'pfr', label: 'PFR%' },
  { key: 'rfi', label: 'RFI%' },
  { key: 'limp', label: 'Limp%' },
  { key: 'threeBet', label: '3-Bet%' },
  { key: 'foldToThreeBet', label: 'Fold to 3-Bet%' },
  { key: 'ats', label: 'ATS%' },
  { key: 'foldToSteal', label: 'Fold to Steal%' },
  { key: 'cbet', label: 'C-Bet%' },
  { key: 'foldToCbet', label: 'Fold to C-Bet%' },
  { key: 'af', label: 'AF' },
  { key: 'afq', label: 'AFq%' },
  { key: 'wwsf', label: 'WWSF%' },
  { key: 'wtsd', label: 'WTSD%' },
  { key: 'wsd', label: 'W$SD%' },
];

export function buildStatsRows(hands, options = {}) {
  const heroName = options.heroName || 'You';
  const orderedNames = [];
  const seen = new Set();
  const addName = (name) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    orderedNames.push(name);
  };

  if (Array.isArray(options.seats) && options.seats.length > 0) {
    const heroSeat = options.seats.find((s) => s?.isHero || s?.name === heroName);
    if (heroSeat?.name) addName(heroSeat.name);
    options.seats.forEach((s) => {
      if (s?.name && !s.isHero && s.name !== heroName) addName(s.name);
    });
  }

  // Ensure Hero ('You') appears first if present in recorded hands
  const allFoundNames = [];
  (hands || []).forEach((h) => {
    (h.players || []).forEach((p) => {
      if (p?.name) allFoundNames.push(p.name);
    });
  });
  if (allFoundNames.includes(heroName)) addName(heroName);
  allFoundNames.forEach(addName);

  const resolvePlaystyle = (name) => {
    if (name === heroName || name === 'You') return 'Hero';
    const seatObj = Array.isArray(options.seats)
      ? options.seats.find((s) => s?.name === name)
      : null;
    if (seatObj?.isHero) return 'Hero';
    let raw = seatObj?.playstyle || seatObj?.style || seatObj?.styleId || options.styles?.[name];
    if (!raw) {
      for (let i = (hands || []).length - 1; i >= 0; i--) {
        const pl = (hands[i]?.players || []).find((p) => p.name === name);
        if (pl) {
          raw = pl.playstyle || pl.style || pl.styleId;
          if (raw) break;
        }
      }
    }
    if (raw) {
      const lower = String(raw).toLowerCase().replace(/-/g, '_');
      return STYLE_NAME_MAP[lower] || raw;
    }
    return '—';
  };

  const sortedHands = [...(hands || [])].sort((a, b) => (a.handNumber || 0) - (b.handNumber || 0));
  const lastHand = sortedHands[sortedHands.length - 1];

  const getPlayerFinalStatus = (name) => {
    const seatObj = Array.isArray(options.seats)
      ? options.seats.find((s) => s?.name === name)
      : null;
    if (seatObj?.rank != null && seatObj.rank !== '') {
      return { explicitRank: Number(seatObj.rank) };
    }
    if (lastHand) {
      const pl = (lastHand.players || []).find((p) => p.name === name);
      if (pl?.rank != null && pl.rank !== '') {
        return { explicitRank: Number(pl.rank) };
      }
      if (pl) {
        const stackVal = pl.endStack != null ? pl.endStack : (pl.stack != null ? pl.stack : (pl.initialStack || 0));
        return { lastHandNumber: lastHand.handNumber || 1, finalStack: stackVal };
      }
    }
    for (let i = sortedHands.length - 1; i >= 0; i--) {
      const h = sortedHands[i];
      const pl = (h.players || []).find((p) => p.name === name);
      if (pl) {
        const stackVal = pl.endStack != null ? pl.endStack : (pl.stack != null ? pl.stack : (pl.initialStack || 0));
        return { lastHandNumber: h.handNumber || (i + 1), finalStack: stackVal };
      }
    }
    return { lastHandNumber: 0, finalStack: 0 };
  };

  const activePlayers = orderedNames
    .map((name) => {
      const stats = computePlayerStats(hands, name);
      const playstyle = resolvePlaystyle(name);
      const status = getPlayerFinalStatus(name);
      return { name, stats, playstyle, status, rank: null };
    })
    .filter((entry) => entry.stats && entry.stats.hands > 0);

  const allExplicit = activePlayers.length > 0 && activePlayers.every((p) => p.status.explicitRank != null);
  if (allExplicit) {
    activePlayers.forEach((p) => { p.rank = p.status.explicitRank; });
  } else {
    const rankedList = [...activePlayers].sort((a, b) => {
      if (a.status.explicitRank != null && b.status.explicitRank != null) {
        return a.status.explicitRank - b.status.explicitRank;
      }
      const aAlive = (a.status.finalStack || 0) > 0 && a.status.lastHandNumber === (lastHand?.handNumber || 1);
      const bAlive = (b.status.finalStack || 0) > 0 && b.status.lastHandNumber === (lastHand?.handNumber || 1);
      if (aAlive && bAlive) {
        return (b.status.finalStack || 0) - (a.status.finalStack || 0);
      }
      if (aAlive && !bAlive) return -1;
      if (!aAlive && bAlive) return 1;
      if (a.status.lastHandNumber !== b.status.lastHandNumber) {
        return b.status.lastHandNumber - a.status.lastHandNumber;
      }
      return (b.status.finalStack || 0) - (a.status.finalStack || 0);
    });

    rankedList.forEach((p, idx) => {
      p.rank = p.status.explicitRank != null ? p.status.explicitRank : (idx + 1);
    });
  }

  const fmtNum1 = (n) => {
    const r = Math.round(Number(n) * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  };

  const fmtStatCell = (key, p) => {
    if (key === 'rank') return p.rank ?? '—';
    if (key === 'playstyle') return p.playstyle ?? '—';
    if (key === 'hands') return p.stats.hands;
    const val = p.stats[key];
    if (val == null) return '—';
    if (key === 'af') return Number.isFinite(val) ? fmtNum1(val) : '∞';
    return `${fmtNum1(val)}%`;
  };

  const headerRow = ['Stat', ...activePlayers.map((p) => p.name)];
  const statRows = STATS_SHEET_COLUMNS
    .filter((c) => c.key !== 'player')
    .map((col) => [
      col.label,
      ...activePlayers.map((p) => fmtStatCell(col.key, p)),
    ]);

  return [headerRow, ...statRows];
}

export async function exportHandsToGoogleSheet(hands, options = {}) {
  if (!Array.isArray(hands) || hands.length === 0) {
    throw new Error('No hands played to export.');
  }

  const token = await getGoogleAccessToken();

  const sortedHands = [...hands].sort((a, b) => (a.handNumber || 0) - (b.handNumber || 0));

  // Build rows for Hands (Chips)
  const chipsRows = [];
  const chipsBorderRowIndices = [];
  const chipsInfoHeaderRowIndices = [];
  const chipsBoardRowIndices = [];
  const chipsWinCells = [];
  let chipsMaxCols = 2;

  sortedHands.forEach((h) => {
    const startRowIdx = chipsRows.length;
    chipsInfoHeaderRowIndices.push(startRowIdx);
    chipsBoardRowIndices.push(startRowIdx + 1);
    const { rows, borderBottomOffsets, winCells, numCols } = buildHandRows(h, {
      ...options,
      unit: 'chips',
      displayUnit: 'chips',
    });
    chipsRows.push(...rows);
    borderBottomOffsets.forEach((offset) => chipsBorderRowIndices.push(startRowIdx + offset));
    winCells.forEach((wc) => chipsWinCells.push({ rowIndex: startRowIdx + wc.rowOffset, colIndex: wc.colIndex }));
    if (numCols > chipsMaxCols) chipsMaxCols = numCols;
  });

  // Build rows for Hands (BB)
  const bbRows = [];
  const bbBorderRowIndices = [];
  const bbInfoHeaderRowIndices = [];
  const bbBoardRowIndices = [];
  const bbWinCells = [];
  let bbMaxCols = 2;

  sortedHands.forEach((h) => {
    const startRowIdx = bbRows.length;
    bbInfoHeaderRowIndices.push(startRowIdx);
    bbBoardRowIndices.push(startRowIdx + 1);
    const { rows, borderBottomOffsets, winCells, numCols } = buildHandRows(h, {
      ...options,
      unit: 'bb',
      displayUnit: 'bb',
    });
    bbRows.push(...rows);
    borderBottomOffsets.forEach((offset) => bbBorderRowIndices.push(startRowIdx + offset));
    winCells.forEach((wc) => bbWinCells.push({ rowIndex: startRowIdx + wc.rowOffset, colIndex: wc.colIndex }));
    if (numCols > bbMaxCols) bbMaxCols = numCols;
  });

  const statsRows = buildStatsRows(sortedHands, options);
  const statsNumCols = statsRows[0]?.length || 1;

  const dateStr = new Date().toISOString().split('T')[0];
  const customName = (options.sessionName || options.titleName || '').trim();
  const defaultTitle = customName
    ? `${customName} - ${dateStr}`
    : `Poker Session Hand History - ${dateStr}`;
  const title = options.title || defaultTitle;

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        { properties: { title: 'Hands (Chips)' } },
        { properties: { title: 'Hands (BB)' } },
        { properties: { title: 'Stats' } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errJson = await createRes.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Failed to create Google Sheet (${createRes.status})`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  const chipsSheet = sheetData.sheets?.[0];
  const chipsSheetId = chipsSheet?.properties?.sheetId ?? 0;
  const chipsSheetTitle = chipsSheet?.properties?.title || 'Hands (Chips)';

  const bbSheet = sheetData.sheets?.[1];
  const bbSheetId = bbSheet?.properties?.sheetId ?? 1;
  const bbSheetTitle = bbSheet?.properties?.title || 'Hands (BB)';

  const statsSheet = sheetData.sheets?.[2];
  const statsSheetId = statsSheet?.properties?.sheetId;
  const statsSheetTitle = statsSheet?.properties?.title || 'Stats';

  const batchData = [
    {
      range: `'${chipsSheetTitle}'!A1`,
      majorDimension: 'ROWS',
      values: chipsRows,
    },
    {
      range: `'${bbSheetTitle}'!A1`,
      majorDimension: 'ROWS',
      values: bbRows,
    },
  ];
  if (statsRows.length > 0 && statsSheetId != null) {
    batchData.push({
      range: `'${statsSheetTitle}'!A1`,
      majorDimension: 'ROWS',
      values: statsRows,
    });
  }

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      }),
    }
  );

  if (!writeRes.ok) {
    const errJson = await writeRes.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Failed to populate Google Sheet (${writeRes.status})`);
  }

  // Construct formatting requests for Hands (Chips) and Hands (BB) sheets
  function buildHandsFormatRequests(sheetId, numRows, maxCols, infoHeaders, boardRows, borders, wins) {
    const reqs = [
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: numRows,
            startColumnIndex: 0,
            endColumnIndex: maxCols,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontFamily: 'Noto Sans JP',
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      },
    ];

    infoHeaders.forEach((rowIdx) => {
      reqs.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: rowIdx,
            endRowIndex: rowIdx + 1,
            startColumnIndex: 0,
            endColumnIndex: maxCols,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      });
    });

    boardRows.forEach((rowIdx) => {
      reqs.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: rowIdx,
            endRowIndex: rowIdx + 1,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      });
    });

    borders.forEach((rowIdx) => {
      reqs.push({
        updateBorders: {
          range: {
            sheetId,
            startRowIndex: rowIdx,
            endRowIndex: rowIdx + 1,
            startColumnIndex: 0,
            endColumnIndex: maxCols,
          },
          bottom: {
            style: 'SOLID',
            width: 1,
            color: { red: 0.75, green: 0.75, blue: 0.75 },
          },
        },
      });
    });

    wins.forEach((wc) => {
      reqs.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: wc.rowIndex,
            endRowIndex: wc.rowIndex + 1,
            startColumnIndex: wc.colIndex,
            endColumnIndex: wc.colIndex + 1,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontFamily: 'Noto Sans JP',
                bold: true,
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.bold,userEnteredFormat.verticalAlignment',
        },
      });
    });

    return reqs;
  }

  const requests = [
    ...buildHandsFormatRequests(
      chipsSheetId,
      chipsRows.length,
      chipsMaxCols,
      chipsInfoHeaderRowIndices,
      chipsBoardRowIndices,
      chipsBorderRowIndices,
      chipsWinCells
    ),
    ...buildHandsFormatRequests(
      bbSheetId,
      bbRows.length,
      bbMaxCols,
      bbInfoHeaderRowIndices,
      bbBoardRowIndices,
      bbBorderRowIndices,
      bbWinCells
    ),
  ];

  // Style the "Stats" sheet
  if (statsSheetId != null && statsRows.length > 0) {
    requests.push(
      {
        repeatCell: {
          range: {
            sheetId: statsSheetId,
            startRowIndex: 0,
            endRowIndex: statsRows.length,
            startColumnIndex: 0,
            endColumnIndex: statsNumCols,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontFamily: 'Noto Sans JP',
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: statsSheetId,
            startRowIndex: 0,
            endRowIndex: statsRows.length,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: statsSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: statsNumCols,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.94, green: 0.95, blue: 0.97 },
              textFormat: {
                fontFamily: 'Noto Sans JP',
                bold: true,
              },
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.bold,userEnteredFormat.verticalAlignment',
        },
      },
      {
        updateBorders: {
          range: {
            sheetId: statsSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: statsNumCols,
          },
          bottom: {
            style: 'SOLID',
            width: 1,
            color: { red: 0.7, green: 0.72, blue: 0.76 },
          },
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: statsSheetId,
            startRowIndex: 0,
            endRowIndex: statsRows.length,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontFamily: 'Noto Sans JP',
                bold: true,
              },
            },
          },
          fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.bold',
        },
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId: statsSheetId,
            gridProperties: {
              frozenRowCount: 1,
              frozenColumnCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
        },
      }
    );

    if (statsNumCols > 1) {
      const statDefs = STATS_SHEET_COLUMNS.filter((c) => c.key !== 'player');
      statDefs.forEach((col, idx) => {
        const rowIdx = 1 + idx;
        if (col.key === 'playstyle') return;
        if (col.key === 'hands' || col.key === 'rank') {
          requests.push({
            repeatCell: {
              range: {
                sheetId: statsSheetId,
                startRowIndex: rowIdx,
                endRowIndex: rowIdx + 1,
                startColumnIndex: 1,
                endColumnIndex: statsNumCols,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          });
          return;
        }
        const rowValues = statsRows[rowIdx] || [];
        for (let colIdx = 1; colIdx < statsNumCols; colIdx++) {
          const rawCell = String(rowValues[colIdx] ?? '');
          if (!rawCell || rawCell === '—' || rawCell === '∞') continue;
          let numberFormat;
          if (col.key === 'af') {
            numberFormat = rawCell.includes('.')
              ? { type: 'NUMBER', pattern: '0.0' }
              : { type: 'NUMBER', pattern: '0' };
          } else {
            numberFormat = /\.\d+%$/.test(rawCell) && !/\.0%$/.test(rawCell)
              ? { type: 'PERCENT', pattern: '0.0%' }
              : { type: 'PERCENT', pattern: '0%' };
          }
          requests.push({
            repeatCell: {
              range: {
                sheetId: statsSheetId,
                startRowIndex: rowIdx,
                endRowIndex: rowIdx + 1,
                startColumnIndex: colIdx,
                endColumnIndex: colIdx + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat,
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          });
        }
      });
    }
  }

  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests,
      }),
    });
  } catch (_) {}

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
  };
}
