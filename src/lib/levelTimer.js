import { nextHand, parseAmount } from './poker';

export const LEVEL_METHODS = [
  { id: 'minutes', label: 'Minutes' },
  { id: 'hands', label: 'Hands' },
  { id: 'orbits', label: 'Orbits' },
];

export const LEVEL_DEFAULTS = { minutes: 20, hands: 15, orbits: 2 };
export const BREAK_DEFAULT_MINUTES = 5;

export function defaultLevelConfig() {
  return { method: 'minutes', value: LEVEL_DEFAULTS.minutes };
}

function effectiveElapsed(hand, now) {
  const n = hand.pauseStart != null ? hand.pauseStart : now;
  return (n - (hand.levelStartEpoch || n)) - (hand.pausedMs || 0);
}

function segmentExpired(hand, now) {
  const schedule = hand.blindSchedule || [];
  const tLevel = hand.tLevel || 0;
  const item = schedule[tLevel];
  if (!item) return false;
  const cfg = hand.levelConfig || defaultLevelConfig();
  const method = cfg.method || 'minutes';

  if (item.type === 'break') {
    const dur = (Number(item.minutes) || 0) * 60000;
    if (!dur) return true;
    return effectiveElapsed(hand, now) >= dur;
  }

  const levelMinutes = Number(item.minutes);
  const minutes = (levelMinutes != null && levelMinutes > 0) ? levelMinutes : (Number(cfg.value) || 0);
  if (method === 'minutes') {
    const dur = minutes * 60000;
    return effectiveElapsed(hand, now) >= dur;
  }
  if (method === 'hands') return (hand.levelHandsCompleted || 0) >= (Number(cfg.value) || 0);
  const orbits = Math.floor((hand.levelHandsCompleted || 0) / Math.max(1, hand.levelCount || 1));
  return orbits >= (Number(cfg.value) || 0);
}

export function initLevelTimer(hand, levelConfig) {
  const cfg = levelConfig || hand?.levelConfig || defaultLevelConfig();
  return {
    ...hand,
    levelConfig: cfg,
    levelStartEpoch: hand?.levelStartEpoch || Date.now(),
    levelHandsCompleted: hand?.levelHandsCompleted || 0,
    levelCount: Math.max(1, hand?.players?.length || 1),
    tLevel: hand?.tLevel ?? 0,
    inBreak: !!hand?.inBreak,
    pausedMs: hand?.pausedMs || 0,
    pauseStart: hand?.pauseStart ?? null,
    pendingLevelIdx: hand?.pendingLevelIdx ?? (hand?.blindLevel || 0),
  };
}

export function levelTimerState(hand, now = Date.now()) {
  if (!hand || hand.mode !== 'tournament') return { active: false };
  const schedule = hand.blindSchedule || [];
  const tLevel = hand.tLevel || 0;
  const item = schedule[tLevel];
  const cfg = hand.levelConfig || defaultLevelConfig();
  const method = cfg.method || 'minutes';
  const phase = item?.type === 'break' ? 'break' : 'level';
  let remainingMs = null;
  let progress = null;
  let expired = false;

  if (phase === 'break') {
    const dur = (Number(item?.minutes) || 0) * 60000;
    const elapsed = effectiveElapsed(hand, now);
    remainingMs = dur > 0 ? Math.max(0, dur - elapsed) : 0;
    progress = { remainingMs };
    expired = dur > 0 && remainingMs <= 0;
  } else if (method === 'minutes') {
    const levelMinutes = Number(item?.minutes);
    const minutes = (levelMinutes != null && levelMinutes > 0) ? levelMinutes : (Number(cfg.value) || 0);
    const dur = minutes * 60000;
    const elapsed = effectiveElapsed(hand, now);
    remainingMs = Math.max(0, dur - elapsed);
    progress = { remainingMs };
    expired = dur > 0 && remainingMs <= 0;
  } else if (method === 'hands') {
    const done = hand.levelHandsCompleted || 0;
    progress = { done, total: Number(cfg.value) || 0 };
    expired = Number(cfg.value) > 0 && done >= Number(cfg.value);
  } else {
    const orbits = Math.floor((hand.levelHandsCompleted || 0) / Math.max(1, hand.levelCount || 1));
    progress = { done: orbits, total: Number(cfg.value) || 0 };
    expired = Number(cfg.value) > 0 && orbits >= Number(cfg.value);
  }

  return {
    active: true,
    config: cfg,
    method,
    phase,
    remainingMs,
    progress,
    expired,
    paused: hand.pauseStart != null,
  };
}

