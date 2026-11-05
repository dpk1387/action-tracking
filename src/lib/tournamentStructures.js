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
