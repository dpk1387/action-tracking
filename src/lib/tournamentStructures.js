import { formatKM, parseAmount } from './poker';

export const LOWEST_DENOMINATIONS = [1, 5, 10, 25, 50, 100, 500];

export const ALL_DENOMINATIONS = [
  1, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000, 25000, 100000,
];

export function defaultDenomsFor(lowestChip = 25) {
  const c = Number(lowestChip) || 25;
  if (c <= 1) return [1, 5, 25, 100, 500];
  if (c <= 5) return [5, 25, 100, 500, 1000];
  if (c <= 10) return [10, 25, 100, 500, 1000];
  if (c <= 25) return [25, 100, 500, 1000, 5000];
  if (c <= 50) return [50, 100, 500, 1000, 5000];
  if (c <= 100) return [100, 500, 1000, 5000, 25000];
  return [500, 1000, 5000, 25000, 100000];
}

export function firstBreakLevelNum(schedule = []) {
  let count = 0;
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i].type === 'break') {
      return Math.max(1, count);
    }
    count++;
  }
  return 4;
}

const lvl = (sb, bb, min = '') => ({
  type: 'level',
  smallBlind: formatKM(sb),
  bigBlind: formatKM(bb),
  ante: formatKM(bb),
  minutes: min,
});

const bombLvl = (ante, min = '') => ({
  type: 'level',
  smallBlind: '0',
  bigBlind: '0',
  ante: formatKM(ante),
  minutes: min,
});

const brk = (min = 10, race = null) => ({
  type: 'break',
  minutes: min,
  race: race ? { retired: formatKM(race.retired), replacement: formatKM(race.replacement) } : null,
});

/**
 * Standard Default Tournament Structures from Official PDF:
 * Columns: 1, 5, 10, 25, 50, 100, 500
 */
export function defaultScheduleFor(lowest = 25) {
  const base = Number(lowest) || 25;

  if (base === 1) {
    return [
      lvl(1, 2),
      lvl(2, 3),
      lvl(2, 4),
      lvl(3, 6),
      brk(10),
      lvl(4, 8),
      lvl(5, 10),
      lvl(6, 12),
      lvl(8, 16),
      brk(10, { retired: 1, replacement: 5 }),
      lvl(10, 20),
      lvl(10, 25),
      lvl(15, 30),
      lvl(20, 40),
      brk(10),
      lvl(25, 50),
      lvl(30, 60),
      lvl(40, 80),
      lvl(50, 100),
    ];
  }

  if (base === 5) {
    return [
      lvl(5, 10),
      lvl(10, 15),
      lvl(10, 20),
      lvl(15, 30),
      brk(10),
      lvl(20, 40),
      lvl(25, 50),
      lvl(30, 60),
      lvl(40, 80),
      brk(10),
      lvl(50, 100),
      lvl(60, 120),
      lvl(80, 160),
      lvl(100, 200),
      brk(10, { retired: 5, replacement: 25 }),
      lvl(125, 250),
      lvl(150, 300),
      lvl(200, 400),
      lvl(250, 500),
    ];
  }

  if (base === 10) {
    return [
      lvl(10, 20),
      lvl(20, 30),
      lvl(20, 40),
      lvl(30, 60),
      brk(10),
      lvl(40, 80),
      lvl(50, 100),
      lvl(60, 120),
      lvl(80, 160),
      brk(10, { retired: 10, replacement: 25 }),
      lvl(100, 200),
      lvl(125, 250),
      lvl(150, 300),
      lvl(200, 400),
      brk(10, { retired: 25, replacement: 100 }),
      lvl(300, 500),
      lvl(300, 600),
      lvl(400, 800),
      lvl(500, 1000),
    ];
  }

  if (base === 50) {
    return [
      lvl(50, 100),
      lvl(100, 150),
      lvl(100, 200),
      lvl(150, 300),
      brk(10),
      lvl(200, 400),
      lvl(250, 500),
      lvl(300, 600),
      lvl(400, 800),
      brk(10, { retired: 50, replacement: 100 }),
      lvl(500, 1000),
      lvl(600, 1200),
      lvl(800, 1600),
      lvl(1000, 2000),
      brk(10, { retired: 100, replacement: 500 }),
      lvl(1000, 2500),
      lvl(1500, 3000),
      lvl(2000, 4000),
      lvl(2500, 5000),
    ];
  }

  if (base === 100) {
    return [
      lvl(100, 200),
      lvl(200, 300),
      lvl(200, 400),
      lvl(300, 600),
      brk(10),
      lvl(400, 800),
      lvl(500, 1000),
      lvl(600, 1200),
      lvl(800, 1600),
      brk(10, { retired: 100, replacement: 500 }),
      lvl(1000, 2000),
      lvl(1000, 2500),
      lvl(1500, 3000),
      lvl(2000, 4000),
      brk(10, { retired: 500, replacement: 1000 }),
      lvl(3000, 5000),
      lvl(3000, 6000),
      lvl(4000, 8000),
      lvl(5000, 10000),
    ];
  }

  if (base === 500) {
    return [
      lvl(500, 1000),
      lvl(1000, 1500),
      lvl(1000, 2000),
      lvl(1500, 3000),
      brk(10),
      lvl(2000, 4000),
      lvl(2500, 5000),
      lvl(3000, 6000),
      lvl(4000, 8000),
      brk(10, { retired: 500, replacement: 1000 }),
      lvl(5000, 10000),
      lvl(6000, 12000),
      lvl(8000, 16000),
      lvl(10000, 20000),
      brk(10, { retired: 1000, replacement: 5000 }),
      lvl(10000, 25000),
      lvl(15000, 30000),
      lvl(20000, 40000),
      lvl(25000, 50000),
    ];
  }

  // Default base = 25 (Standard PDF structure)
  return [
    lvl(25, 50),
    lvl(50, 75),
    lvl(50, 100),
    lvl(75, 150),
    brk(10),
    lvl(100, 200),
    lvl(125, 250),
    lvl(150, 300),
    lvl(200, 400),
    brk(10),
    lvl(250, 500),
    { type: 'break', minutes: 2, isColorUp: true, race: { retired: '25', replacement: '100' } },
    lvl(300, 600),
    lvl(400, 800),
    lvl(500, 1000),
    brk(10),
    lvl(600, 1200),
    lvl(800, 1600),
    lvl(1000, 2000),
    lvl(1000, 2500),
  ];
}

