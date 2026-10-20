/**
 * Tournament Payout Engine
 *
 * Computes prize pool distributions based on total players, buy-in amount,
 * and a flexible payout configuration array.
 *
 * Supports:
 * - Specific rank (e.g. 1)
 * - Rank range (e.g. "3-5" or [3, 5])
 * - Percentage bracket (e.g. "next 2% of field", "top 10%", "2%")
 * - Fixed dollar amounts or pool percentage payouts
 * - Dual percentage brackets (allocates chunk of pool divided evenly across bracket players)
 * - Consolidated bracket formatting so ranges like 4-7th display cleanly once as 12% ($51 each)
 * - Simultaneous elimination toggle (true: split pooled bracket cash evenly; false: stack-based linear rank)
 * - Default table-based payouts:
 *   1 table: top 3 (50%, 30%, 20%)
 *   2 tables: top 4 (45%, 25%, 18%, 12%)
 *   3 tables: top 5 (40%, 25%, 17%, 11%, 7%)
 */

export function getDefaultPayoutConfig(tablesCount = 1) {
  const t = Math.max(1, Number(tablesCount) || 1);
  if (t === 1) {
    return [
      { rank: 1, payout: { type: 'percent', value: 50 } },
      { rank: 2, payout: { type: 'percent', value: 30 } },
      { rank: 3, payout: { type: 'percent', value: 20 } },
    ];
  }
  if (t === 2) {
    return [
      { rank: 1, payout: { type: 'percent', value: 45 } },
      { rank: 2, payout: { type: 'percent', value: 25 } },
      { rank: 3, payout: { type: 'percent', value: 18 } },
      { rank: 4, payout: { type: 'percent', value: 12 } },
    ];
  }
  if (t === 3) {
    return [
      { rank: 1, payout: { type: 'percent', value: 40 } },
      { rank: 2, payout: { type: 'percent', value: 25 } },
      { rank: 3, payout: { type: 'percent', value: 17 } },
      { rank: 4, payout: { type: 'percent', value: 11 } },
      { rank: 5, payout: { type: 'percent', value: 7 } },
    ];
  }
  // 4+ tables scaling
  return [
    { rank: 1, payout: { type: 'percent', value: 36 } },
    { rank: 2, payout: { type: 'percent', value: 22 } },
    { rank: 3, payout: { type: 'percent', value: 15 } },
    { rank: 4, payout: { type: 'percent', value: 10 } },
    { rank: 5, payout: { type: 'percent', value: 7 } },
    { rank: 6, payout: { type: 'percent', value: 5 } },
    { rank: 7, payout: { type: 'percent', value: 3 } },
    { rank: 8, payout: { type: 'percent', value: 2 } },
  ];
}

export function getOrdinalSuffix(i) {
  const j = i % 10,
    k = i % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Parse rank specification
 * @returns { start: number, end: number, isPercent: boolean, percentCount: number }
 */
function parseRankSpec(rankSpec, totalPlayers, currentAssignedMaxRank) {
  const total = Math.max(1, totalPlayers);

  // If object { type: 'percent', value: 2 } or { type: 'range', start: 3, end: 5 }
  if (typeof rankSpec === 'object' && rankSpec !== null) {
    if (rankSpec.type === 'percent' || rankSpec.percent != null) {
      const pct = parseFloat(rankSpec.value ?? rankSpec.percent);
      const count = Math.max(1, Math.round((pct / 100) * total));
      const start = currentAssignedMaxRank + 1;
      const end = Math.min(total, start + count - 1);
      return { start, end, isPercent: true, count: Math.max(1, end - start + 1) };
    }
    if (rankSpec.start != null) {
      const start = parseInt(rankSpec.start, 10);
      const end = rankSpec.end != null ? parseInt(rankSpec.end, 10) : start;
      return { start, end, isPercent: false, count: Math.max(1, end - start + 1) };
    }
  }

  // If number
  if (typeof rankSpec === 'number') {
    return { start: rankSpec, end: rankSpec, isPercent: false, count: 1 };
  }

  const str = String(rankSpec).trim().toLowerCase();

  // Range syntax "3-5" or "3 to 5"
  if (str.includes('-') || str.includes('to')) {
    const parts = str.split(/-|to/).map((s) => parseInt(s.trim(), 10));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const start = Math.min(parts[0], parts[1]);
      const end = Math.max(parts[0], parts[1]);
      return { start, end, isPercent: false, count: Math.max(1, end - start + 1) };
    }
  }

  // Percentage syntax "next 2% of field", "top 10%", "2%"
  const matchPct = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (matchPct) {
    const pct = parseFloat(matchPct[1]);
    const count = Math.max(1, Math.round((pct / 100) * total));
    const start = currentAssignedMaxRank + 1;
    const end = Math.min(total, start + count - 1);
    return { start, end, isPercent: true, count: Math.max(1, end - start + 1) };
  }

  // Single number string "1", "2"
  const single = parseInt(str, 10);
  if (!isNaN(single)) {
    return { start: single, end: single, isPercent: false, count: 1 };
  }

  // Fallback next place
  const start = currentAssignedMaxRank + 1;
  return { start, end: start, isPercent: false, count: 1 };
}

