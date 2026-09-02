/**
 * Core domain model for the Host & Roast rating game
 * (a take-turns-hosting dinner game among friends).
 *
 * A Season has a fixed list of players. Each player hosts one Dinner Event on
 * their date (round-robin — one host per day). Guests rate every dinner they
 * attend; scores stay hidden until the season's reveal condition is met.
 */

export interface Player {
  id: string;
  name: string;
  /**
   * The player id of the household this player cooks with (a couple, flatmates
   * — whoever shares one kitchen). Unset means they cook alone. A household
   * hosts one dinner together and casts one shared vote on everyone else's.
   */
  householdId?: string;
}

/** One rating category (a 1–10 slider). The comment field is separate and
 *  always present — it isn't part of this configurable list. */
export interface Category {
  id: string;
  label: string;
}

export interface DinnerEvent {
  id: string;
  seasonId: string;
  /** Player id of the cook hosting this dinner. */
  hostId: string;
  /** Host date, ISO `YYYY-MM-DD`. Unset means not yet scheduled. */
  date?: string;
  /** Short public join code, encoded into the QR shown on the day. */
  code: string;
  /** The cook's menu for the night (set by the cook or organizer). */
  mealDescription?: string;
  /** Where to go — a maps link (http/https only), set by the cook or organizer. */
  locationUrl?: string;
  /** The address or directions in words: "3rd floor, ring twice". */
  locationNote?: string;
  /**
   * Everyone in the hosting household, denormalized so the security rules can
   * let either partner edit their own dinner without looking up the roster.
   */
  hostIds?: string[];
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
  /** Category id → score (1..10), for whichever categories the season had at rating time. */
  scores: Record<string, number>;
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
  /**
   * Short public join code for the season overview (encoded into its QR),
   * separate from each dinner's own code. Optional so seasons created before
   * this existed still load fine — they just show a plain link, no code.
   */
  code?: string;
  /**
   * Rating categories this season uses (owner-editable; comment is separate
   * and always kept). Unset/empty means a season created before this existed
   * — it keeps rating on the original fixed three (food, atmosphere,
   * entertainment) for backward compatibility.
   */
  categories?: Category[];
  /** Deadline after which results reveal even if some ratings are missing. */
  revealAt?: number;
  createdAt: number;
}

/** A resolved join target: which event a code points to, and its season. */
export interface JoinTarget {
  season: Season;
  event: DinnerEvent;
}
