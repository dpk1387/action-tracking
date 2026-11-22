// Play Bots sessions live in localStorage so an in-progress game can be
// resumed from the home screen and a finished one keeps its hand history.
const STORAGE_KEY = 'poker_bots_sessions_v1';
const MAX_SESSIONS = 40;
const listeners = new Set();

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SESSIONS)));
  } catch (_) {
    // Quota exceeded: drop the payload of the oldest finished sessions first.
    const trimmed = list.slice(0, MAX_SESSIONS).map((s, i) => (i < 5 || s.status !== 'complete' ? s : { ...s, handRecords: [] }));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch (__) { /* give up quietly */ }
  }
  listeners.forEach((fn) => fn());
}

export function getBotsSessions() {
  return readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getBotsSession(id) {
  return readAll().find((s) => s.id === id) || null;
}

export function upsertBotsSession(session) {
  if (!session?.id) return;
  const list = readAll();
  const idx = list.findIndex((s) => s.id === session.id);
  if (idx >= 0) list[idx] = session;
  else list.unshift(session);
  writeAll(list);
}

export function deleteBotsSession(id) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function subscribeBotsSessions(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
