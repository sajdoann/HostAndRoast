/**
 * Per-device duplicate-vote lock. Complements the store-level guard
 * (one rating per event+rater): this stops the same browser from voting twice
 * under different names, without requiring any login.
 */

const PREFIX = "hr.voted.";

export function hasVoted(eventId: string): boolean {
  try {
    return localStorage.getItem(PREFIX + eventId) != null;
  } catch {
    return false;
  }
}

export function markVoted(eventId: string, raterName: string): void {
  try {
    localStorage.setItem(PREFIX + eventId, raterName);
  } catch {
    /* ignore */
  }
}
