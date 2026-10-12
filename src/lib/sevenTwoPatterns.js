export function isSevenTwo(cards) {
  if (!cards || cards.length < 2) return false;
  const ranks = cards.map((c) => c.rank.toUpperCase());
  return ranks.includes('7') && ranks.includes('2');
}

export function isSevenTwoSuited(cards) {
  if (!isSevenTwo(cards)) return false;
  return cards[0].suit === cards[1].suit;
}

export function rewardFor(rewardsTable, holeCards, defaultReward = 0, tenBB = 0) {
  if (!holeCards || holeCards.length < 2) {
    return defaultReward || tenBB || 0;
  }
  if (!isSevenTwo(holeCards)) {
    return null;
  }
  const suited = isSevenTwoSuited(holeCards);
  if (rewardsTable) {
    if (suited && rewardsTable.suited != null) {
      return Number(rewardsTable.suited);
    }
    if (!suited && rewardsTable.offsuit != null) {
      return Number(rewardsTable.offsuit);
    }
    if (rewardsTable.amount != null) {
      return Number(rewardsTable.amount);
    }
  }
  return Number(defaultReward) || Number(tenBB) || 0;
}
