import type { Category, DinnerEvent, JoinTarget, Player, Rating, Season } from "../domain/types";
import { computeLeaderboard, computeSeasonStats } from "../domain/scoring";
import { applyRosterChange, withHousehold, withoutPlayer } from "../domain/households";
import { genCode, genId } from "../domain/ids";
import type { CodeState, DB, Store } from "./types";

/**
 * localStorage-backed Store with a tiny pub/sub. Everything is in memory, so
 * the on-demand methods (setViewer/ensureSeason/resolveCode) are no-ops — all
 * seasons are always "loaded". Events stay embedded in the season object here.
 */

const KEY = "hr.db.v1";
const EMPTY: DB = {
  seasons: [],
  ratings: [],
  myClaims: {},
  myMemberships: [],
  revealed: [],
};

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
      revealed: parsed.revealed ?? [],
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

  function mapSeason(seasonId: string, patch: (s: Season) => Season): DB {
    return {
      ...state,
      seasons: state.seasons.map((s) => (s.id === seasonId ? patch(s) : s)),
    };
  }

  return {
    getState: () => state,
    isLoaded: () => true,
    isSeasonLoaded: () => true,
    getCodeState(code: string): CodeState {
      return this.findByCode(code) || this.findSeasonByCode(code) ? "ready" : "missing";
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

    findSeasonByCode(code: string): Season | undefined {
      const wanted = code.trim().toUpperCase();
      return state.seasons.find((s) => s.code === wanted);
    },

    createSeason(season: Season) {
      commit({ ...state, seasons: [...state.seasons, season] });
    },

    updateEvent(seasonId: string, event: DinnerEvent) {
      commit(mapEvent(seasonId, event));
    },

    claimPlayer(seasonId: string, _uid: string, playerId: string) {
      // Local mode is one browser, one person — no nickname can be contested.
      commit({ ...state, myClaims: { ...state.myClaims, [seasonId]: playerId } });
      return Promise.resolve();
    },

    claimedPlayers(seasonId: string) {
      const mine = state.myClaims[seasonId];
      return mine ? [mine] : [];
    },

    addPlayer(seasonId: string, name: string) {
      const season = state.seasons.find((s) => s.id === seasonId);
      if (!season) return;
      const player: Player = { id: genId(), name };
      commit(
        mapSeason(seasonId, (s) => ({
          ...s,
          players: [...s.players, player],
          events: [
            ...s.events,
            {
              id: genId(),
              seasonId,
              hostId: player.id,
              hostIds: [player.id],
              code: genCode(),
            },
          ],
        }))
      );
    },

    renamePlayer(seasonId: string, playerId: string, name: string) {
      commit(
        mapSeason(seasonId, (s) => ({
          ...s,
          players: s.players.map((p) => (p.id === playerId ? { ...p, name } : p)),
        }))
      );
    },

    removePlayer(seasonId: string, playerId: string) {
      const season = state.seasons.find((s) => s.id === seasonId);
      if (!season) return;
      const change = withoutPlayer(season, playerId);
      const dropped = season.events.filter((e) => change.dropDinnerFor.includes(e.hostId));
      const myClaims = { ...state.myClaims };
      if (myClaims[seasonId] === playerId) delete myClaims[seasonId];

      const next = mapSeason(seasonId, (s) => ({
        ...s,
        players: change.players,
        events: applyRosterChange(s.events, change, seasonId),
      }));
      commit({
        ...next,
        // Their votes on other dinners go too, so they can't sway a season
        // they've left.
        ratings: next.ratings.filter(
          (r) => r.raterId !== playerId && !dropped.some((e) => e.id === r.eventId)
        ),
        myClaims,
      });
    },

    setHousehold(seasonId: string, playerId: string, householdId: string | undefined) {
      const season = state.seasons.find((s) => s.id === seasonId);
      if (!season) return;
      const change = withHousehold(season, playerId, householdId);
      const dropped = season.events.filter((e) => change.dropDinnerFor.includes(e.hostId));
      const next = mapSeason(seasonId, (s) => ({
        ...s,
        players: change.players,
        events: applyRosterChange(s.events, change, seasonId),
      }));
      commit({
        ...next,
        ratings: next.ratings.filter((r) => !dropped.some((e) => e.id === r.eventId)),
      });
    },

    updateCategories(seasonId: string, categories: Category[]) {
      commit(mapSeason(seasonId, (s) => ({ ...s, categories })));
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
        revealed: state.revealed.filter((s) => s !== seasonId),
      });
    },

    addRating(rating: Rating) {
      if (!state.ratings.some((r) => r.id === rating.id)) {
        commit({ ...state, ratings: [...state.ratings, rating] });
      }
      return Promise.resolve();
    },

    getResults(seasonId: string) {
      if (!state.revealed.includes(seasonId)) return null;
      const season = state.seasons.find((s) => s.id === seasonId);
      return season ? computeLeaderboard(season, state.ratings) : null;
    },

    revealSeason(seasonId: string) {
      if (!state.revealed.includes(seasonId)) {
        commit({ ...state, revealed: [...state.revealed, seasonId] });
      }
      return Promise.resolve();
    },

    getFeedback(seasonId: string, hostId: string) {
      const season = state.seasons.find((s) => s.id === seasonId);
      if (!season || !state.revealed.includes(seasonId)) return Promise.resolve(null);
      return Promise.resolve(
        computeSeasonStats(season, state.ratings).feedbackByHost[hostId] ?? []
      );
    },

    getRaterStats(seasonId: string, playerId: string) {
      const season = state.seasons.find((s) => s.id === seasonId);
      if (!season || !state.revealed.includes(seasonId)) return Promise.resolve(null);
      return Promise.resolve(
        computeSeasonStats(season, state.ratings).raterStats[playerId] ?? null
      );
    },
  };
}

export const localStore = createLocalStore();
