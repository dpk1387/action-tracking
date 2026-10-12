import { useSyncExternalStore } from 'react';

let state = { config: null, hand: null, gameOver: null, history: [] };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const sessionStore = {
  get: () => state,
  set: (partial) => {
    state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
    emit();
  },
  addHand: (entry) => {
    state = { ...state, history: [...state.history, entry] };
    emit();
  },
  reset: () => {
    state = { config: null, hand: null, gameOver: null, history: [] };
    emit();
  },
  subscribe: (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}
