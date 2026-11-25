// Completed hands are stored per session and must survive a save that only
// knows about the hands played since the last load. Merge by hand number so a
// resumed session can never drop the hands it was resumed with.
function handKey(hand) {
  if (!hand) return null;
  if (hand.handNumber != null) return `n:${hand.handNumber}`;
  if (hand.id != null) return `i:${hand.id}`;
  return null;
}

export function mergeHandHistories(base, incoming) {
  const merged = [];
  const index = new Map();
  const add = (hand, replace) => {
    const key = handKey(hand);
    if (key == null) {
      merged.push(hand);
      return;
    }
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, merged.length);
      merged.push(hand);
    } else if (replace) {
      merged[at] = hand;
    }
  };
  (Array.isArray(base) ? base : []).forEach((h) => add(h, false));
  (Array.isArray(incoming) ? incoming : []).forEach((h) => add(h, true));
  merged.sort((a, b) => (a.handNumber || 0) - (b.handNumber || 0));
  return merged;
}
