import type { JoinTarget, Rating, Season } from "../domain/types";
import { computeLeaderboard } from "../domain/scoring";
import type { DB, Store } from "./types";

/**
 * localStorage-backed Store with a tiny pub/sub so React can subscribe via
 * useSyncExternalStore. Every mutation produces a NEW state object, so the
 * snapshot reference changes only when data actually changes.
 */

const KEY = "hr.db.v1";
const EMPTY: DB = { seasons: [], ratings: [] };

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as DB;
    return { seasons: parsed.seasons ?? [], ratings: parsed.ratings ?? [] };
  } catch {
    return EMPTY;
  }
}

function createLocalStore(): Store {
  let state: DB = load();
  const listeners = new Set<() => void>();

  function commit(next: DB) {
    state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full / unavailable — keep in-memory state */
    }
    listeners.forEach((l) => l());
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    createSeason(season: Season) {
      commit({ ...state, seasons: [...state.seasons, season] });
    },

    updateSeason(season: Season) {
      commit({
        ...state,
        seasons: state.seasons.map((s) => (s.id === season.id ? season : s)),
      });
    },

    deleteSeason(seasonId: string) {
      commit({
        seasons: state.seasons.filter((s) => s.id !== seasonId),
        ratings: state.ratings.filter(
          (r) =>
            !state.seasons
              .find((s) => s.id === seasonId)
              ?.events.some((e) => e.id === r.eventId)
        ),
      });
    },

    findByCode(code: string): JoinTarget | undefined {
      const wanted = code.trim().toUpperCase();
      for (const season of state.seasons) {
        const event = season.events.find((e) => e.code === wanted);
        if (event) return { season, event };
      }
      return undefined;
    },

    addRating(rating: Rating) {
      if (state.ratings.some((r) => r.id === rating.id)) return; // one per event+rater
      commit({ ...state, ratings: [...state.ratings, rating] });
    },

    getResults(seasonId: string) {
      const season = state.seasons.find((s) => s.id === seasonId);
      return season ? computeLeaderboard(season, state.ratings) : null;
    },
  };
}

export const localStore = createLocalStore();
