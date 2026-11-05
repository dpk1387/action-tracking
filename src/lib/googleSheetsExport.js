import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  money,
  formatBlinds,
  getButtonIndex,
  positionForSeat,
} from '@/lib/poker';

// Initialize Firebase App
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken = null;

// Auth state listener to clear cached token on signout
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

/**
 * Format a single card into rank + suit symbol (e.g. "A♠", "K♦")
 */
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

/**
 * Format a list of cards to readable string with suit symbols e.g. "A♠ K♦ 7♣"
 */
export function formatCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return '';
  return cards
    .map(formatSingleCard)
    .filter(Boolean)
    .join(' ');
}

/**
 * Builds rows for a single hand matching the Hand History Sample format:
 * Row 1: Hand #1   ·   [blinds]   ·   Pot [pot size]
 * Row 2: Board,[board cards with suit symbols]
 * Row 3: ,[P1] · [pos],[P2] · [pos],... (only active players, no empty seats)
 * Row 4: Stack,[P1 stack],[P2 stack],...
 * Row 5: Hand,[P1 hand with suit symbols],[P2 hand with suit symbols],...
 * Row 6+: Preflop / Flop / Turn / River / Win
 *
 * Also returns metadata for row-level borders and bolding the win cell.
 */
export function buildHandRows(hand) {
  const isTourney = Boolean(
    hand.mode === 'tournament' ||
    hand.tournament ||
    hand.isTourney ||
    hand.tournamentId ||
    (Array.isArray(hand.blindSchedule) && hand.blindSchedule.length > 0)
  );
  const cur = isTourney ? '' : (hand.currency || '$');
  const players = hand.players || [];

  // Only include seats that have an actual seated player (no dummy seats 7-10 in 6-max)
  const seatedPlayers = players.filter((p) => p && p.seat != null);
  seatedPlayers.sort((a, b) => a.seat - b.seat);

  const bi = getButtonIndex(hand);
  const n = seatedPlayers.length;

  // Row 1: Hand #1   ·   [blinds]   ·   Pot [pot size]
  const blindsText = formatBlinds(hand);
  const potVal = (hand.pots || []).reduce((sum, pt) => sum + (pt.amount || 0), 0)
    || players.reduce((sum, p) => sum + (p.totalBet || 0), 0);
  const potText = `Pot ${money(potVal, cur)}`;
  const headerRow = [`Hand #${hand.handNumber}   ·   ${blindsText}   ·   ${potText}`];

  // Row 2: Board
  const bCards = formatCards(hand.communityCards);
  const boardRow = ['Board', bCards];

  // Row 3: Player headers: ,[Player Name] · [pos]...
  const seatHeaderRow = [''];
  seatedPlayers.forEach((p) => {
    const pIdx = players.findIndex((pl) => pl.id === p.id);
    const pos = p.position || (pIdx >= 0 ? positionForSeat(n, bi, pIdx, hand.variant) : '');
    const label = pos ? `${p.name} · ${pos}` : p.name;
    seatHeaderRow.push(label);
  });

  // Row 4: Stack
  const stackRow = ['Stack'];
  seatedPlayers.forEach((p) => {
    const st = p.initialStack != null ? p.initialStack : p.stack;
    stackRow.push(st != null ? money(st, cur) : '');
  });

  // Row 5: Hand (hole cards with suit symbols)
  const holeCardsMap = hand.holeCards || hand._holeCards || {};
  const handRow = ['Hand'];
  seatedPlayers.forEach((p) => {
    const hc = holeCardsMap[p.id] ?? holeCardsMap[String(p.id)] ?? [];
    handRow.push(formatCards(hc));
  });

  // Process Actions by Street
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

  // Helper to place an action in seated player column
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
    const amtStr = (hasChips && chipsVal > 0) ? ` ${money(chipsVal, cur)}` : '';
    return `${actName}${amtStr}`.trim();
  };

  const actionRows = [];
  const streetEndRowIndices = []; // row indices relative to actionRows where a street ends
  const winCellCoords = []; // coordinates relative to actionRows

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

  // Winning / Showdown Row
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
        winRow[col] = `Win ${money(amt, cur)}`;
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

  // Borders needed at bottoms of:
  // - headerRow (index 0) -> separates info from board
  // - boardRow (index 1) -> separates board from player+stack+hand
  // - handRow (index 4) -> separates player+stack+hand from preflop
  // - each street end row (5 + idx) -> separates streets
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

/**
 * Exports session hand history to Google Sheets.
 * Hand 1 at top, subsequent hands below.
 * Applies 'Inter' font and center alignment to all cells.
 * Adds borders across whole rows separating info, board, player+stack+hand, and streets.
 * Bolds win cells.
 */
export async function exportHandsToGoogleSheet(hands) {
  if (!Array.isArray(hands) || hands.length === 0) {
    throw new Error('No hands played to export.');
  }

  const token = await getGoogleAccessToken();

  // Sort hands ascending (Hand 1 at top, subsequent hands below)
  const sortedHands = [...hands].sort((a, b) => (a.handNumber || 0) - (b.handNumber || 0));

  // Build 2D values grid and metadata for styling
  const allRows = [];
  const allBorderRowIndices = [];
  const allWinCells = [];
  let maxColsAcrossHands = 2;

  sortedHands.forEach((h) => {
    const startRowIdx = allRows.length;
    const { rows, borderBottomOffsets, winCells, numCols } = buildHandRows(h);
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

  // Create new Spreadsheet
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

  // Write values into spreadsheet
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
  // 1. Inter font & CENTER alignment across all cells
  // 2. Borders across whole rows separating info, board, player+stack+hand, preflop, flop, turn, river
  // 3. Bold the win cells
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
          },
        },
        fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.horizontalAlignment',
      },
    },
  ];

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
          },
        },
        fields: 'userEnteredFormat.textFormat.bold',
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
  } catch (_) {
    // If styling batchUpdate fails non-fatally, the values are still exported
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
  };
}
