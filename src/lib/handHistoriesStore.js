import { auth, firestore } from './firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { mergeHandHistories } from '@/lib/handHistoryMerge';

// Hand numbers identify a hand inside one session; ids can be regenerated on a
// later save of the same hand, so prefer the number when there is one.
function handKey(h) {
  if (!h) return null;
  if (h.handNumber != null) return `n:${h.handNumber}`;
  if (h.id != null) return `i:${h.id}`;
  return JSON.stringify(h);
}

const STORAGE_KEY = 'poker_hand_histories_store_v1';
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

function sanitizeDocId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getHandHistories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.sort(
          (a, b) =>
            new Date(b.lastSavedAt || b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.lastSavedAt || a.updatedAt || a.createdAt || 0).getTime()
        )
      : [];
  } catch (e) {
    return [];
  }
}

export async function syncRemoteHandHistories() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const colRef = collection(firestore, 'hand_histories');
    let q = query(colRef, where('userId', '==', user.uid));
    let snapshot = await getDocs(q);

    if (snapshot.empty && user.email) {
      q = query(colRef, where('userEmail', '==', user.email));
      snapshot = await getDocs(q);
    }

    const remoteRecords = [];
    snapshot.forEach((docSnap) => {
      remoteRecords.push(docSnap.data());
    });

    if (remoteRecords.length > 0) {
      const localRecords = getHandHistories();
      const map = new Map();
      localRecords.forEach((r) => map.set(r.id, r));
      remoteRecords.forEach((r) => {
        const existing = map.get(r.id);
        if (existing) {
          // Merge hands without duplicates
          const seen = new Set();
          const mergedHands = [];
          (existing.hands || []).concat(r.hands || []).forEach((h) => {
            const key = handKey(h);
            if (!seen.has(key)) {
              seen.add(key);
              mergedHands.push(h);
            }
          });
          map.set(r.id, {
            ...existing,
            ...r,
            hands: mergedHands,
            handCount: mergedHands.length,
          });
        } else {
          map.set(r.id, r);
        }
      });

      const merged = Array.from(map.values()).sort(
        (a, b) =>
          new Date(b.lastSavedAt || b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.lastSavedAt || a.updatedAt || a.createdAt || 0).getTime()
      );

      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      emit();
    }
  } catch (e) {
    console.error('Failed to sync hand histories from Firestore:', e);
  }
}

// Automatically sync when Auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    syncRemoteHandHistories();
  }
});

/**
 * Save complete hands for a session.
 * If the session already exists in Hand Histories, APPEND new hands to it (deduplicating).
 */
export function saveHandHistory(sessionOrHandsData) {
  if (!sessionOrHandsData) return;
  const incomingHands = Array.isArray(sessionOrHandsData.hands) ? sessionOrHandsData.hands : [];
  if (incomingHands.length === 0) return;

  try {
    const existingList = getHandHistories();
    const identifier =
      sessionOrHandsData.id ||
      sessionOrHandsData.shareCode ||
      sessionOrHandsData.sessionId ||
      ('history_' + Date.now());

    // Find if a record exists for this session
    const existingIndex = existingList.findIndex(
      (item) =>
        item.id === identifier ||
        (sessionOrHandsData.shareCode && item.shareCode === sessionOrHandsData.shareCode) ||
        (sessionOrHandsData.sessionId && item.sessionId === sessionOrHandsData.sessionId)
    );

    const now = new Date().toISOString();
    const user = auth.currentUser;

    let targetRecord;

    if (existingIndex >= 0) {
      // Append to the existing record, deduplicating by hand number so a
      // session saved in several sittings keeps every hand exactly once.
      const existingRecord = existingList[existingIndex];
      const combinedHands = mergeHandHistories(existingRecord.hands, incomingHands);

      targetRecord = {
        ...existingRecord,
        sessionName: sessionOrHandsData.sessionName || existingRecord.sessionName || 'Poker Session',
        mode: sessionOrHandsData.mode || existingRecord.mode || 'cash',
        variant: sessionOrHandsData.variant || existingRecord.variant || 'nlh',
        currency: sessionOrHandsData.currency || existingRecord.currency || '$',
        smallBlind: sessionOrHandsData.smallBlind ?? existingRecord.smallBlind,
        bigBlind: sessionOrHandsData.bigBlind ?? existingRecord.bigBlind,
        playerNames: sessionOrHandsData.playerNames?.length
          ? sessionOrHandsData.playerNames
          : existingRecord.playerNames,
        hands: combinedHands,
        handCount: combinedHands.length,
        lastSavedAt: now,
        updatedAt: now,
        userId: user ? user.uid : existingRecord.userId || null,
        userEmail: user ? user.email : existingRecord.userEmail || null,
      };

      existingList[existingIndex] = targetRecord;
    } else {
      // Create new hand history record
      targetRecord = {
        id: identifier,
        sessionId: sessionOrHandsData.sessionId || identifier,
        shareCode: sessionOrHandsData.shareCode || null,
        sessionName: sessionOrHandsData.sessionName || 'Poker Session',
        mode: sessionOrHandsData.mode || 'cash',
        variant: sessionOrHandsData.variant || 'nlh',
        currency: sessionOrHandsData.currency || '$',
        smallBlind: sessionOrHandsData.smallBlind || 25,
        bigBlind: sessionOrHandsData.bigBlind || 50,
        playerNames: sessionOrHandsData.playerNames || [],
        hands: incomingHands,
        handCount: incomingHands.length,
        createdAt: sessionOrHandsData.createdAt || now,
        lastSavedAt: now,
        updatedAt: now,
        userId: user ? user.uid : sessionOrHandsData.userId || null,
        userEmail: user ? user.email : sessionOrHandsData.userEmail || null,
      };

      existingList.unshift(targetRecord);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingList));
    emit();

    // Persist to Firestore if signed in
    if (user) {
      const docId = sanitizeDocId(targetRecord.id);
      setDoc(doc(firestore, 'hand_histories', docId), targetRecord, { merge: true }).catch((err) => {
        console.error('Failed to save hand history to Firestore:', err);
      });
    }

    return targetRecord;
  } catch (e) {
    console.error('Failed to save hand history:', e);
  }
}

export function findHandHistoryByCode(codeOrId) {
  if (!codeOrId) return null;
  const list = getHandHistories();
  return (
    list.find(
      (item) =>
        item.id === codeOrId ||
        item.shareCode === codeOrId ||
        item.sessionId === codeOrId
    ) || null
  );
}

export function deleteHandHistory(id) {
  if (!id) return;
  try {
    const existing = getHandHistories();
    const updated = existing.filter((s) => s.id !== id && s.shareCode !== id && s.sessionId !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    emit();

    const user = auth.currentUser;
    if (user) {
      const docId = sanitizeDocId(id);
      deleteDoc(doc(firestore, 'hand_histories', docId)).catch((err) => {
        console.error('Failed to delete hand history from Firestore:', err);
      });
    }
  } catch (e) {
    console.error('Failed to delete hand history:', e);
  }
}

export function clearAllHandHistories() {
  try {
    const list = getHandHistories();
    localStorage.removeItem(STORAGE_KEY);
    emit();

    const user = auth.currentUser;
    if (user) {
      list.forEach((item) => {
        const docId = sanitizeDocId(item.id);
        deleteDoc(doc(firestore, 'hand_histories', docId)).catch(() => {});
      });
    }
  } catch (e) {
    console.error('Failed to clear all hand histories:', e);
  }
}

export function subscribeHandHistories(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
