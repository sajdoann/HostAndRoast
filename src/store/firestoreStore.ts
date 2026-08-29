import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { JoinTarget, Rating, Season } from "../domain/types";
import type { HostResult } from "../domain/scoring";
import type { DB, Store } from "./types";

/**
 * Firestore-backed Store. Mirrors the localStore surface (a stable snapshot +
 * pub/sub) but the snapshot is fed by real-time onSnapshot listeners.
 *
 * Score-hiding is preserved by the data layout:
 *   seasons/{id}                      — public (schedule, players, join codes)
 *   seasons/{id}/ratings/{eId_rId}    — scores, READ-NEVER for clients
 *   seasons/{id}/receipts/{eId_rId}   — no scores, public; drives progress/reveal
 *   results/{seasonId}                — leaderboard, written by a Function on reveal
 *
 * So the client can count who has rated (receipts) and show the final board
 * (results) without ever reading a raw score.
 */
export function createFirestoreStore(): Store {
  if (!db) throw new Error("Firestore is not configured");
  const fdb = db;

  // Receipts are surfaced as Rating objects with zeroed scores — only their
  // (eventId, raterId) matter for counting; the real scores stay server-side.
  let state: DB = { seasons: [], ratings: [] };
  let results: Record<string, HostResult[]> = {};
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((l) => l());
  }

  // If a listener errors (e.g. Firestore not enabled yet, or rules not
  // deployed), surface it — otherwise the app just shows empty data silently.
  const onError = (where: string) => (err: unknown) =>
    console.error(`[firestore] ${where} listener failed:`, err);

  onSnapshot(
    collection(fdb, "seasons"),
    (snap) => {
      state = {
        ...state,
        seasons: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Season, "id">) })),
      };
      notify();
    },
    onError("seasons")
  );

  onSnapshot(
    collectionGroup(fdb, "receipts"),
    (snap) => {
      state = {
        ...state,
        ratings: snap.docs.map((d) => {
          const data = d.data() as { eventId: string; raterId: string; createdAt: number };
          return {
            id: d.id,
            eventId: data.eventId,
            raterId: data.raterId,
            scores: { food: 0, atmosphere: 0, entertainment: 0 },
            createdAt: data.createdAt,
          } satisfies Rating;
        }),
      };
      notify();
    },
    onError("receipts")
  );

  onSnapshot(
    collection(fdb, "results"),
    (snap) => {
      const next: Record<string, HostResult[]> = {};
      snap.docs.forEach((d) => {
        next[d.id] = (d.data() as { board: HostResult[] }).board ?? [];
      });
      results = next;
      notify();
    },
    onError("results")
  );

  function seasonDoc(season: Season) {
    const data: Record<string, unknown> = {
      name: season.name,
      players: season.players,
      events: season.events,
      createdAt: season.createdAt,
    };
    if (season.revealAt != null) data.revealAt = season.revealAt;
    return data;
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    createSeason(season) {
      void setDoc(doc(fdb, "seasons", season.id), seasonDoc(season));
    },

    updateSeason(season) {
      void setDoc(doc(fdb, "seasons", season.id), seasonDoc(season));
    },

    deleteSeason(seasonId) {
      // Note: subcollections must be cleaned up server-side (a Function or the
      // Firebase CLI); deleting the parent doc alone leaves them orphaned.
      void deleteDoc(doc(fdb, "seasons", seasonId));
    },

    findByCode(code) {
      const wanted = code.trim().toUpperCase();
      for (const season of state.seasons) {
        const event = season.events.find((e) => e.code === wanted);
        if (event) return { season, event } satisfies JoinTarget;
      }
      return undefined;
    },

    addRating(rating) {
      const season = state.seasons.find((s) =>
        s.events.some((e) => e.id === rating.eventId)
      );
      if (!season) return;
      const batch = writeBatch(fdb);
      // Scores — read-never.
      batch.set(doc(fdb, "seasons", season.id, "ratings", rating.id), {
        eventId: rating.eventId,
        raterId: rating.raterId,
        scores: rating.scores,
        comment: rating.comment ?? null,
        createdAt: rating.createdAt,
      });
      // Receipt — public, no scores.
      batch.set(doc(fdb, "seasons", season.id, "receipts", rating.id), {
        eventId: rating.eventId,
        raterId: rating.raterId,
        createdAt: rating.createdAt,
      });
      void batch.commit();
    },

    getResults(seasonId) {
      return results[seasonId] ?? null;
    },
  };
}
