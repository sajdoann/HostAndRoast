import type { JoinTarget, Rating, Season } from "../domain/types";
import type { HostResult } from "../domain/scoring";

export interface DB {
  seasons: Season[];
  ratings: Rating[];
}

/**
 * The single seam between the app and its persistence.
 * The bundled implementation is localStorage-backed (see localStore.ts);
 * swapping in Firestore means writing another Store and pointing index.ts at it.
 *
 * NOTE: ratings are intentionally NOT exposed as a public list. Callers get
 * only the aggregates the reveal logic allows — mirroring the security model
 * where raw scores are never client-readable.
 */
export interface Store {
  /** Reactive snapshot. Reference is stable until a mutation occurs. */
  getState(): DB;
  subscribe(listener: () => void): () => void;

  createSeason(season: Season): void;
  updateSeason(season: Season): void;
  deleteSeason(seasonId: string): void;

  /** Resolve a public join code to its event + season. */
  findByCode(code: string): JoinTarget | undefined;

  /** Record a guest's rating. Ignores duplicates (one per event+rater). */
  addRating(rating: Rating): void;

  /**
   * The leaderboard for a season, or null if it isn't available yet.
   * Local mode computes it from the ratings it holds; Firestore mode returns
   * the results a Cloud Function publishes once the reveal condition is met
   * (clients can't read raw scores, so they can't compute it themselves).
   */
  getResults(seasonId: string): HostResult[] | null;
}
