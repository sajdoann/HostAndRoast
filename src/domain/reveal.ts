import type { DinnerEvent, Rating, Season } from "./types";
import { todayISO } from "./schedule";

/**
 * How many ratings an event expects: everyone in the season except the host.
 * (The host never rates their own dinner.)
 */
export function expectedRatings(season: Season): number {
  return Math.max(season.players.length - 1, 0);
}

export function ratingsForEvent(event: DinnerEvent, ratings: Rating[]): Rating[] {
  return ratings.filter((r) => r.eventId === event.id);
}

/** An event is complete once every expected guest has rated. */
export function isEventComplete(
  event: DinnerEvent,
  season: Season,
  ratings: Rating[]
): boolean {
  return ratingsForEvent(event, ratings).length >= expectedRatings(season);
}

/** A host date has passed when its date is strictly before today. */
export function hasDatePassed(event: DinnerEvent, today = todayISO()): boolean {
  return event.date < today;
}

export interface RevealStatus {
  revealed: boolean;
  allDatesPassed: boolean;
  allRatingsIn: boolean;
  deadlinePassed: boolean;
  /** Ratings still outstanding across the season (for a friendly "waiting on N"). */
  missingRatings: number;
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
    const have = ratingsForEvent(event, ratings).length;
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
  };
}
