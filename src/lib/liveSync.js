import { db } from '@/api/base44Client';
import { mergeHandHistories } from '@/lib/handHistoryMerge';

const CHANNEL = 'poker-live';
const storageKey = 'poker-live-state';
const codeKey = 'poker-live-share-code';
const tokenKey = 'poker-live-session-token';

let bc = null;
try {
  bc = new BroadcastChannel(CHANNEL);
} catch (e) {
  bc = null;
}

export function getShareCode() {
  try {
    return localStorage.getItem(codeKey) || null;
  } catch (e) {
    return null;
  }
}

export function setShareCode(code) {
  try {
    if (code) localStorage.setItem(codeKey, code);
    else localStorage.removeItem(codeKey);
  } catch (e) {}
}

// Identifies one table session so saved histories are only merged with the
// hands of the same session, never with a previous one that shared a code.
export function getSessionToken() {
  try {
    const existing = localStorage.getItem(tokenKey);
    if (existing) return existing;
  } catch (e) {}
  const fresh =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'token_' + Math.random().toString(36).substring(2, 12);
  try { localStorage.setItem(tokenKey, fresh); } catch (e) {}
  return fresh;
}

export function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(tokenKey, token);
    else localStorage.removeItem(tokenKey);
  } catch (e) {}
}

export function ensureSaveCode() {
  const code = getShareCode();
  if (code) return code;
  const fresh =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'code_' + Math.random().toString(36).substring(2, 12);
  setShareCode(fresh);
  return fresh;
}

let saveStatus = { saving: false, ok: null, at: null };
const saveListeners = new Set();

export function getSaveStatus() {
  return saveStatus;
}

export function subscribeSaveStatus(cb) {
  saveListeners.add(cb);
  return () => saveListeners.delete(cb);
}

function setSaveStatus(patch) {
  saveStatus = { ...saveStatus, ...patch };
  saveListeners.forEach((l) => l());
}

function buildPayload(state) {
  return {
    sessionToken: getSessionToken(),
    config: state.config || null,
    hand: state.hand || null,
    gameOver: state.gameOver || null,
    equity: state.equity || null,
    hideAmounts: !!state.hideAmounts,
    holeCards: state.holeCards || null,
    director: state.director || null,
    history: state.history || [],
    isGoMode: state.isGoMode !== undefined ? state.isGoMode : Boolean(state.config?.isGoMode || state.hand?.isGoMode),
  };
}

// The save that follows a resume only knows the hands played since the load
// unless the caller passes the whole list. Fold in whatever was already saved
// for this same session so an earlier block of hands cannot be dropped.
function mergeWithStoredHistory(payload) {
  const prev = readLive();
  if (!prev || prev.sessionToken !== payload.sessionToken) return payload;
  const merged = mergeHandHistories(prev.history, payload.history);
  if (merged.length === (payload.history || []).length) return payload;
  return { ...payload, history: merged };
}

async function invokeSave(payload) {
  setSaveStatus({ saving: true });
  try {
    await db.functions.invoke('publishLiveSession', {
      shareCode: getShareCode(),
      ...payload,
    });
    setSaveStatus({ saving: false, ok: true, at: Date.now() });
  } catch (e) {
    setSaveStatus({ saving: false, ok: false, at: Date.now() });
  }
}

let publishTimer = null;

export function publishLive(state) {
  const payload = mergeWithStoredHistory(buildPayload(state));
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (e) {}
  if (bc) {
    try {
      bc.postMessage(payload);
    } catch (e) {}
  }

  const code = getShareCode();
  if (code && (payload.hand || payload.gameOver || payload.director)) {
    if (publishTimer) clearTimeout(publishTimer);
    publishTimer = setTimeout(() => {
      publishTimer = null;
      invokeSave(payload);
    }, 800);
  }
}

export function saveNow(state) {
  const payload = mergeWithStoredHistory(buildPayload(state));
  if (!payload.hand && !payload.gameOver && !payload.director) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (e) {}
  if (bc) {
    try {
      bc.postMessage(payload);
    } catch (e) {}
  }
  if (!getShareCode()) ensureSaveCode();
  if (publishTimer) {
    clearTimeout(publishTimer);
    publishTimer = null;
  }
  return invokeSave(payload);
}

export async function loadSavedSession(code) {
  const c = code || getShareCode();
  if (!c) return null;
  const res = await db.functions.invoke('readSavedSession', { shareCode: c });
  const data = res?.data || res || {};
  if (!data.resumeState || (!data.resumeState.hand && !data.resumeState.director)) return null;
  return { saved: data.resumeState, updatedAt: data.updatedAt || null };
}

export async function discardSavedSession(code) {
  const c = code || getShareCode();
  try {
    await db.functions.invoke('discardSavedSession', { shareCode: c || '' });
  } catch (e) {}
  try {
    localStorage.removeItem(codeKey);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(tokenKey);
  } catch (e) {}
  return { ok: true };
}

export async function discardAllSavedSessions() {
  try {
    await db.functions.invoke('discardSavedSession', { shareCode: 'all' });
  } catch (e) {}
  try {
    localStorage.removeItem(codeKey);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(tokenKey);
  } catch (e) {}
  return { ok: true };
}

export function readLive() {
  try {
    const v = localStorage.getItem(storageKey);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

export function subscribeLive(cb) {
  try {
    const v = localStorage.getItem(storageKey);
    if (v) cb(JSON.parse(v));
  } catch (e) {}
  if (bc) {
    const handler = (e) => {
      if (e.data) cb(e.data);
    };
    bc.addEventListener('message', handler);
    return () => {
      try {
        bc.removeEventListener('message', handler);
      } catch (er) {}
    };
  }
  const handler = (e) => {
    if (e.key === storageKey && e.newValue) {
      try {
        cb(JSON.parse(e.newValue));
      } catch (er) {}
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
