/**
 * Core domain model for the Host & Roast rating game
 * (a take-turns-hosting dinner game among friends).
 *
 * A Season has a fixed list of players. Each player hosts one Dinner Event on
 * their date (round-robin — one host per day). Guests rate every dinner they
 * attend; scores stay hidden until the season's reveal condition is met.
 */

export type CategoryId = "food" | "atmosphere" | "entertainment";

export interface Player {
  id: string;
  name: string;
}

export interface DinnerEvent {
  id: string;
  seasonId: string;
  /** Player id of the cook hosting this dinner. */
  hostId: string;
  /** Host date, ISO `YYYY-MM-DD`. */
  date: string;
  /** Short public join code, encoded into the QR shown on the day. */
  code: string;
  /** The cook's menu for the night (set by the cook or organizer). */
  mealDescription?: string;
}

/**
 * A signed-in participant's identity within a season: which player (nickname)
 * they are. Set once; then rating auto-knows them and, if they host a dinner,
 * they may edit it. Kept separate from dinners so it isn't tied to hosting.
 */
export interface Claim {
  /** Firebase uid of the participant. */
  uid: string;
  /** The player id they identify as. */
  playerId: string;
}

export interface Rating {
  /** Deterministic id = `${eventId}_${raterId}` → one submission per guest. */
  id: string;
  eventId: string;
  /** Player id of the guest who rated. */
  raterId: string;
  scores: Record<CategoryId, number>; // each 1..10
  comment?: string;
  createdAt: number;
}

export interface Season {
  id: string;
  name: string;
  /** uid of the organizer who created it; only they may edit or delete it. */
  ownerId: string;
  players: Player[];
  events: DinnerEvent[];
  /** Deadline after which results reveal even if some ratings are missing. */
  revealAt?: number;
  createdAt: number;
}

/** A resolved join target: which event a code points to, and its season. */
export interface JoinTarget {
  season: Season;
  event: DinnerEvent;
}
