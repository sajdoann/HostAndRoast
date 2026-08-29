import type { JoinTarget, Rating, Season } from "../domain/types";

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
}
