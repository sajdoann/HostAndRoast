import type { DinnerEvent, Rating, Season } from "./types";
import { householdCount, householdIdOf } from "./households";
import { todayISO } from "./schedule";

/**
 * How many votes an event expects: every kitchen except the one hosting.
 * A household votes once however many people are in it, so this counts
 * households, not heads.
 */
export function expectedRatings(season: Season): number {
  return Math.max(householdCount(season) - 1, 0);
}

export function ratingsForEvent(event: DinnerEvent, ratings: Rating[]): Rating[] {
  return ratings.filter((r) => r.eventId === event.id);
}

/**
 * Votes in so far on a dinner: distinct households that rated it. Two partners
 * who both rated still count as the one vote their kitchen gets.
 */
export function householdVotes(
  event: DinnerEvent,
  season: Season,
  ratings: Rating[]
): number {
  const voted = new Set<string>();
  for (const rating of ratingsForEvent(event, ratings)) {
    const player = season.players.find((p) => p.id === rating.raterId);
    if (player) voted.add(householdIdOf(player));
  }
  return voted.size;
}

/** An event is complete once every expected household has voted. */
export function isEventComplete(
  event: DinnerEvent,
  season: Season,
  ratings: Rating[]
): boolean {
  return householdVotes(event, season, ratings) >= expectedRatings(season);
}

/** A host date has passed when it's set and strictly before today (an
 *  unscheduled dinner has no date to pass, so it never counts as "done"). */
export function hasDatePassed(event: DinnerEvent, today = todayISO()): boolean {
  return !!event.date && event.date < today;
}

export interface RevealStatus {
  revealed: boolean;
  allDatesPassed: boolean;
  allRatingsIn: boolean;
  deadlinePassed: boolean;
  /** Ratings still outstanding across the season (for a friendly "waiting on N"). */
  missingRatings: number;
  /**
   * Dinners with no date yet. These quietly block the auto-reveal (a dinner
   * with no date can never be "done"), so the organizer needs telling.
   */
  unscheduled: number;
}

/**
 * Reveal when every host date has passed AND all expected ratings are in,
 * OR the deadline has lapsed (so one missing guest can't hold the game hostage).
 */
export function revealStatus(
  season: Season,
  ratings: Rating[],
  now = Date.now()
): RevealStatus {
  const today = todayISO();
  const allDatesPassed = season.events.every((e) => hasDatePassed(e, today));

  let missingRatings = 0;
  for (const event of season.events) {
    const have = householdVotes(event, season, ratings);
    missingRatings += Math.max(expectedRatings(season) - have, 0);
  }
  const allRatingsIn = missingRatings === 0 && season.events.length > 0;
  const deadlinePassed = season.revealAt != null && now >= season.revealAt;

  return {
    revealed: (allDatesPassed && allRatingsIn) || deadlinePassed,
    allDatesPassed,
    allRatingsIn,
    deadlinePassed,
    missingRatings,
    unscheduled: season.events.filter((e) => !e.date).length,
  };
}
