import { auth, firestore } from './firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';

const STORAGE_KEY = 'poker_completed_sessions_store';
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

function sanitizeDocId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getCompletedSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.sort(
          (a, b) =>
            new Date(b.completedAt || b.updatedAt || 0).getTime() -
            new Date(a.completedAt || a.updatedAt || 0).getTime()
        )
      : [];
  } catch (e) {
    return [];
  }
}

export async function syncRemoteCompletedSessions() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const colRef = collection(firestore, 'completed_sessions');
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
      const localRecords = getCompletedSessions();
      const map = new Map();
      localRecords.forEach((r) => map.set(r.id, r));
      remoteRecords.forEach((r) => map.set(r.id, r));

      const merged = Array.from(map.values()).sort(
        (a, b) =>
          new Date(b.completedAt || b.updatedAt || 0).getTime() -
          new Date(a.completedAt || a.updatedAt || 0).getTime()
      );

      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      emit();
    }
  } catch (e) {
    console.error('Failed to sync completed sessions from Firestore:', e);
  }
}

// Automatically sync when Auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    syncRemoteCompletedSessions();
  }
});

export function saveCompletedSession(sessionData) {
  if (!sessionData) return;
  try {
    const existing = getCompletedSessions();
    const id = sessionData.id || sessionData.shareCode || ('completed_' + Date.now());
    const user = auth.currentUser;

    const record = {
      ...sessionData,
      id,
      completedAt: sessionData.completedAt || new Date().toISOString(),
      isCompleted: true,
      userId: user ? user.uid : (sessionData.userId || null),
      userEmail: user ? user.email : (sessionData.userEmail || null),
    };

    const filtered = existing.filter((s) => s.id !== id && s.shareCode !== id);
    const updated = [record, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    emit();

    // Persist to Firestore if signed in
    if (user) {
      const docId = sanitizeDocId(id);
      setDoc(doc(firestore, 'completed_sessions', docId), record, { merge: true }).catch((err) => {
        console.error('Failed to save completed session to Firestore:', err);
      });
    }
  } catch (e) {
    console.error('Failed to save completed session:', e);
  }
}

export function deleteCompletedSession(id) {
  if (!id) return;
  try {
    const existing = getCompletedSessions();
    const updated = existing.filter((s) => s.id !== id && s.shareCode !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    emit();

    const user = auth.currentUser;
    if (user) {
      const docId = sanitizeDocId(id);
      deleteDoc(doc(firestore, 'completed_sessions', docId)).catch((err) => {
        console.error('Failed to delete completed session from Firestore:', err);
      });
    }
  } catch (e) {
    console.error('Failed to delete completed session:', e);
  }
}

export function clearAllCompletedSessions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    emit();
  } catch (e) {
    console.error('Failed to clear completed sessions:', e);
  }
}

export function subscribeCompletedSessions(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
