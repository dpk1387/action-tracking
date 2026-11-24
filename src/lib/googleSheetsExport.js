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

  // Chip stack rank among seated players at start of hand (1 = chip leader)
  const sortedByStack = [...seatedPlayers].sort((a, b) => {
    const sa = a.initialStack != null ? a.initialStack : (a.stack || 0);
    const sb = b.initialStack != null ? b.initialStack : (b.stack || 0);
    return sb - sa;
  });

  const rankRow = ['Rank'];
  seatedPlayers.forEach((p) => {
    if (p.rank != null && p.rank !== '') {
      rankRow.push(p.rank);
      return;
    }
    const myStack = p.initialStack != null ? p.initialStack : (p.stack || 0);
    const rankIdx = sortedByStack.findIndex((x) => (x.initialStack != null ? x.initialStack : (x.stack || 0)) === myStack);
    rankRow.push(rankIdx >= 0 ? rankIdx + 1 : '');
  });

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

  const playstyleRow = ['Playstyle'];
  seatedPlayers.forEach((p) => {
    const seatObj = Array.isArray(options.seats)
      ? options.seats.find((s) => s?.name === p.name || s?.seat === p.seat)
      : null;
    const isHero = p.isHero || p.name === 'You' || !!seatObj?.isHero;
    if (isHero) {
      playstyleRow.push('Hero');
      return;
    }
    const raw = p.playstyle || p.style || p.styleId || seatObj?.styleId || options.styles?.[p.name] || '';
    if (raw) {
      const lower = String(raw).toLowerCase().replace(/-/g, '_');
      playstyleRow.push(STYLE_NAME_MAP[lower] || raw);
    } else {
      playstyleRow.push('—');
    }
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

  const rawHistory = Array.isArray(hand.actions) && hand.actions.length > 0
    ? hand.actions
    : Array.isArray(hand.actionHistory)
    ? hand.actionHistory
    : [];

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

  const formatActionText = (act) => {
    const actName = act.action || act.type || '';
    const hasChips = act.chips != null || act.amount != null || act.callAmount != null;
    const chipsVal = act.chips != null ? act.chips : (act.callAmount != null ? act.callAmount : act.amount);
    let amtStr = '';
    if (hasChips && chipsVal > 0) {
      amtStr = isBB ? ` ${fmtVal(chipsVal)}` : ` ${money(chipsVal, cur)}`;
    }
    return `${actName}${amtStr}`.trim();
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

      regular.forEach((act) => {
        const colIdx = getColForPlayer(act);
        if (colIdx <= 0) return;

        if (colIdx <= lastColumnIndex) {
          actionRows.push(currentRow);
          currentRow = makeEmptyRow('');
          hasActionsInRow = false;
        }

        currentRow[colIdx] = formatActionText(act);
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

      acts.forEach((act) => {
        const colIdx = getColForPlayer(act);
        if (colIdx <= 0) return;

        if (colIdx <= lastColumnIndex) {
          actionRows.push(currentRow);
          currentRow = makeEmptyRow('');
          hasActionsInRow = false;
        }

        currentRow[colIdx] = formatActionText(act);
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
    Object.entries(wonByIdx).forEach(([idxStr, wonAmt]) => {
      const idx = Number(idxStr);
      const pl = seatedPlayers[idx];
      const col = idx + 1;
      const hasDistinctEnd = pl.endStack != null && pl.initialStack != null && pl.endStack !== pl.initialStack;
      const netProfit = hasDistinctEnd
        ? (pl.endStack - pl.initialStack)
        : (wonAmt - (Number(pl.totalBet) || 0));
      const profit = Math.max(0, netProfit);
      winRow[col] = isBB ? `Win ${fmtVal(profit)}` : `Win ${money(profit, cur)}`;
      winCellCoords.push({ rowOffset: winRowOffset, colIndex: col });
    });
    actionRows.push(winRow);
    streetEndRowIndices.push(actionRows.length - 1);
  }

  const rows = [
    headerRow,      // index 0
    boardRow,       // index 1
    seatHeaderRow,  // index 2
    rankRow,        // index 3
    playstyleRow,   // index 4
    stackRow,       // index 5
    handRow,        // index 6
    ...actionRows,
    [],             // Blank separator row
  ];

  const borderBottomOffsets = [
    0, // below headerRow
    1, // below boardRow
    6, // below handRow
    ...streetEndRowIndices.map((idx) => 7 + idx),
  ];

  const winCells = winCellCoords.map((c) => ({
    rowOffset: 7 + c.rowOffset,
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

  const fmtNum1 = (n) => (Math.round(Number(n) * 10) / 10).toFixed(1);

  const fmtStatCell = (key, stats) => {
    if (key === 'hands') return stats.hands;
    const val = stats[key];
    if (val == null) return '—';
    if (key === 'af') return Number.isFinite(val) ? fmtNum1(val) : '∞';
    return `${fmtNum1(val)}%`;
  };

  const activePlayers = orderedNames
    .map((name) => ({ name, stats: computePlayerStats(hands, name) }))
    .filter((entry) => entry.stats && entry.stats.hands > 0);

  const headerRow = ['Stat', ...activePlayers.map((p) => p.name)];
  const statRows = STATS_SHEET_COLUMNS
    .filter((c) => c.key !== 'player')
    .map((col) => [
      col.label,
      ...activePlayers.map((p) => fmtStatCell(col.key, p.stats)),
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
        const numberFormat = col.key === 'hands'
          ? { type: 'NUMBER', pattern: '#,##0' }
          : col.key === 'af'
          ? { type: 'NUMBER', pattern: '0.0' }
          : { type: 'PERCENT', pattern: '0.0%' };
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
                numberFormat,
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        });
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