/**
 * Parse payout specification
 * @returns { type: 'percent' | 'fixed', value: number }
 */
function parsePayoutSpec(payoutSpec) {
  if (typeof payoutSpec === 'object' && payoutSpec !== null) {
    if (payoutSpec.type === 'fixed' || payoutSpec.amount != null) {
      return { type: 'fixed', value: Number(payoutSpec.value ?? payoutSpec.amount) || 0 };
    }
    return { type: 'percent', value: Number(payoutSpec.value ?? payoutSpec.percent) || 0 };
  }

  if (typeof payoutSpec === 'number') {
    return { type: 'percent', value: payoutSpec };
  }

  const str = String(payoutSpec).trim();
  if (str.includes('%')) {
    return { type: 'percent', value: parseFloat(str.replace('%', '')) || 0 };
  }
  if (str.startsWith('$') || str.endsWith('$')) {
    return { type: 'fixed', value: parseFloat(str.replace(/\$/g, '')) || 0 };
  }

  const num = parseFloat(str);
  if (!isNaN(num)) {
    return num <= 100 ? { type: 'percent', value: num } : { type: 'fixed', value: num };
  }
  return { type: 'percent', value: 0 };
}

/**
 * Main Tournament Payout Logic Function
 *
 * @param {Object} options
 * @param {number} options.totalPlayers
 * @param {number} options.buyIn
 * @param {number} [options.totalPool]
 * @param {Array} [options.payoutConfig]
 * @param {number} [options.tablesCount=1]
 * @param {boolean} [options.splitSimultaneousTies=false]
 * @returns {Array<{ place: number, label: string, percent: number, amount: number, isBracket?: boolean, bracketLabel?: string, bracketTotalPercent?: number, bracketTotalAmount?: number }>}
 */
export function calculateTournamentPayouts({
  totalPlayers = 10,
  buyIn = 100,
  totalPool = null,
  payoutConfig = null,
  tablesCount = 1,
  splitSimultaneousTies = false,
} = {}) {
  const players = Math.max(1, Number(totalPlayers) || 1);
  const bi = Math.max(0, Number(buyIn) || 0);
  const pool = totalPool != null ? Math.max(0, Number(totalPool) || 0) : players * bi;

  const rawConfig =
    Array.isArray(payoutConfig) && payoutConfig.length > 0
      ? payoutConfig
      : getDefaultPayoutConfig(tablesCount);

  let currentMaxRank = 0;
  const individualRanks = [];

  rawConfig.forEach((item, ruleIdx) => {
    const rankInfo = parseRankSpec(item.rank, players, currentMaxRank);
    const payoutInfo = parsePayoutSpec(item.payout);

    currentMaxRank = Math.max(currentMaxRank, rankInfo.end);

    const isRankPercent = rankInfo.isPercent;
    const isPayoutPercent = payoutInfo.type === 'percent';
    const numPlayersInBracket = rankInfo.count;
    const isRange = rankInfo.start !== rankInfo.end;
    const bracketLabel = isRange
      ? `${rankInfo.start}-${rankInfo.end}`
      : `${rankInfo.start}${getOrdinalSuffix(rankInfo.start)}`;

    if (isRankPercent && isPayoutPercent) {
      // Allocate that percentage chunk of the total prize pool to the entire bracket and divide it evenly
      const bracketTotalCash = (pool * payoutInfo.value) / 100;
      const perPlayerCash = bracketTotalCash / numPlayersInBracket;
      const perPlayerPct = payoutInfo.value / numPlayersInBracket;

      for (let p = rankInfo.start; p <= rankInfo.end; p++) {
        individualRanks.push({
          ruleId: ruleIdx,
          place: p,
          label: `${p}${getOrdinalSuffix(p)}`,
          isBracket: isRange,
          bracketLabel,
          bracketStart: rankInfo.start,
          bracketEnd: rankInfo.end,
          percent: perPlayerPct,
          amount: Math.round(perPlayerCash),
          bracketTotalPercent: payoutInfo.value,
          bracketTotalAmount: Math.round(bracketTotalCash),
        });
      }
    } else {
      // Range or single place with fixed or percent
      const bracketTotalCash =
        payoutInfo.type === 'fixed'
          ? payoutInfo.value
          : (pool * payoutInfo.value) / 100;

      const perPlayerCash = isRange
        ? bracketTotalCash / numPlayersInBracket
        : bracketTotalCash;
      const perPlayerPct =
        payoutInfo.type === 'percent'
          ? isRange
            ? payoutInfo.value / numPlayersInBracket
            : payoutInfo.value
          : pool > 0
          ? (perPlayerCash / pool) * 100
          : 0;
      const totalPct =
        payoutInfo.type === 'percent'
          ? payoutInfo.value
          : pool > 0
          ? (bracketTotalCash / pool) * 100
          : 0;

      for (let p = rankInfo.start; p <= rankInfo.end; p++) {
        individualRanks.push({
          ruleId: ruleIdx,
          place: p,
          label: `${p}${getOrdinalSuffix(p)}`,
          isBracket: isRange,
          bracketLabel,
          bracketStart: rankInfo.start,
          bracketEnd: rankInfo.end,
          percent: perPlayerPct,
          amount: Math.round(perPlayerCash),
          bracketTotalPercent: totalPct,
          bracketTotalAmount: Math.round(bracketTotalCash),
        });
      }
    }
  });

  individualRanks.sort((a, b) => a.place - b.place);
  return individualRanks;
}