export function suggestNextBlinds(schedule = [], chipDenominations = []) {
  const denoms = (chipDenominations || []).map(Number).filter((d) => d > 0);
  const base = denoms.length ? Math.min(...denoms) : 25;

  const levels = (schedule || []).filter((l) => l && l.type !== 'break' && l.type !== 'color_up');
  if (levels.length === 0) {
    return { smallBlind: formatKM(base), bigBlind: formatKM(base * 2) };
  }

  const last = levels[levels.length - 1];
  const lastBB = (parseAmount(last.bigBlind) ?? Number(last.bigBlind)) || base * 2;

  let nextBB;
  if (lastBB < base * 2) {
    nextBB = base * 2;
  } else if (lastBB < 100) {
    nextBB = Math.round((lastBB * 1.5) / base) * base;
    if (nextBB <= lastBB) nextBB = lastBB + base;
  } else {
    const raw = lastBB * 1.5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = mag >= 1000 ? mag / 2 : mag / 10;
    nextBB = Math.max(lastBB + base, Math.round(raw / step) * step);
  }

  const nextSB = Math.round(nextBB / 2);
  return { smallBlind: formatKM(nextSB), bigBlind: formatKM(nextBB) };
}

export function bombPotScheduleFor(lowest = 25) {
  const base = Number(lowest) || 25;
  const mults = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 40, 50, 60, 80, 100];
  const out = [];
  mults.forEach((m, idx) => {
    out.push(bombLvl(m * base));
    if ((idx + 1) % 4 === 0 && idx < mults.length - 1) {
      out.push(brk(10));
    }
  });
  return out;
}

export function suggestNextAnte(schedule = [], chipDenominations = []) {
  const denoms = (chipDenominations || []).map(Number).filter((d) => d > 0);
  const base = denoms.length ? Math.min(...denoms) : 25;
  const levels = (schedule || []).filter((l) => l && l.type !== 'break' && l.type !== 'color_up');
  if (levels.length === 0) return formatKM(base);
  const last = levels[levels.length - 1];
  const lastAnte = (parseAmount(last.ante) ?? Number(last.ante)) || base;
  let nextAnte;
  if (lastAnte < 100) {
    nextAnte = Math.round((lastAnte * 1.5) / base) * base;
    if (nextAnte <= lastAnte) nextAnte = lastAnte + base;
  } else {
    const raw = lastAnte * 1.5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = mag >= 1000 ? mag / 2 : mag / 10;
    nextAnte = Math.max(lastAnte + base, Math.round(raw / step) * step);
  }
  return formatKM(nextAnte);
}

/**
 * Generate a complete tournament blind schedule based on:
 * - level length (minutes)
 * - break length (minutes)
 * - break frequency (every X levels) OR colorUpBreaksOnly
 * - desired total tournament length in minutes (0 = unconstrained standard length)
 * - speed profile ('balanced' vs 'turbo')
 * - lowest chip denomination & selected chipDenominations
 * - starting stack
 * - bombPot (ante-only increasing schedule)
 */
