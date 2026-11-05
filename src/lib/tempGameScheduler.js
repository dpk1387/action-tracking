import { VARIANTS } from './poker';

/**
 * Computes list or set of hand numbers that a plan will apply to.
 * Horizon is capped to prevent infinite sets for intervals with no end.
 */
export function getMatchingHandsForPlan(plan, currentHand = 1, horizon = 500) {
  if (!plan) return [];
  const hands = [];

  if (plan.scheduleType === 'this_hand') {
    const target = plan.handNumber || currentHand;
    return [target];
  }

  if (plan.scheduleType === 'next_hand') {
    const start = plan.startHand || (currentHand + 1);
    const count = Math.max(1, Number(plan.durationHands) || 1);
    for (let i = 0; i < count; i++) {
      hands.push(start + i);
    }
    return hands;
  }

  if (plan.scheduleType === 'interval') {
    const start = Math.max(1, Number(plan.startHand) || currentHand);
    const interval = Math.max(1, Number(plan.interval) || 5);
    const end = plan.endHand ? Number(plan.endHand) : Math.min(start + (interval * 50), start + horizon);
    for (let h = start; h <= end; h += interval) {
      hands.push(h);
    }
    return hands;
  }

  if (plan.scheduleType === 'specific_hands') {
    return (plan.specificHands || []).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  }

  return hands;
}

/**
 * Checks whether `newPlan` conflicts with any plan in `existingPlans`.
 * Returns { hasOverlap: boolean, conflictingHand?: number, conflictingPlan?: any }
 */
export function checkScheduleOverlap(newPlan, existingPlans = [], currentHand = 1) {
  const filtered = existingPlans.filter((p) => p.id !== newPlan.id);
  if (!filtered.length) return { hasOverlap: false };

  const newHands = getMatchingHandsForPlan(newPlan, currentHand);

  for (const h of newHands) {
    for (const ep of filtered) {
      const epHands = getMatchingHandsForPlan(ep, currentHand);
      if (epHands.includes(h)) {
        return {
          hasOverlap: true,
          conflictingHand: h,
          conflictingPlan: ep,
        };
      }
    }
  }

  return { hasOverlap: false };
}

/**
 * Finds if there is an active temporary game plan for a given hand number.
 */
export function findPlanForHand(handNumber, plans = []) {
  if (!plans || !plans.length) return null;
  for (const plan of plans) {
    const hands = getMatchingHandsForPlan(plan, handNumber, 2000);
    if (hands.includes(handNumber)) {
      return plan;
    }
  }
  return null;
}

/**
 * Constructs a human-readable title for a game configuration
 */
export function getGamePlanTitle(plan) {
  if (plan.customTitle) return plan.customTitle;
  const v = plan.variant || 'nlh';
  const varLabel = VARIANTS[v]?.label || v.toUpperCase();
  const parts = [];

  if (plan.isBombPot) {
    parts.push(varLabel);
    parts.push('Bomb Pot');
    if (plan.bombBoards >= 2) parts.push(`(${plan.bombBoards} Boards)`);
  } else {
    parts.push(varLabel);
    if (plan.doubleBoard) parts.push('(Double Board)');
    if (plan.gameType === 'pot_limit') parts.push('(Pot Limit)');
    else if (plan.gameType === 'fixed_limit') parts.push('(Fixed Limit)');
  }
  return parts.join(' ');
}
