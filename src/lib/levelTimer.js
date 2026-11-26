import { nextHand, parseAmount, isBombPotVariant } from './poker';

export const LEVEL_METHODS = [
  { id: 'minutes', label: 'Minutes' },
  { id: 'hands', label: 'Hands' },
  { id: 'orbits', label: 'Orbits' },
];

export const LEVEL_DEFAULTS = { minutes: 15, hands: 15, orbits: 2 };
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

  if (item.type === 'break' || item.type === 'color_up') {
    const isCol = Boolean(item.isColorUp || item.type === 'color_up' || (item.race && (item.race.retired || item.race.replacement)));
    const dur = (Number(item.minutes) || (isCol ? 2 : 10)) * 60000;
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
  const isColorUpBreak = Boolean(item?.isColorUp || item?.type === 'color_up' || (item?.type === 'break' && item?.race && (item?.race?.retired || item?.race?.replacement)));
  const phase = (item?.type === 'break' || item?.type === 'color_up') ? (isColorUpBreak ? 'color_up' : 'break') : 'level';
  let remainingMs = null;
  let progress = null;
  let expired = false;

  if (phase === 'break' || phase === 'color_up') {
    const dur = (Number(item?.minutes) || (isColorUpBreak ? 2 : (phase === 'break' ? 10 : 0))) * 60000;
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
  if (st.method === 'minutes' || st.phase === 'break' || st.phase === 'color_up') {
    const s = Math.max(0, Math.ceil((st.remainingMs || 0) / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
  return `${st.progress.done}/${st.progress.total}`;
}

export function formatTimerLabel(st) {
  if (!st || !st.active) return '';
  if (st.phase === 'color_up') return 'color up';
  if (st.phase === 'break') return 'break';
  return st.method === 'minutes' ? '' : st.method === 'hands' ? 'hands' : 'orbits';
}

export function scheduledLevelNumber(hand) {
  if (!hand) return 1;
  const schedule = hand.blindSchedule || [];
  if (!schedule.length) return (hand.blindLevel || 0) + 1;
  const tLevel = hand.tLevel || 0;
  let count = 0;
  for (let i = 0; i <= tLevel && i < schedule.length; i++) {
    if (schedule[i]?.type !== 'break' && schedule[i]?.type !== 'color_up') count++;
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
    if (schedule[i]?.type !== 'break' && schedule[i]?.type !== 'color_up') count++;
  }
  return Math.max(1, count);
}

export function nudgeLevelTimer(hand, deltaMs) {
  if (!hand) return hand;
  const cfg = hand.levelConfig || defaultLevelConfig();
  const st = levelTimerState(hand);
  const usesMinutes = cfg.method === 'minutes' || st.phase === 'break' || st.phase === 'color_up';
  if (usesMinutes) {
    if (hand.pauseStart != null) {
      return { ...hand, pauseStart: hand.pauseStart - deltaMs };
    }
    return { ...hand, levelStartEpoch: (hand.levelStartEpoch || Date.now()) + deltaMs };
  }
  const done = Number(hand.levelHandsCompleted) || 0;
  const target = Number(st.progress?.total) || 0;
  if (deltaMs > 0) {
    return { ...hand, levelHandsCompleted: Math.max(0, done - 1) };
  }
  if (deltaMs < 0) {
    const nextDone = target > 0 ? Math.min(target, done + 1) : done + 1;
    return advanceTimerSegment({ ...hand, levelHandsCompleted: nextDone });
  }
  return hand;
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

/**
 * Drop every break / color-up row from the schedule.
 * GO mode runs online and has no scheduled stoppages, so the clock skips them.
 */
export function removeScheduleStops(hand) {
  if (!hand) return hand;
  const rows = hand.blindSchedule || [];
  const hasStops = rows.some((l) => l?.type === 'break' || l?.type === 'color_up');
  const stuck = hand.inBreak || hand.pendingRace || (hand.pendingMissedRaces || []).length > 0;
  if (!hasStops && !stuck) return hand;
  const current = rows[hand.tLevel || 0];
  const filtered = rows.filter((l) => l?.type !== 'break' && l?.type !== 'color_up');
  const last = Math.max(0, filtered.length - 1);
  const found = current ? filtered.indexOf(current) : -1;
  // A break row is gone from the filtered list: land on the next playable level.
  const tLevel = found >= 0 ? found : Math.min(hand.tLevel || 0, last);
  const blindLevel = hand.blindLevel === hand.tLevel ? tLevel : Math.min(hand.blindLevel || 0, last);
  return {
    ...hand,
    blindSchedule: filtered,
    tLevel,
    blindLevel,
    inBreak: false,
    isColorUp: false,
    pendingRace: null,
    pendingMissedRaces: null,
    pauseStart: null,
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
    if (nextItem?.type === 'color_up') {
      const rc = nextItem.race;
      const retiredNum = parseAmount(rc?.retired) ?? Number(rc?.retired);
      const replacementNum = parseAmount(rc?.replacement) ?? Number(rc?.replacement);
      const race = rc && retiredNum > 0 && replacementNum > 0
        ? { ...rc, retired: retiredNum, replacement: replacementNum, tLevel: next }
        : { retired: 25, replacement: 100, tLevel: next };
      let nextPlayable = next + 1;
      while (nextPlayable < schedule.length && (schedule[nextPlayable]?.type === 'break' || schedule[nextPlayable]?.type === 'color_up')) {
        nextPlayable++;
      }
      h = {
        ...h,
        tLevel: next,
        inBreak: true,
        isColorUp: true,
        pendingRace: race,
        pauseStart: now,
        levelStartEpoch: now,
        levelHandsCompleted: 0,
        pendingLevelIdx: nextPlayable,
      };
      break;
    } else if (nextItem?.type === 'break') {
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
  while (target < schedule.length && (schedule[target]?.type === 'break' || schedule[target]?.type === 'color_up')) target++;
  if (target >= schedule.length) {
    return { ...hand, blindLevel: hand.blindLevel };
  }
  const lvl = schedule[target];
  const bbNum = parseAmount(lvl.bigBlind) ?? Number(lvl.bigBlind) ?? 0;
  const sbNum = parseAmount(lvl.smallBlind) ?? Number(lvl.smallBlind) ?? 0;
  const anteNum = parseAmount(lvl.ante) ?? Number(lvl.ante) ?? 0;
  if (isBombPotVariant(hand.variant) || (sbNum === 0 && bbNum === 0 && anteNum > 0)) {
    return {
      ...hand,
      smallBlind: 0,
      bigBlind: 0,
      anteAmount: anteNum,
      bombAmount: anteNum,
      blindLevel: target,
    };
  }
  const activeCount = (hand.players || []).filter((p) => p.status !== 'eliminated' && p.status !== 'out' && (p.stack > 0 || p.initialStack > 0)).length;
  const targetLvlNum = appliedLevelNumber({ ...hand, blindLevel: target });
  const isEarlyNoAnte = hand.anteType === 'bba' && hand.bbaEarlyHalfAnte && targetLvlNum <= (Number(hand.bbaEarlyHalfAnteLevel) || 2);
  const isShortHandedSB = hand.sbHalfAnteShortHanded && activeCount < (Number(hand.shortHandedThreshold) || 5);
  const effectiveAnte = (hand.anteType === 'bba' && isEarlyNoAnte)
    ? 'none'
    : (hand.anteType === 'bba' && isShortHandedSB ? 'sb_half_ante' : hand.anteType);
  const ante = isEarlyNoAnte
    ? 0
    : (effectiveAnte === 'bba' || effectiveAnte === 'btn_ante')
    ? bbNum
    : effectiveAnte === 'sb_half_ante'
    ? Math.round(bbNum * 0.5 * 100) / 100
    : (lvl.ante != null && lvl.ante !== '' ? anteNum : 0);
  return {
    ...hand,
    smallBlind: sbNum,
    bigBlind: bbNum,
    anteAmount: ante,
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
  // `appliedHand` lets the caller start the next hand later (e.g. after an optional re-entry)
  // without advancing the level timer a second time.
  return {
    ...nextHand(applied),
    appliedHand: { ...applied, pendingAdjust: {}, pendingPlayers: [] },
  };
}
