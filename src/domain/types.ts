/**
 * Core domain model for the Host & Roast rating game
 * (a Prostřeno! / "Come Dine With Me" style season among friends).
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
  hostId: string;
  /** Host date, ISO `YYYY-MM-DD`. */
  date: string;
  /** Short public join code, encoded into the QR shown on the day. */
  code: string;
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
