import { rebuyBlocker } from './poker';

// Decides what every busted player can do when a hand leaves one player with all the chips.
// Cash games always let a busted player buy back in, and tournaments follow the format
// picked in structure setup (re-entry count, rebuy rules, or freezeout).
export function buildBustRecovery(hand, busted = []) {
  const elapsed = hand?.mode === 'cash' ? 0 : Number(hand?.blindLevel) || 0;
  const startingStack = Number(hand?.startingStack) || (Number(hand?.bigBlind) || 0) * 100;
  const rebuyChips = Number(hand?.rebuyChips) || startingStack;
  const maxReEntries = Number(hand?.maxReEntries) || 0;
  const format = hand?.mode === 'cash' ? 'cash' : (hand?.tournamentFormat || 'freezeout');

  const offers = (busted || []).filter(Boolean).map((elim) => {
    if (format === 'cash') {
      const chips = Number(elim.chips) || startingStack;
      return { elim, kind: 'rebuy', label: 'Buy back in', chips, allowed: chips > 0, blocker: null };
    }
    if (format === 'reentry') {
      const used = Number(elim.reentries) || 0;
      const allowed = maxReEntries === 0 || used < maxReEntries;
      return {
        elim,
        kind: 'reentry',
        label: 'Re-enter',
        chips: startingStack,
        allowed,
        blocker: allowed ? null : `All ${maxReEntries} re-entries used`,
      };
    }
    if (format === 'rebuy') {
      const blocker = rebuyBlocker({ ...hand, blindLevel: elapsed }, elim, elapsed);
      const allowed = !blocker && rebuyChips > 0;
      return {
        elim,
        kind: 'rebuy',
        label: 'Rebuy',
        chips: rebuyChips,
        allowed,
        blocker: blocker || (rebuyChips > 0 ? null : 'Rebuy chips not set up'),
      };
    }
    return { elim, kind: null, label: 'No re-entry', chips: 0, allowed: false, blocker: 'Freezeout — the tournament ends when one player has every chip' };
  });

  return { format, elapsed, startingStack, rebuyChips, maxReEntries, offers, anyAllowed: offers.some((o) => o.allowed) };
}

// Chips a recovering player gets back: the offer's stack, or 100 big blinds as a fallback.
export function recoveryChips(hand, offer) {
  const chips = Number(offer?.chips) || Number(hand?.startingStack) || (Number(hand?.bigBlind) || 1) * 100;
  return chips > 0 ? chips : (Number(hand?.bigBlind) || 1) * 100;
}