/**
 * Consolidate Payout Ladder for Clean Display (Avoids repeating "4-7" 4 times)
 *
 * Transforms individual place rows into consolidated display items:
 * - Single places: { label: "1st", percent: 45, amount: 765, isBracket: false, start: 1, end: 1 }
 * - Range brackets: { label: "4-7th", percent: 12, amount: 204, perPlayerAmount: 51, isBracket: true, start: 4, end: 7 }
 */
export function getConsolidatedPayoutLadder(payouts = []) {
  if (!payouts.length) return [];

  const consolidated = [];
  const visitedRuleIds = new Set();

  payouts.forEach((p) => {
    if (p.isBracket) {
      const key = `${p.bracketStart}-${p.bracketEnd}`;
      if (!visitedRuleIds.has(key)) {
        visitedRuleIds.add(key);
        consolidated.push({
          label: `${p.bracketStart}-${p.bracketEnd}${getOrdinalSuffix(p.bracketEnd)}`,
          shortLabel: `${p.bracketStart}-${p.bracketEnd}`,
          isBracket: true,
          places: Array.from(
            { length: p.bracketEnd - p.bracketStart + 1 },
            (_, i) => p.bracketStart + i
          ),
          startPlace: p.bracketStart,
          endPlace: p.bracketEnd,
          percent: p.bracketTotalPercent,
          totalAmount: p.bracketTotalAmount,
          perPlayerAmount: p.amount,
          perPlayerPercent: p.percent,
        });
      }
    } else {
      consolidated.push({
        label: p.label || `${p.place}${getOrdinalSuffix(p.place)}`,
        shortLabel: `${p.place}`,
        isBracket: false,
        places: [p.place],
        startPlace: p.place,
        endPlace: p.place,
        percent: p.percent,
        totalAmount: p.amount,
        perPlayerAmount: p.amount,
        perPlayerPercent: p.percent,
      });
    }
  });

  return consolidated;
}

/**
 * Handle Simultaneous Eliminations Tie-Breaking
 */
export function resolveSimultaneousEliminations({
  eliminatedPlayers = [],
  finishPlacesStart,
  payouts = [],
  splitTies = false,
}) {
  if (!eliminatedPlayers.length) return [];

  const count = eliminatedPlayers.length;
  const places = Array.from({ length: count }, (_, i) => finishPlacesStart + i);

  if (splitTies) {
    const pooledCash = places.reduce((sum, place) => {
      const p = payouts.find((item) => item.place === place);
      return sum + (p ? p.amount : 0);
    }, 0);
    const splitAmount = Math.round(pooledCash / count);
    const placeRangeLabel =
      count > 1 ? `${places[0]}-${places[places.length - 1]}th (Tie)` : `${places[0]}th`;

    return eliminatedPlayers.map((player) => ({
      ...player,
      place: places[0],
      placeLabel: placeRangeLabel,
      payout: splitAmount,
      tied: count > 1,
    }));
  }

  const sorted = [...eliminatedPlayers].sort(
    (a, b) => (Number(b.stackAtElimination) || 0) - (Number(a.stackAtElimination) || 0)
  );

  return sorted.map((player, idx) => {
    const assignedPlace = places[idx];
    const p = payouts.find((item) => item.place === assignedPlace);
    return {
      ...player,
      place: assignedPlace,
      placeLabel: `${assignedPlace}th`,
      payout: p ? p.amount : 0,
      tied: false,
    };
  });
}
