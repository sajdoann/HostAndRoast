import type { DinnerEvent, JoinTarget, Rating, Season } from "../domain/types";
import { computeLeaderboard } from "../domain/scoring";
import type { CodeState, DB, Store } from "./types";

/**
 * localStorage-backed Store with a tiny pub/sub. Everything is in memory, so
 * the on-demand methods (setViewer/ensureSeason/resolveCode) are no-ops — all
 * seasons are always "loaded". Events stay embedded in the season object here.
 */

const KEY = "hr.db.v1";
const EMPTY: DB = { seasons: [], ratings: [], myClaims: {}, myMemberships: [] };

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as DB;
    return {
      seasons: parsed.seasons ?? [],
      ratings: parsed.ratings ?? [],
      myClaims: parsed.myClaims ?? {},
      myMemberships: parsed.myMemberships ?? [],
    };
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
      /* storage full / unavailable */
    }
    listeners.forEach((l) => l());
  }

  function mapEvent(seasonId: string, event: DinnerEvent): DB {
    return {
      ...state,
      seasons: state.seasons.map((s) =>
        s.id === seasonId
          ? { ...s, events: s.events.map((e) => (e.id === event.id ? event : e)) }
          : s
      ),
    };
  }

  return {
    getState: () => state,
    isLoaded: () => true,
    isSeasonLoaded: () => true,
    getCodeState(code: string): CodeState {
      return this.findByCode(code) ? "ready" : "missing";
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setViewer() {
      /* no-op in local mode */
    },
    ensureSeason() {
      /* already loaded */
    },
    resolveCode() {
      /* already loaded */
    },

    findByCode(code: string): JoinTarget | undefined {
      const wanted = code.trim().toUpperCase();
      for (const season of state.seasons) {
        const event = season.events.find((e) => e.code === wanted);
        if (event) return { season, event };
      }
      return undefined;
    },

    createSeason(season: Season) {
      commit({ ...state, seasons: [...state.seasons, season] });
    },

    updateEvent(seasonId: string, event: DinnerEvent) {
      commit(mapEvent(seasonId, event));
    },

    claimPlayer(seasonId: string, _uid: string, playerId: string) {
      commit({ ...state, myClaims: { ...state.myClaims, [seasonId]: playerId } });
    },

    deleteSeason(seasonId: string) {
      const removed = state.seasons.find((s) => s.id === seasonId);
      const myClaims = { ...state.myClaims };
      delete myClaims[seasonId];
      commit({
        seasons: state.seasons.filter((s) => s.id !== seasonId),
        ratings: state.ratings.filter(
          (r) => !removed?.events.some((e) => e.id === r.eventId)
        ),
        myClaims,
        myMemberships: state.myMemberships.filter((s) => s !== seasonId),
      });
    },

    addRating(rating: Rating) {
      if (!state.ratings.some((r) => r.id === rating.id)) {
        commit({ ...state, ratings: [...state.ratings, rating] });
      }
      return Promise.resolve();
    },

    getResults(seasonId: string) {
      const season = state.seasons.find((s) => s.id === seasonId);
      return season ? computeLeaderboard(season, state.ratings) : null;
    },
  };
}

export const localStore = createLocalStore();
