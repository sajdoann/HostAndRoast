import type { DinnerEvent, JoinTarget, Rating, Season } from "../domain/types";
import type { HostResult } from "../domain/scoring";

export interface DB {
  seasons: Season[];
  ratings: Rating[];
  /** The current viewer's claimed identity per season: seasonId → playerId. */
  myClaims: Record<string, string>;
  /** Season ids the viewer participates in (claimed or rated while signed in). */
  myMemberships: string[];
}

/** Whether a join code has been resolved yet. */
export type CodeState = "loading" | "missing" | "ready";

/**
 * The single seam between the app and its persistence.
 *
 * The Firestore implementation loads data on demand rather than downloading
 * everything: the owner sees their own seasons (setViewer), and any season is
 * loaded by its link (ensureSeason) or by a join code (resolveCode). This keeps
 * the schedule "anyone with the link" without exposing every season publicly.
 */
export interface Store {
  /** Reactive snapshot (owner's seasons + any loaded on demand). */
  getState(): DB;
  subscribe(listener: () => void): () => void;

  /** True once the viewer's own season list has loaded (for the home page). */
  isLoaded(): boolean;
  /** True once a specific season (doc + events) has loaded. */
  isSeasonLoaded(seasonId: string): boolean;
  /** Resolution state of a join code. */
  getCodeState(code: string): CodeState;

  /** Set the signed-in viewer (drives the owner's season list + claim writes). */
  setViewer(uid: string | null): void;

  /** Begin loading a season by id (idempotent). */
  ensureSeason(seasonId: string): void;
  /** Look up a join code and load its season. */
  resolveCode(code: string): void;
  /** Read a resolved code from current state. */
  findByCode(code: string): JoinTarget | undefined;

  createSeason(season: Season): void;
  /** Edit one dinner (date / meal). Owner or the cook who claimed that player. */
  updateEvent(seasonId: string, event: DinnerEvent): void;
  /** A signed-in participant claims which player (nickname) they are. */
  claimPlayer(seasonId: string, uid: string, playerId: string): void;
  deleteSeason(seasonId: string): void;

  /**
   * Record a rating. Resolves once the rating write lands (so the UI confirms
   * only on success), rejects if it fails. The receipt + identity writes happen
   * after, best-effort.
   */
  addRating(rating: Rating): Promise<void>;
  getResults(seasonId: string): HostResult[] | null;
}
