import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  money,
  formatBlinds,
  getButtonIndex,
  positionForSeat,
} from '@/lib/poker';
import { sortGoHoleCards } from '@/lib/goMode';

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
    return `${r}${SUIT_UNICODE[s] || s}`;
  }
  if (c.hidden) return '?';
  const s = SUIT_UNICODE[c.suit] || c.suit || '';
  return `${c.rank || ''}${s}`;
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
  const cur = (isTourney || isBB) ? '' : (hand.currency || '$');
  const players = hand.players || [];

  const seatedPlayers = players.filter((p) => p && p.seat != null);
  seatedPlayers.sort((a, b) => a.seat - b.seat);

  const bi = getButtonIndex(hand);
  const n = seatedPlayers.length;

  const blindsText = formatBlinds(hand);
  const potVal = (hand.pots || []).reduce((sum, pt) => sum + (pt.amount || 0), 0)
    || players.reduce((sum, p) => sum + (p.totalBet || 0), 0);
  const potText = isBB ? `Pot ${fmtVal(potVal)}` : `Pot ${money(potVal, cur)}`;
  const headerRow = [`Hand #${hand.handNumber}   ·   ${blindsText}   ·   ${potText}`];

  const bCards = formatCards(hand.communityCards);
  const boardRow = ['Board', bCards];

  const seatHeaderRow = [''];
  seatedPlayers.forEach((p) => {
    const pIdx = players.findIndex((pl) => pl.id === p.id);
    let pos = p.position || (pIdx >= 0 ? positionForSeat(n, bi, pIdx, hand.variant) : '');
    // Positions: In heads up or 3+ players, use D instead of BTN or D/SB
    if (pos === 'BTN' || pos === 'D/SB') {
      pos = 'D';
    }
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

  const rawHistory = Array.isArray(hand.actions) && hand.actions.length > 0
    ? hand.actions
    : Array.isArray(hand.actionHistory)
    ? hand.actionHistory
    : [];

  const streetOrder = ['preflop', 'flop', 'turn', 'river'];
  const actionsByStreet = {
    preflop: [],
    flop: [],
    turn: [],
    river: [],
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
        ['sb', 'bb', '3b', '4b', 'straddle', 'ante', 'btn_ante', 'kill'].includes(String(a.type || a.action || '').toLowerCase())
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
      let actedSeatsInCurrentRow = new Set();

      regular.forEach((act) => {
        const col = getColForPlayer(act);
        if (col <= 0) return;

        if (actedSeatsInCurrentRow.has(col)) {
          actionRows.push(currentRow);
          currentRow = makeEmptyRow('');
          actedSeatsInCurrentRow = new Set();
        }

        currentRow[col] = formatActionText(act);
        actedSeatsInCurrentRow.add(col);
      });

      if (actedSeatsInCurrentRow.size > 0 || (blinds.length === 0 && actionRows.length === 0)) {
        actionRows.push(currentRow);
      }
      streetEndRowIndices.push(actionRows.length - 1);
    } else {
      let currentRow = makeEmptyRow(streetLabel);
      let actedSeatsInCurrentRow = new Set();

      acts.forEach((act) => {
        const col = getColForPlayer(act);
        if (col <= 0) return;

        if (actedSeatsInCurrentRow.has(col)) {
          actionRows.push(currentRow);
          currentRow = makeEmptyRow('');
          actedSeatsInCurrentRow = new Set();
        }

        currentRow[col] = formatActionText(act);
        actedSeatsInCurrentRow.add(col);
      });

      if (actedSeatsInCurrentRow.size > 0) {
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
    winners.forEach((w) => {
      const pid = typeof w === 'object' ? w.playerId : w;
      const amt = typeof w === 'object' ? (w.amount || potVal) : potVal;
      const idx = seatedPlayers.findIndex((pl) => pl.id === pid);
      if (idx >= 0) {
        const col = idx + 1;
        winRow[col] = isBB ? `Win ${fmtVal(amt)}` : `Win ${money(amt, cur)}`;
        winCellCoords.push({ rowOffset: winRowOffset, colIndex: col });
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

  const isBB = options.unit === 'bb' || options.displayUnit === 'bb';
  const sortedHands = [...hands].sort((a, b) => (a.handNumber || 0) - (b.handNumber || 0));
  const csvLines = [];

  sortedHands.forEach((h) => {
    const { rows } = buildHandRows(h, options);
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
  link.setAttribute('href', url);
  link.setAttribute('download', `Poker_Hand_History_${isBB ? 'BB_' : ''}${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportHandsToGoogleSheet(hands, options = {}) {
  if (!Array.isArray(hands) || hands.length === 0) {
    throw new Error('No hands played to export.');
  }

  const token = await getGoogleAccessToken();

  const sortedHands = [...hands].sort((a, b) => (a.handNumber || 0) - (b.handNumber || 0));

  const allRows = [];
  const allBorderRowIndices = [];
  const allInfoHeaderRowIndices = [];
  const allWinCells = [];
  let maxColsAcrossHands = 2;

  sortedHands.forEach((h) => {
    const startRowIdx = allRows.length;
    allInfoHeaderRowIndices.push(startRowIdx); // Info row at top of each hand
    const { rows, borderBottomOffsets, winCells, numCols } = buildHandRows(h, options);
    allRows.push(...rows);

    borderBottomOffsets.forEach((offset) => {
      allBorderRowIndices.push(startRowIdx + offset);
    });

    winCells.forEach((wc) => {
      allWinCells.push({
        rowIndex: startRowIdx + wc.rowOffset,
        colIndex: wc.colIndex,
      });
    });

    if (numCols > maxColsAcrossHands) {
      maxColsAcrossHands = numCols;
    }
  });

  const dateStr = new Date().toISOString().split('T')[0];
  const title = `Poker Session Hand History - ${dateStr}`;

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
    }),
  });

  if (!createRes.ok) {
    const errJson = await createRes.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Failed to create Google Sheet (${createRes.status})`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;
  const firstSheet = sheetData.sheets?.[0];
  const firstSheetId = firstSheet?.properties?.sheetId || 0;
  const firstSheetTitle = firstSheet?.properties?.title || 'Sheet1';

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheetTitle)}!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${firstSheetTitle}!A1`,
        majorDimension: 'ROWS',
        values: allRows,
      }),
    }
  );

  if (!writeRes.ok) {
    const errJson = await writeRes.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Failed to populate Google Sheet (${writeRes.status})`);
  }

  // Construct batchUpdate requests:
  // 1. Inter font, CENTER horizontal, MIDDLE vertical alignment across all cells
  // 2. Info rows (Hand #1...) LEFT aligned
  // 3. Borders across whole rows separating info, board, player+stack+hand, preflop, flop, turn, river
  // 4. Bold the win cells
  const requests = [
    {
      repeatCell: {
        range: {
          sheetId: firstSheetId,
          startRowIndex: 0,
          endRowIndex: allRows.length,
          startColumnIndex: 0,
          endColumnIndex: maxColsAcrossHands,
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              fontFamily: 'Inter',
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
      },
    },
  ];

  // Info header rows: LEFT aligned
  allInfoHeaderRowIndices.forEach((rowIdx) => {
    requests.push({
      repeatCell: {
        range: {
          sheetId: firstSheetId,
          startRowIndex: rowIdx,
          endRowIndex: rowIdx + 1,
          startColumnIndex: 0,
          endColumnIndex: maxColsAcrossHands,
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

  // Add borders across rows
  allBorderRowIndices.forEach((rowIdx) => {
    requests.push({
      updateBorders: {
        range: {
          sheetId: firstSheetId,
          startRowIndex: rowIdx,
          endRowIndex: rowIdx + 1,
          startColumnIndex: 0,
          endColumnIndex: maxColsAcrossHands,
        },
        bottom: {
          style: 'SOLID',
          width: 1,
          color: { red: 0.75, green: 0.75, blue: 0.75 },
        },
      },
    });
  });

  // Bold the win cells
  allWinCells.forEach((wc) => {
    requests.push({
      repeatCell: {
        range: {
          sheetId: firstSheetId,
          startRowIndex: wc.rowIndex,
          endRowIndex: wc.rowIndex + 1,
          startColumnIndex: wc.colIndex,
          endColumnIndex: wc.colIndex + 1,
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              fontFamily: 'Inter',
              bold: true,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat.textFormat.bold,userEnteredFormat.verticalAlignment',
      },
    });
  });

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
