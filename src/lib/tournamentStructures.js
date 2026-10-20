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

import { formatKM } from './poker';

const lvl = (sb, bb, min = '') => ({
  type: 'level',
  smallBlind: formatKM(sb),
  bigBlind: formatKM(bb),
  ante: formatKM(bb),
  minutes: min,
});

const brk = (min = 10, race = null) => ({
  type: 'break',
  minutes: min,
  race: race ? { retired: formatKM(race.retired), replacement: formatKM(race.replacement) } : null,
});

export function defaultScheduleFor(lowest = 25) {
  const base = Number(lowest) || 25;

  if (base === 1) {
    return [
      lvl(1, 2),
      lvl(2, 4),
      lvl(3, 6),
      brk(10, { retired: 1, replacement: 5 }),
      lvl(5, 10),
      lvl(10, 20),
      lvl(15, 30),
      brk(10),
      lvl(25, 50),
      lvl(40, 80),
      lvl(60, 120),
      brk(10, { retired: 5, replacement: 25 }),
      lvl(100, 200),
      lvl(150, 300),
      lvl(200, 400),
    ];
  }

  if (base === 5) {
    return [
      lvl(5, 10),
      lvl(10, 20),
      lvl(15, 30),
      brk(10, { retired: 5, replacement: 25 }),
      lvl(25, 50),
      lvl(50, 100),
      lvl(75, 150),
      brk(10),
      lvl(100, 200),
      lvl(150, 300),
      lvl(250, 500),
      brk(10, { retired: 25, replacement: 100 }),
      lvl(400, 800),
      lvl(600, 1200),
      lvl(1000, 2000),
    ];
  }

  if (base === 10) {
    return [
      lvl(10, 20),
      lvl(20, 40),
      lvl(30, 60),
      brk(10, { retired: 10, replacement: 25 }),
      lvl(50, 100),
      lvl(100, 200),
      lvl(150, 300),
      brk(10, { retired: 25, replacement: 100 }),
      lvl(200, 400),
      lvl(300, 600),
      lvl(500, 1000),
      brk(10),
      lvl(800, 1600),
      lvl(1200, 2400),
      lvl(2000, 4000),
    ];
  }

  if (base === 25) {
    return [
      lvl(25, 50),
      lvl(50, 100),
      lvl(75, 150),
      brk(10),
      lvl(125, 250),
      lvl(200, 400),
      lvl(300, 600),
      brk(10, { retired: 25, replacement: 100 }),
      lvl(500, 1000),
      lvl(800, 1600),
      lvl(1200, 2400),
      brk(10, { retired: 100, replacement: 500 }),
      lvl(2000, 4000),
      lvl(3000, 6000),
      lvl(5000, 10000),
    ];
  }

  if (base === 50) {
    return [
      lvl(50, 100),
      lvl(100, 200),
      lvl(150, 300),
      brk(10, { retired: 50, replacement: 100 }),
      lvl(300, 600),
      lvl(500, 1000),
      lvl(800, 1600),
      brk(10, { retired: 100, replacement: 500 }),
      lvl(1000, 2500),
      lvl(2000, 4000),
      lvl(3000, 6000),
      brk(10, { retired: 500, replacement: 1000 }),
      lvl(5000, 10000),
      lvl(8000, 16000),
      lvl(10000, 20000),
    ];
  }

  if (base === 100) {
    return [
      lvl(100, 200),
      lvl(200, 400),
      lvl(300, 600),
      brk(10),
      lvl(500, 1000),
      lvl(800, 1600),
      lvl(1200, 2400),
      brk(10, { retired: 100, replacement: 500 }),
      lvl(2000, 4000),
      lvl(3000, 6000),
      lvl(5000, 10000),
      brk(10, { retired: 500, replacement: 1000 }),
      lvl(8000, 16000),
      lvl(12000, 24000),
      lvl(20000, 40000),
    ];
  }

  if (base === 500) {
    return [
      lvl(500, 1000),
      lvl(1000, 2000),
      lvl(1500, 3000),
      brk(10, { retired: 500, replacement: 1000 }),
      lvl(3000, 6000),
      lvl(5000, 10000),
      lvl(8000, 16000),
      brk(10, { retired: 1000, replacement: 5000 }),
      lvl(10000, 25000),
      lvl(20000, 40000),
      lvl(30000, 60000),
      brk(10, { retired: 5000, replacement: 25000 }),
      lvl(50000, 100000),
      lvl(75000, 150000),
      lvl(100000, 200000),
    ];
  }

  if (base === 1000) {
    return [
      lvl(1000, 2000),
      lvl(2000, 4000),
      lvl(3000, 6000),
      brk(10, { retired: 1000, replacement: 5000 }),
      lvl(5000, 10000),
      lvl(10000, 20000),
      lvl(15000, 30000),
      brk(10),
      lvl(25000, 50000),
      lvl(40000, 80000),
      lvl(60000, 120000),
      brk(10, { retired: 5000, replacement: 25000 }),
      lvl(100000, 200000),
      lvl(150000, 300000),
      lvl(200000, 400000),
    ];
  }

  if (base === 5000) {
    return [
      lvl(5000, 10000),
      lvl(10000, 20000),
      lvl(15000, 30000),
      brk(10, { retired: 5000, replacement: 25000 }),
      lvl(25000, 50000),
      lvl(50000, 100000),
      lvl(75000, 150000),
      brk(10),
      lvl(100000, 200000),
      lvl(150000, 300000),
      lvl(250000, 500000),
      brk(10, { retired: 25000, replacement: 100000 }),
      lvl(400000, 800000),
      lvl(600000, 1200000),
      lvl(1000000, 2000000),
    ];
  }

  if (base === 10000) {
    return [
      lvl(10000, 20000),
      lvl(20000, 40000),
      lvl(30000, 60000),
      brk(10, { retired: 10000, replacement: 25000 }),
      lvl(50000, 100000),
      lvl(100000, 200000),
      lvl(150000, 300000),
      brk(10, { retired: 25000, replacement: 100000 }),
      lvl(200000, 400000),
      lvl(300000, 600000),
      lvl(500000, 1000000),
      brk(10),
      lvl(800000, 1600000),
      lvl(1200000, 2400000),
      lvl(2000000, 4000000),
    ];
  }

  if (base === 25000) {
    return [
      lvl(25000, 50000),
      lvl(50000, 100000),
      lvl(75000, 150000),
      brk(10),
      lvl(125000, 250000),
      lvl(200000, 400000),
      lvl(300000, 600000),
      brk(10, { retired: 25000, replacement: 100000 }),
      lvl(500000, 1000000),
      lvl(800000, 1600000),
      lvl(1200000, 2400000),
      brk(10, { retired: 100000, replacement: 500000 }),
      lvl(2000000, 4000000),
      lvl(3000000, 6000000),
      lvl(5000000, 10000000),
    ];
  }

  if (base === 100000) {
    return [
      lvl(100000, 200000),
      lvl(200000, 400000),
      lvl(300000, 600000),
      brk(10),
      lvl(500000, 1000000),
      lvl(800000, 1600000),
      lvl(1200000, 2400000),
      brk(10, { retired: 100000, replacement: 500000 }),
      lvl(2000000, 4000000),
      lvl(3000000, 6000000),
      lvl(5000000, 10000000),
      brk(10, { retired: 500000, replacement: 1000000 }),
      lvl(8000000, 16000000),
      lvl(12000000, 24000000),
      lvl(20000000, 40000000),
    ];
  }

  // Fallback: scale based on 25
  const scale = base / 25;
  return defaultScheduleFor(25).map((item) => {
    if (item.type === 'break') return item;
    return lvl(Math.round(item.smallBlind * scale), Math.round(item.bigBlind * scale));
  });
}

export function suggestNextBlinds(schedule = [], chipDenominations = []) {
  const denoms = (chipDenominations || []).map(Number).filter((d) => d > 0);
  const base = denoms.length ? Math.min(...denoms) : 25;

  const levels = (schedule || []).filter((l) => l && l.type !== 'break');
  if (levels.length === 0) {
    return { smallBlind: base, bigBlind: base * 2 };
  }

  const last = levels[levels.length - 1];
  const lastBB = Number(last.bigBlind) || base * 2;

  // Find where lastBB is in a standard progression, or scale up by ~1.5x - 2x
  let nextBB;
  if (lastBB < base * 2) {
    nextBB = base * 2;
  } else if (lastBB < 100) {
    nextBB = Math.round((lastBB * 1.5) / base) * base;
    if (nextBB <= lastBB) nextBB = lastBB + base;
  } else {
    // Round to nice increment (100, 200, 500, 1000, etc.)
    const raw = lastBB * 1.5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = mag >= 1000 ? mag / 2 : mag / 10;
    nextBB = Math.max(lastBB + base, Math.round(raw / step) * step);
  }

  const nextSB = Math.round(nextBB / 2);
  return { smallBlind: nextSB, bigBlind: nextBB };
}

