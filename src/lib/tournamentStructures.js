export const ALL_DENOMINATIONS = [
  0.05, 0.1, 0.25, 0.5, 1, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000, 25000, 100000,
];

export function defaultDenomsFor(lowestChip = 25) {
  const c = Number(lowestChip) || 25;
  if (c <= 0.05) return [0.05, 0.25, 1, 5, 25];
  if (c <= 0.1) return [0.1, 0.5, 1, 5, 25];
  if (c <= 0.25) return [0.25, 1, 5, 25, 100];
  if (c <= 0.5) return [0.5, 1, 5, 25, 100];
  if (c <= 1) return [1, 5, 25, 100, 500];
  if (c <= 5) return [5, 25, 100, 500, 1000];
  if (c <= 10) return [10, 25, 100, 500, 1000];
  if (c <= 25) return [25, 100, 500, 1000, 5000];
  if (c <= 50) return [50, 100, 500, 1000, 5000];
  if (c <= 100) return [100, 500, 1000, 5000, 25000];
  if (c <= 500) return [500, 1000, 5000, 25000, 100000];
  if (c <= 1000) return [1000, 5000, 25000, 100000];
  if (c <= 5000) return [5000, 25000, 100000];
  if (c <= 10000) return [10000, 25000, 100000];
  return [25000, 100000];
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

const lvl = (sb, bb, min = 20) => ({
  type: 'level',
  smallBlind: sb,
  bigBlind: bb,
  ante: bb,
  minutes: min,
});

const brk = (min = 10, race = null) => ({
  type: 'break',
  minutes: min,
  race,
});

export function defaultScheduleFor(lowest = 25) {
  const base = Number(lowest) || 25;

  if (base === 0.05) {
    return [
      lvl(0.05, 0.1),
      lvl(0.1, 0.2),
      lvl(0.15, 0.3),
      brk(10),
      lvl(0.2, 0.4),
      lvl(0.25, 0.5),
      lvl(0.3, 0.6),
      brk(10),
      lvl(0.4, 0.8),
      lvl(0.5, 1),
      lvl(0.6, 1.2),
      brk(10, { retired: 0.05, replacement: 0.25 }),
      lvl(0.75, 1.5),
      lvl(1, 2),
      lvl(1.25, 2.5),
      brk(10),
      lvl(1.5, 3),
      lvl(2, 4),
      lvl(2.5, 5),
    ];
  }

  if (base === 0.1) {
    return [
      lvl(0.1, 0.2),
      lvl(0.2, 0.4),
      lvl(0.3, 0.6),
      brk(10),
      lvl(0.4, 0.8),
      lvl(0.5, 1),
      lvl(0.6, 1.2),
      brk(10, { retired: 0.1, replacement: 0.25 }),
      lvl(0.75, 1.5),
      lvl(1, 2),
      lvl(1.25, 2.5),
      brk(10),
      lvl(1.5, 3),
      lvl(2, 4),
      lvl(2.5, 5),
      brk(10, { retired: 0.25, replacement: 1 }),
      lvl(3, 6),
      lvl(4, 8),
      lvl(5, 10),
    ];
  }

  if (base === 0.25) {
    return [
      lvl(0.25, 0.5),
      lvl(0.5, 1),
      lvl(0.75, 1.5),
      brk(10),
      lvl(1, 2),
      lvl(1.25, 2.5),
      lvl(1.5, 3),
      brk(10),
      lvl(2, 4),
      lvl(2.5, 5),
      lvl(3, 6),
      brk(10, { retired: 0.25, replacement: 1 }),
      lvl(4, 8),
      lvl(5, 10),
      lvl(6, 12),
      brk(10),
      lvl(8, 16),
      lvl(10, 20),
      lvl(10, 25),
    ];
  }

  if (base === 0.5) {
    return [
      lvl(0.5, 1),
      lvl(1, 2),
      lvl(1.5, 3),
      brk(10),
      lvl(2, 4),
      lvl(2.5, 5),
      lvl(3, 6),
      brk(10, { retired: 0.5, replacement: 1 }),
      lvl(4, 8),
      lvl(5, 10),
      lvl(6, 12),
      brk(10),
      lvl(8, 16),
      lvl(10, 20),
      brk(10, { retired: 1, replacement: 5 }),
      lvl(10, 25),
      lvl(15, 30),
      lvl(20, 40),
      lvl(25, 50),
    ];
  }

  if (base === 1) {
    return [
      lvl(1, 2),
      lvl(2, 4),
      lvl(3, 6),
      brk(10),
      lvl(4, 8),
      lvl(5, 10),
      lvl(6, 12),
      brk(10),
      lvl(8, 16),
      lvl(10, 20),
      brk(10, { retired: 1, replacement: 5 }),
      lvl(10, 25),
      lvl(15, 30),
      lvl(20, 40),
      lvl(25, 50),
      brk(10),
      lvl(30, 60),
      lvl(40, 80),
      lvl(50, 100),
    ];
  }

  if (base === 5) {
    return [
      lvl(5, 10),
      lvl(10, 20),
      lvl(15, 30),
      brk(10),
      lvl(20, 40),
      lvl(25, 50),
      lvl(30, 60),
      brk(10),
      lvl(40, 80),
      lvl(50, 100),
      lvl(60, 120),
      brk(10, { retired: 5, replacement: 25 }),
      lvl(75, 150),
      lvl(100, 200),
      lvl(125, 250),
      brk(10),
      lvl(150, 300),
      lvl(200, 400),
      lvl(250, 500),
    ];
  }

  if (base === 10) {
    return [
      lvl(10, 20),
      lvl(20, 40),
      lvl(30, 60),
      brk(10),
      lvl(40, 80),
      lvl(50, 100),
      lvl(60, 120),
      brk(10, { retired: 10, replacement: 25 }),
      lvl(75, 150),
      lvl(100, 200),
      lvl(125, 250),
      brk(10),
      lvl(150, 300),
      lvl(200, 400),
      lvl(250, 500),
      brk(10, { retired: 25, replacement: 100 }),
      lvl(300, 600),
      lvl(400, 800),
      lvl(500, 1000),
    ];
  }

  if (base === 25) {
    return [
      lvl(25, 50),
      lvl(50, 100),
      lvl(75, 150),
      brk(10),
      lvl(100, 200),
      lvl(125, 250),
      lvl(150, 300),
      brk(10),
      lvl(200, 400),
      lvl(250, 500),
      lvl(300, 600),
      brk(10, { retired: 25, replacement: 100 }),
      lvl(400, 800),
      lvl(500, 1000),
      lvl(600, 1200),
      brk(10),
      lvl(800, 1600),
      lvl(1000, 2000),
      lvl(1000, 2500),
    ];
  }

  if (base === 50) {
    return [
      lvl(50, 100),
      lvl(100, 200),
      lvl(150, 300),
      brk(10),
      lvl(200, 400),
      lvl(250, 500),
      lvl(300, 600),
      brk(10, { retired: 50, replacement: 100 }),
      lvl(400, 800),
      lvl(500, 1000),
      lvl(600, 1200),
      brk(10),
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
      lvl(200, 400),
      lvl(300, 600),
      brk(10),
      lvl(400, 800),
      lvl(500, 1000),
      lvl(600, 1200),
      brk(10),
      lvl(800, 1600),
      lvl(1000, 2000),
      brk(10, { retired: 100, replacement: 500 }),
      lvl(1000, 2500),
      lvl(1500, 3000),
      lvl(2000, 4000),
      lvl(2500, 5000),
      brk(10),
      lvl(3000, 6000),
      lvl(4000, 8000),
      lvl(5000, 10000),
    ];
  }

  if (base === 500) {
    return [
      lvl(500, 1000),
      lvl(1000, 2000),
      lvl(1500, 3000),
      brk(10),
      lvl(2000, 4000),
      lvl(2500, 5000),
      lvl(3000, 6000),
      brk(10, { retired: 500, replacement: 1000 }),
      lvl(4000, 8000),
      lvl(5000, 10000),
      lvl(6000, 12000),
      brk(10),
      lvl(8000, 16000),
      lvl(10000, 20000),
      brk(10, { retired: 1000, replacement: 5000 }),
      lvl(10000, 25000),
      lvl(15000, 30000),
      lvl(20000, 40000),
      lvl(25000, 50000),
    ];
  }

  if (base === 1000) {
    return [
      lvl(1000, 2000),
      lvl(2000, 4000),
      lvl(3000, 6000),
      brk(10),
      lvl(4000, 8000),
      lvl(5000, 10000),
      lvl(6000, 12000),
      brk(10),
      lvl(8000, 16000),
      lvl(10000, 20000),
      brk(10, { retired: 1000, replacement: 5000 }),
      lvl(10000, 25000),
      lvl(15000, 30000),
      lvl(20000, 40000),
      lvl(25000, 50000),
      brk(10),
      lvl(30000, 60000),
      lvl(40000, 80000),
      lvl(50000, 100000),
    ];
  }

  if (base === 5000) {
    return [
      lvl(5000, 10000),
      lvl(10000, 20000),
      lvl(15000, 30000),
      brk(10),
      lvl(20000, 40000),
      lvl(25000, 50000),
      lvl(30000, 60000),
      brk(10, { retired: 5000, replacement: 25000 }),
      lvl(40000, 80000),
      lvl(50000, 100000),
      lvl(60000, 120000),
      brk(10),
      lvl(80000, 160000),
      lvl(100000, 200000),
      lvl(125000, 250000),
      brk(10),
      lvl(150000, 300000),
      lvl(200000, 400000),
      lvl(250000, 500000),
    ];
  }

  if (base === 10000) {
    return [
      lvl(10000, 20000),
      lvl(20000, 40000),
      lvl(30000, 60000),
      brk(10),
      lvl(40000, 80000),
      lvl(50000, 100000),
      lvl(60000, 120000),
      brk(10),
      lvl(80000, 160000),
      lvl(100000, 200000),
      brk(10, { retired: 10000, replacement: 25000 }),
      lvl(125000, 250000),
      lvl(150000, 300000),
      lvl(200000, 400000),
      lvl(250000, 500000),
      brk(10, { retired: 25000, replacement: 100000 }),
      lvl(300000, 600000),
      lvl(400000, 800000),
      lvl(500000, 1000000),
    ];
  }

  if (base === 25000) {
    return [
      lvl(25000, 50000),
      lvl(50000, 100000),
      lvl(75000, 150000),
      brk(10),
      lvl(100000, 200000),
      lvl(125000, 250000),
      lvl(150000, 300000),
      brk(10),
      lvl(200000, 400000),
      lvl(250000, 500000),
      lvl(300000, 600000),
      brk(10, { retired: 25000, replacement: 100000 }),
      lvl(400000, 800000),
      lvl(500000, 1000000),
      lvl(600000, 1200000),
      brk(10),
      lvl(800000, 1600000),
      lvl(1000000, 2000000),
      lvl(1000000, 2500000),
    ];
  }

  if (base === 100000) {
    return [
      lvl(100000, 200000),
      lvl(200000, 400000),
      lvl(300000, 600000),
      brk(10),
      lvl(400000, 800000),
      lvl(500000, 1000000),
      lvl(600000, 1200000),
      brk(10),
      lvl(800000, 1600000),
      lvl(1000000, 2000000),
      brk(10, { retired: 100000, replacement: 500000 }),
      lvl(1000000, 2500000),
      lvl(1500000, 3000000),
      lvl(2000000, 4000000),
      lvl(2500000, 5000000),
      brk(10),
      lvl(3000000, 6000000),
      lvl(4000000, 8000000),
      lvl(5000000, 10000000),
    ];
  }

  // Generic fallback scaling cleanly from base
  const b = base;
  return [
    lvl(b, b * 2),
    lvl(b * 2, b * 4),
    lvl(b * 3, b * 6),
    brk(10),
    lvl(b * 4, b * 8),
    lvl(b * 5, b * 10),
    lvl(b * 6, b * 12),
    brk(10),
    lvl(b * 8, b * 16),
    lvl(b * 10, b * 20),
    brk(10, { retired: b, replacement: b * 5 }),
    lvl(b * 10, b * 25),
    lvl(b * 15, b * 30),
    lvl(b * 20, b * 40),
    lvl(b * 25, b * 50),
    brk(10),
    lvl(b * 30, b * 60),
    lvl(b * 40, b * 80),
    lvl(b * 50, b * 100),
  ];
}

export function suggestNextBlinds(schedule = [], chipDenominations = []) {
  const retired = new Set();
  for (const item of schedule) {
    if (item && item.type === 'break' && item.race && item.race.retired) {
      retired.add(Number(item.race.retired));
    }
  }

  const activeChips = (chipDenominations || [])
    .map(Number)
    .filter((d) => d > 0 && !retired.has(d))
    .sort((a, b) => a - b);

  const nonBreaks = schedule.filter((s) => s.type !== 'break');
  if (!nonBreaks.length) {
    const unit = activeChips.length ? activeChips[0] : 25;
    return { smallBlind: unit, bigBlind: unit * 2 };
  }

  const last = nonBreaks[nonBreaks.length - 1];
  const lastBB = Number(last.bigBlind) || 50;
  const lastSB = Number(last.smallBlind) || Math.round(lastBB / 2);

  // Current lowest chip in play
  let unit = activeChips.length ? activeChips[0] : null;
  if (!unit) {
    if (lastSB > 0 && lastBB > 0) {
      const diff = Math.abs(lastBB - lastSB * 2);
      unit = diff > 0 && diff < lastSB ? diff : (lastSB >= 25 && lastSB % 25 === 0 ? 25 : (lastSB >= 5 && lastSB % 5 === 0 ? 5 : 1));
    } else {
      unit = 1;
    }
  }

  // Standard tournament ladder for Big Blinds.
  // Standard decade mantissas: 1, 1.2, 1.5, 2, 2.4, 2.5, 3, 4, 5, 6, 8, 10
  // Every step is a 20% to 33% increase. Avoids tiny 6% steps like 30k -> 32k.
  // After 12k/24k -> 15k/30k -> 20k/40k -> 25k/50k -> 30k/60k -> 40k/80k -> 50k/100k.
  const mantissas = [1, 1.2, 1.5, 2, 2.4, 2.5, 3, 4, 5, 6, 8];
  const standardBBs = [];
  for (let exp = -2; exp <= 9; exp++) {
    const mult = Math.pow(10, exp);
    for (const m of mantissas) {
      standardBBs.push(Math.round(m * mult * 100) / 100);
    }
  }
  standardBBs.sort((a, b) => a - b);

  // Minimum required increase is at least 18%
  const minRequiredBB = Math.max(lastBB * 1.18, lastBB + unit);

  // Find next candidate from standard ladder that is a multiple of unit
  let candidateBB = standardBBs.find((v) => v >= minRequiredBB && Math.abs(v % unit) < 1e-4);

  if (candidateBB == null) {
    // If unit does not cleanly divide any standard step, scale by ~1.25x-1.33x and snap up
    const raw = Math.max(lastBB * 1.25, lastBB + unit);
    candidateBB = Math.ceil(raw / unit) * unit;
  }

  let nextBB = candidateBB;
  let nextSB;

  const half = nextBB / 2;
  if (Math.abs(half % unit) < 1e-4) {
    nextSB = half;
  } else {
    // If half is not an exact multiple of unit (e.g. BB = 25, unit = 1):
    // Snap SB to a multiple of unit, e.g. 10/25 or 12/24
    if (nextBB === 25 && unit === 1) {
      nextSB = 10;
    } else {
      const sbUnits = Math.max(1, Math.floor(half / unit));
      let s = sbUnits * unit;
      if (s >= nextBB) s = nextBB - unit;
      nextSB = s;
    }
  }

  return { smallBlind: nextSB, bigBlind: nextBB };
}
