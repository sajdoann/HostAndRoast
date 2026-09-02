import type { Category, DinnerEvent, JoinTarget, Rating, Season } from "../domain/types";
import type { HostResult, RaterStats } from "../domain/scoring";

export interface DB {
  seasons: Season[];
  ratings: Rating[];
  /** The current viewer's claimed identity per season: seasonId → playerId. */
  myClaims: Record<string, string>;
  /** Season ids the viewer participates in (claimed or rated while signed in). */
  myMemberships: string[];
  /** Season ids whose results have been revealed. */
  revealed: string[];
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
  /** Read a resolved season-level code (season.code) from current state. */
  findSeasonByCode(code: string): Season | undefined;

  createSeason(season: Season): void;
  /** Edit one dinner (date / meal). Owner or the cook who claimed that player. */
  updateEvent(seasonId: string, event: DinnerEvent): void;
  /**
   * A signed-in participant claims which player (nickname) they are. Nicknames
   * are first-come-first-served: rejects if another account already holds it.
   */
  claimPlayer(seasonId: string, uid: string, playerId: string): Promise<void>;
  /** Player ids already claimed by someone in this season, so the picker can say so. */
  claimedPlayers(seasonId: string): string[];
  deleteSeason(seasonId: string): void;

  /** Owner: add a player and an unscheduled dinner for them at the end of the schedule. */
  addPlayer(seasonId: string, name: string): void;
  /** Owner: rename a player. */
  renamePlayer(seasonId: string, playerId: string, name: string): void;
  /** Owner: remove a player and their hosted dinner. */
  removePlayer(seasonId: string, playerId: string): void;
  /**
   * Owner: put a player in a household (they cook with `householdId`, sharing
   * one dinner and one vote) or `undefined` to give them their own kitchen
   * back. Their dinner is removed when joining and restored when leaving.
   */
  setHousehold(seasonId: string, playerId: string, householdId: string | undefined): void;
  /** Owner: replace the season's rating categories (the comment field is separate and always kept). */
  updateCategories(seasonId: string, categories: Category[]): void;

  /**
   * Record a rating. Resolves once the rating write lands (so the UI confirms
   * only on success), rejects if it fails. The receipt + identity writes happen
   * after, best-effort.
   */
  addRating(rating: Rating): Promise<void>;

  /** The public leaderboard once revealed, else null. */
  getResults(seasonId: string): HostResult[] | null;
  /** Owner-only: compute and publish the results (winner + stats + feedback). */
  revealSeason(seasonId: string): Promise<void>;
  /** Comments on one dinner (cook of that host / owner only). */
  getFeedback(seasonId: string, hostId: string): Promise<string[] | null>;
  /** One rater's own scores (that player / owner only). */
  getRaterStats(seasonId: string, playerId: string): Promise<RaterStats | null>;
}
