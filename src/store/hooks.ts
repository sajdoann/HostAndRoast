import { useSyncExternalStore } from "react";
import { store } from "./index";
import type { DB } from "./types";
import type { Rating, Season } from "../domain/types";

/** Subscribe to the whole DB snapshot. */
export function useDB(): DB {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useSeasons(): Season[] {
  return useDB().seasons;
}

export function useSeason(seasonId: string | undefined): Season | undefined {
  const { seasons } = useDB();
  return seasons.find((s) => s.id === seasonId);
}

/**
 * Ratings for a season. Exposed for aggregate/reveal computations only —
 * never render raw scores before the reveal condition is met.
 */
export function useSeasonRatings(season: Season | undefined): Rating[] {
  const { ratings } = useDB();
  if (!season) return [];
  const eventIds = new Set(season.events.map((e) => e.id));
  return ratings.filter((r) => eventIds.has(r.eventId));
}