export function formatTimer(st) {
  if (!st || !st.active) return '';
  if (st.method === 'minutes' || st.phase === 'break') {
    const s = Math.max(0, Math.ceil((st.remainingMs || 0) / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
  return `${st.progress.done}/${st.progress.total}`;
}

export function formatTimerLabel(st) {
  if (!st || !st.active) return '';
  if (st.phase === 'break') return 'break';
  return st.method === 'minutes' ? 'level' : st.method === 'hands' ? 'hands' : 'orbits';
}

export function scheduledLevelNumber(hand) {
  if (!hand) return 1;
  const schedule = hand.blindSchedule || [];
  if (!schedule.length) return (hand.blindLevel || 0) + 1;
  const tLevel = hand.tLevel || 0;
  let count = 0;
  for (let i = 0; i <= tLevel && i < schedule.length; i++) {
    if (schedule[i]?.type !== 'break') count++;
  }
  return Math.max(1, count);
}

export function appliedLevelNumber(hand) {
  if (!hand) return 1;
  const schedule = hand.blindSchedule || [];
  if (!schedule.length) return (hand.blindLevel || 0) + 1;
  const blindLevel = hand.blindLevel || 0;
  let count = 0;
  for (let i = 0; i <= blindLevel && i < schedule.length; i++) {
    if (schedule[i]?.type !== 'break') count++;
  }
  return Math.max(1, count);
}

export function nudgeLevelTimer(hand, deltaMs) {
  if (!hand) return hand;
  const cfg = hand.levelConfig || defaultLevelConfig();
  if (cfg.method !== 'minutes') return hand;
  if (hand.pauseStart != null) {
    return { ...hand, pauseStart: hand.pauseStart - deltaMs };
  }
  return { ...hand, levelStartEpoch: (hand.levelStartEpoch || Date.now()) + deltaMs };
}

export function pauseLevelTimer(hand) {
  if (hand?.levelConfig?.method !== 'minutes' || hand.pauseStart != null) return hand;
  return { ...hand, pauseStart: Date.now() };
}

export function resumeLevelTimer(hand) {
  if (!hand || hand.pauseStart == null) return hand;
  const now = Date.now();
  const pausedDur = now - hand.pauseStart;
  return {
    ...hand,
    pauseStart: null,
    levelStartEpoch: (hand.levelStartEpoch || now) + pausedDur,
  };
}

export function advanceTimerSegment(hand, now = Date.now()) {
  if (!hand || hand.pauseStart != null) return hand;
  let h = hand;
  let guard = 0;
  while (segmentExpired(h, now) && guard < 20) {
    const schedule = h.blindSchedule || [];
    const next = (h.tLevel || 0) + 1;
    if (next >= schedule.length) break;
    const nextItem = schedule[next];
    if (nextItem?.type === 'break') {
      const rc = nextItem.race;
      const race = rc && Number(rc.retired) > 0 && Number(rc.replacement) > 0
        ? { ...rc, tLevel: next }
        : null;
      h = {
        ...h,
        inBreak: true,
        tLevel: next,
        levelStartEpoch: now,
        levelHandsCompleted: 0,
        pendingRace: race,
      };
    } else {
      h = {
        ...h,
        inBreak: false,
        tLevel: next,
        levelStartEpoch: now,
        levelHandsCompleted: 0,
        pendingLevelIdx: next,
      };
    }
    guard++;
  }
  return h;
}

export function applyNextLevel(hand) {
  const schedule = hand.blindSchedule || [];
  let target = hand.pendingLevelIdx ?? hand.blindLevel ?? 0;
  while (target < schedule.length && schedule[target]?.type === 'break') target++;
  if (target >= schedule.length) {
    return { ...hand, blindLevel: hand.blindLevel };
  }
  const lvl = schedule[target];
  const bbNum = parseAmount(lvl.bigBlind) ?? Number(lvl.bigBlind) ?? 0;
  const sbNum = parseAmount(lvl.smallBlind) ?? Number(lvl.smallBlind) ?? 0;
  const anteNum = parseAmount(lvl.ante) ?? Number(lvl.ante) ?? 0;
  const ante = hand.anteType === 'bba'
    ? bbNum
    : (lvl.ante != null && lvl.ante !== '' ? anteNum : 0);
  return {
    ...hand,
    smallBlind: sbNum,
    bigBlind: bbNum,
    anteAmount: hand.anteType === 'bba' ? bbNum : ante,
    blindLevel: target,
  };
}

export function advanceToNextHand(hand) {
  const st = levelTimerState(hand);
  let base = hand;
  if (st.active && st.method !== 'minutes') {
    base = { ...hand, levelHandsCompleted: (hand.levelHandsCompleted || 0) + 1 };
  }
  base = advanceTimerSegment(base);
  for (let i = 0; i < 3; i++) {
    const s = levelTimerState(base);
    if (!s.active || !s.expired) break;
    base = advanceTimerSegment(base);
  }
  const applied = applyNextLevel(base);
  return nextHand(applied);
}