export function generateBlindSchedule({
  lowestChip = 25,
  startingStack = 10000,
  levelDurationMinutes = 15,
  breakDurationMinutes = 10,
  breakEveryLevels = 4,
  desiredMinutes = 0,
  colorUpBreaksOnly = false,
  chipDenominations = [],
  speed = 'balanced',
  anteType = 'bba',
  bombPot = false,
} = {}) {
  const rawBase = Math.max(1, Number(lowestChip) || 25);
  const sortedDenoms = (Array.isArray(chipDenominations) ? chipDenominations : [])
    .map(Number)
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
  const denoms = sortedDenoms.length > 0 ? sortedDenoms : defaultDenomsFor(rawBase);
  const base = denoms[0] || rawBase;
  const activeDenoms = [...denoms];

  const stack = Math.max(base * 10, Number(startingStack) || 10000);
  const lvlMin = Math.max(1, Number(levelDurationMinutes) || 15);
  const brkMin = Math.max(1, Number(breakDurationMinutes) || 10);
  const brkFreq = Math.max(1, Math.min(12, Number(breakEveryLevels) || 4));
  const targetMin = Math.max(0, Number(desiredMinutes) || 0);
  const isTurbo = speed === 'turbo';

  const balancedMultipliers = [
    [1, 2],
    [2, 3],
    [2, 4],
    [3, 6],
    [4, 8],
    [5, 10],
    [6, 12],
    [8, 16],
    [10, 20],
    [12, 24],
    [16, 32],
    [20, 40],
    [24, 48],
    [30, 60],
    [40, 80],
    [50, 100],
    [60, 120],
    [80, 160],
    [100, 200],
    [120, 240],
    [160, 320],
    [200, 400],
    [240, 480],
    [320, 640],
    [400, 800],
    [500, 1000],
    [600, 1200],
    [800, 1600],
    [1000, 2000],
    [1500, 3000],
    [2000, 4000],
    [3000, 6000],
    [4000, 8000],
    [5000, 10000],
    [6000, 12000],
    [8000, 16000],
    [10000, 20000],
  ];

  const turboMultipliers = [
    [1, 2],
    [2, 4],
    [3, 6],
    [4, 8],
    [6, 12],
    [8, 16],
    [12, 24],
    [16, 32],
    [20, 40],
    [30, 60],
    [40, 80],
    [60, 120],
    [80, 160],
    [120, 240],
    [200, 400],
    [320, 640],
    [400, 800],
    [600, 1200],
    [1000, 2000],
    [1600, 3200],
    [2000, 4000],
    [3000, 6000],
    [4000, 8000],
    [6000, 12000],
    [8000, 16000],
    [10000, 20000],
  ];

  const baseMultipliers = isTurbo ? turboMultipliers : balancedMultipliers;

  // Determine starting index based on starting stack so players don't start absurdly deep (>300 BB)
  let startIdx = 0;
  if (stack / (2 * base) > 300) {
    const targetBB = stack / 200;
    for (let i = 0; i < baseMultipliers.length; i++) {
      if (baseMultipliers[i][1] * base >= targetBB) {
        startIdx = i;
        break;
      }
    }
  }

  let levelPairs = baseMultipliers.slice(startIdx).map(([s, b]) => [s * base, b * base]);

  // If desiredMinutes is set, determine how many play levels fit in the time budget
  // and select an appropriately paced progression across that level count
  if (targetMin > 0) {
    let maxLevels = 1;
    if (colorUpBreaksOnly) {
      maxLevels = Math.max(1, Math.floor(targetMin / lvlMin));
    } else {
      for (let k = 1; k <= 60; k++) {
        const numBreaks = Math.floor((k - 1) / brkFreq);
        const totalTime = k * lvlMin + numBreaks * brkMin;
        if (totalTime <= targetMin) {
          maxLevels = k;
        } else {
          break;
        }
      }
    }

    const startPair = levelPairs[0] || [base, base * 2];
    const startBB = startPair[1];
    // Target endgame BB so short tournaments still escalate enough to finish
    const minGrowth = startBB * Math.pow(isTurbo ? 1.75 : 1.4, Math.max(1, maxLevels - 1));
    const stackTargetBB = stack * (isTurbo ? 0.25 : 0.12);
    const targetEndBB = Math.max(minGrowth, stackTargetBB);

    if (maxLevels === 1) {
      levelPairs = [startPair];
    } else if (maxLevels < levelPairs.length) {
      // Build a fine pool of clean chip-friendly blind pairs from baseMultipliers
      const chosen = [startPair];
      for (let i = 1; i < maxLevels; i++) {
        const t = i / (maxLevels - 1);
        const idealBB = startBB * Math.pow(targetEndBB / startBB, t);
        const prevBB = chosen[chosen.length - 1][1];
        // Find candidate in levelPairs strictly > prevBB and closest in log space to idealBB
        let bestPair = null;
        let bestDist = Infinity;
        for (let j = 0; j < levelPairs.length; j++) {
          const cand = levelPairs[j];
          if (cand[1] <= prevBB) continue;
          const dist = Math.abs(Math.log(cand[1]) - Math.log(idealBB));
          if (dist < bestDist) {
            bestDist = dist;
            bestPair = cand;
          }
        }
        if (bestPair) {
          chosen.push(bestPair);
        } else {
          const last = chosen[chosen.length - 1];
          chosen.push([last[0] * 2, last[1] * 2]);
        }
      }
      levelPairs = chosen;
    }
  }

  const calcAnte = (bb, minChip) => {
    if (anteType === 'bba' || anteType === 'btn_ante') return formatKM(bb);
    if (anteType === 'sb_half_ante') return formatKM(Math.max(minChip, Math.round((bb * 0.5) / minChip) * minChip));
    if (anteType === 'traditional') {
      const trad = Math.max(minChip, Math.round((bb * 0.25) / minChip) * minChip);
      return formatKM(trad);
    }
    return '0';
  };

  const snapToChip = (val, chip) => {
    if (chip <= 1) return Math.round(val);
    return Math.max(chip, Math.round(val / chip) * chip);
  };

  const schedule = [];
  let playLevelsCount = 0;
  let elapsedMinutes = 0;

  for (let idx = 0; idx < levelPairs.length; idx++) {
    if (targetMin > 0 && playLevelsCount >= 1 && elapsedMinutes + lvlMin > targetMin) {
      break;
    }

    const currentMinChip = activeDenoms[0] || base;
    let [sb, bb] = levelPairs[idx];
    sb = snapToChip(sb, currentMinChip);
    bb = snapToChip(bb, currentMinChip);
    if (bb <= sb) bb = sb * 2;

    if (bombPot) {
      const anteVal = sb;
      schedule.push({
        type: 'level',
        smallBlind: '0',
        bigBlind: '0',
        ante: formatKM(anteVal),
        minutes: lvlMin,
      });
    } else {
      schedule.push({
        type: 'level',
        smallBlind: formatKM(sb),
        bigBlind: formatKM(bb),
        ante: calcAnte(bb, currentMinChip),
        minutes: lvlMin,
      });
    }
    playLevelsCount++;
    elapsedMinutes += lvlMin;

    // Look ahead at next level to detect if lowest active chip should be colored up now
    let colorUpRace = null;
    if (activeDenoms.length >= 2) {
      const retired = activeDenoms[0];
      const replacement = activeDenoms[1];
      const nextRaw = levelPairs[idx + 1];
      const nextFitsReplacement = nextRaw
        ? (bombPot ? (nextRaw[0] >= replacement && nextRaw[0] % replacement === 0) : (nextRaw[0] >= replacement && nextRaw[0] % replacement === 0 && nextRaw[1] % replacement === 0))
        : false;
      if (sb >= retired * 8 || (nextFitsReplacement && sb >= retired * 4)) {
        colorUpRace = { retired, replacement };
      }
    }

    if (colorUpBreaksOnly) {
      // Only insert breaks when a chip denomination is being colored up (and room remains for another level)
      const hasRoomAfterBreak = targetMin <= 0 || (elapsedMinutes + brkMin + lvlMin <= targetMin);
      const hasMoreLevels = idx < levelPairs.length - 1;
      if (colorUpRace && hasMoreLevels && hasRoomAfterBreak) {
        schedule.push({
          type: 'break',
          minutes: brkMin,
          isColorUp: true,
          race: { retired: formatKM(colorUpRace.retired), replacement: formatKM(colorUpRace.replacement) },
        });
        elapsedMinutes += brkMin;
        activeDenoms.shift();
      }
    } else {
      // Insert scheduled break every brkFreq levels (never at the very end)
      const hasMoreLevels = idx < levelPairs.length - 1;
      const hasRoomAfterBreak = targetMin <= 0 || (elapsedMinutes + brkMin + lvlMin <= targetMin);
      if (playLevelsCount % brkFreq === 0 && hasMoreLevels && hasRoomAfterBreak) {
        if (colorUpRace) {
          activeDenoms.shift();
        }
        schedule.push({
          type: 'break',
          minutes: brkMin,
          isColorUp: Boolean(colorUpRace),
          race: colorUpRace
            ? { retired: formatKM(colorUpRace.retired), replacement: formatKM(colorUpRace.replacement) }
            : null,
        });
        elapsedMinutes += brkMin;
      } else if (colorUpRace) {
        // Track chip retirement internally even if break isn't scheduled on this exact level
        activeDenoms.shift();
      }
    }
  }

  return schedule;
}
