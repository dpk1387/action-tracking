// Long-lived per-bot stats. Each seated bot is one named profile; its first
// 200 hands are simulated once as a baseline, then real hands you play with it
// are appended. Stats always use at most the last 900 hands.
import { handTally, countsToRow, sumRows, summarizeStats, simulateStyleStats } from '@/lib/botStats';

const STORAGE_KEY = 'poker_bot_profiles_v1';
const MAX_WINDOW = 900;
const BASELINE_HANDS = 200;
const MAX_PROFILES = 40;
const WRITE_DELAY_MS = 500;

let cache = null;
let writeTimer = null;
const listeners = new Set();

function readAll() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === 'object' && parsed.profiles ? parsed : { profiles: {} };
  } catch (_) {
    cache = { profiles: {} };
  }
  return cache;
}

function flush() {
  if (!cache) return;
  const ids = Object.keys(cache.profiles);
  if (ids.length > MAX_PROFILES) {
    ids
      .sort((a, b) => (cache.profiles[a].updatedAt || 0) - (cache.profiles[b].updatedAt || 0))
      .slice(0, ids.length - MAX_PROFILES)
      .forEach((id) => { delete cache.profiles[id]; });
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (_) {
    // Quota: keep only recent hands for the least recent half of the profiles.
    const sorted = Object.keys(cache.profiles).sort((a, b) => (cache.profiles[a].updatedAt || 0) - (cache.profiles[b].updatedAt || 0));
    sorted.slice(0, Math.ceil(sorted.length / 2)).forEach((id) => {
      const rec = cache.profiles[id];
      rec.rows = rec.rows.slice(-BASELINE_HANDS);
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch (__) { /* give up quietly */ }
  }
  listeners.forEach((fn) => fn());
}

function scheduleWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => { writeTimer = null; flush(); }, WRITE_DELAY_MS);
}

export function subscribeBotProfiles(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getProfileRecord(profileId) {
  return readAll().profiles[profileId] || null;
}

/** Simulate the 200-hand baseline once for a profile, and return its record. */
export function ensureProfileBaseline(profile, { seats = 6, difficulty = 'medium', live = false } = {}) {
  const store = readAll();
  const existing = store.profiles[profile.id];
  if (existing?.baselineDone) return existing;
  const result = simulateStyleStats({
    profile: profile.profile,
    seats,
    hands: BASELINE_HANDS,
    difficulty,
    live,
    collectRows: true,
  });
  // Hands played before the baseline finished are kept and sit after it.
  const played = existing?.rows || [];
  const record = {
    id: profile.id,
    name: profile.name,
    styleId: profile.styleId,
    baselineDone: true,
    rows: [...result.rows, ...played].slice(-MAX_WINDOW),
    updatedAt: Date.now(),
  };
  store.profiles[profile.id] = record;
  scheduleWrite();
  return record;
}

/** Add one finished hand to every bot that was dealt into it. */
export function recordHandForBots(seats, handRecord) {
  if (!handRecord) return;
  const store = readAll();
  let changed = false;
  (seats || []).forEach((seat) => {
    if (!seat?.profileId || seat.isHero) return;
    const tally = handTally(handRecord, seat.name);
    const rec = store.profiles[seat.profileId] || {
      id: seat.profileId,
      name: seat.name,
      styleId: seat.styleId,
      baselineDone: false,
      rows: [],
      updatedAt: Date.now(),
    };
    store.profiles[seat.profileId] = rec;
    rec.rows.push(countsToRow(tally));
    if (rec.rows.length > MAX_WINDOW) rec.rows = rec.rows.slice(-MAX_WINDOW);
    rec.updatedAt = Date.now();
    changed = true;
  });
  if (changed) scheduleWrite();
}

export function profileStats(profileId) {
  const rec = readAll().profiles[profileId];
  if (!rec) return null;
  return summarizeStats(sumRows(rec.rows));
}

export function profileHandCount(profileId) {
  return readAll().profiles[profileId]?.rows?.length || 0;
}

export { MAX_WINDOW, BASELINE_HANDS };
