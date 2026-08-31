import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { store } from "./index";
import type { CodeState, DB } from "./types";
import type { JoinTarget, Rating, Season } from "../domain/types";

/** Subscribe to the whole snapshot (owner's seasons + any loaded on demand). */
export function useDB(): DB {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** True once the viewer's own season list has loaded (home page). */
export function useLoaded(): boolean {
  return useSyncExternalStore(store.subscribe, store.isLoaded, store.isLoaded);
}

export function useSeasons(): Season[] {
  return useDB().seasons;
}

/** The current viewer's claimed player id for a season, if any. */
export function useMyClaim(seasonId: string | undefined): string | undefined {
  const { myClaims } = useDB();
  return seasonId ? myClaims[seasonId] : undefined;
}

function ratingsFor(season: Season | undefined, db: DB): Rating[] {
  if (!season) return [];
  const eventIds = new Set(season.events.map((e) => e.id));
  return db.ratings.filter((r) => eventIds.has(r.eventId));
}

/**
 * Load and read a single season by id (ensures its Firestore subscription).
 * Returns the season, its ratings/receipts, and whether it has loaded.
 */
export function useSeasonView(seasonId: string | undefined): {
  season: Season | undefined;
  ratings: Rating[];
  loaded: boolean;
} {
  useEffect(() => {
    if (seasonId) store.ensureSeason(seasonId);
  }, [seasonId]);

  const db = useDB();
  const loaded = useSyncExternalStore(
    store.subscribe,
    () => (seasonId ? store.isSeasonLoaded(seasonId) : true)
  );
  const season = db.seasons.find((s) => s.id === seasonId);
  return { season, ratings: ratingsFor(season, db), loaded };
}

/** Resolve a join code and read its target from the loaded state. */
export function useJoinTarget(code: string | undefined): {
  target: JoinTarget | undefined;
  codeState: CodeState;
} {
  useEffect(() => {
    if (code) store.resolveCode(code);
  }, [code]);

  useDB(); // re-render on data changes
  const codeState = useSyncExternalStore(
    store.subscribe,
    () => (code ? store.getCodeState(code) : "missing")
  );
  const target = code ? store.findByCode(code) : undefined;
  return { target, codeState };
}

/** Resolve a season-level join code (the season overview's own QR code). */
export function useSeasonByCode(code: string | undefined): {
  season: Season | undefined;
  codeState: CodeState;
} {
  useEffect(() => {
    if (code) store.resolveCode(code);
  }, [code]);

  useDB(); // re-render on data changes
  const codeState = useSyncExternalStore(
    store.subscribe,
    () => (code ? store.getCodeState(code) : "missing")
  );
  const season = code ? store.findSeasonByCode(code) : undefined;
  return { season, codeState };
}
