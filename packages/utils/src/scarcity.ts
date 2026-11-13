/**
 * Pure functional focus/scarcity and ranking guards.
 */

export type PinDecision = "ALLOW_PIN" | "UNPIN" | "SWAP_REQUIRED";

/**
 * Evaluates whether a candidate item can be pinned into a fixed-capacity focus list.
 */
export function evaluateScarcityGate(
  currentPinnedIds: readonly string[],
  candidateId: string,
  maxSlots = 3,
): PinDecision {
  if (currentPinnedIds.includes(candidateId)) {
    return "UNPIN";
  }
  if (currentPinnedIds.length < maxSlots) {
    return "ALLOW_PIN";
  }
  return "SWAP_REQUIRED";
}

/**
 * Verifies that items are ordered in strictly descending `sortScore` order.
 */
export function isStrictlyDescendingByScore<T extends { sortScore: number }>(
  items: readonly T[],
): boolean {
  for (let i = 0; i < items.length; i++) {
    const current = items[i].sortScore;
    if (Number.isNaN(current)) {
      return false;
    }
    if (i > 0 && current >= items[i - 1].sortScore) {
      return false;
    }
  }
  return true;
}
