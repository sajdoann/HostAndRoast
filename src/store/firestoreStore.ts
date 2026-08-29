import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { DinnerEvent, JoinTarget, Rating, Season } from "../domain/types";
import type { HostResult } from "../domain/scoring";
import type { CodeState, DB, Store } from "./types";

/**
 * Firestore-backed Store that loads on demand:
 *   - the viewer's own seasons (setViewer → query on ownerId),
 *   - any season opened by its link (ensureSeason) or join code (resolveCode).
 *
 * Layout (see firestore.rules):
 *   seasons/{sid}                     season doc (owner-writable; get is public)
 *   seasons/{sid}/events/{eid}        one dinner (owner or claimed cook edits)
 *   codes/{CODE}                      { seasonId, eventId } join lookup
 *   seasons/{sid}/ratings/{eid_rid}   scores (read-never)
 *   seasons/{sid}/receipts/{eid_rid}  who rated (public, no scores)
 *   results/{sid}                     leaderboard (Function-published)
 */
export function createFirestoreStore(): Store {
  if (!db) throw new Error("Firestore is not configured");
  const fdb = db;

  type SeasonDoc = Omit<Season, "id" | "events">;
  const seasonDocs = new Map<string, SeasonDoc>();
  const eventsBySeason = new Map<string, DinnerEvent[]>();
  const receiptsBySeason = new Map<string, Rating[]>();
  const resultsById = new Map<string, HostResult[]>();

  const seasonDocLoaded = new Set<string>();
  const eventsLoaded = new Set<string>();
  const subs = new Map<string, Array<() => void>>();
  const claimSubs = new Map<string, () => void>(); // viewer's claim doc, per season
  const myClaims: Record<string, string> = {}; // seasonId → playerId (current viewer)
  const memberships = new Set<string>(); // seasons the viewer participates in
  const localGameIds = new Set<string>(); // same-device history (works with no rule)
  let fsMembershipIds: string[] = []; // from Firestore (cross-device)
  const codeToSeason = new Map<string, string | null>(); // null = not found
  let ownerUnsub: (() => void) | null = null;
  let membershipUnsub: (() => void) | null = null;
  let ownerLoaded = false;
  let viewerUid: string | null = null;

  let state: DB = { seasons: [], ratings: [], myClaims: {}, myMemberships: [] };
  const listeners = new Set<() => void>();

  const onError = (where: string) => (err: unknown) =>
    console.error(`[firestore] ${where} listener failed:`, err);

  // Per-account, same-device record of games participated in. Works even if the
  // Firestore memberships rule isn't deployed; the Firestore list adds
  // cross-device coverage on top.
  const gamesKey = (uid: string) => `hr.games.${uid}`;
  function loadLocalGames(uid: string): string[] {
    try {
      return JSON.parse(localStorage.getItem(gamesKey(uid)) || "[]");
    } catch {
      return [];
    }
  }
  function saveLocalGame(uid: string, seasonId: string) {
    try {
      const set = new Set(loadLocalGames(uid));
      set.add(seasonId);
      localStorage.setItem(gamesKey(uid), JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }

  function recomputeMemberships() {
    memberships.clear();
    for (const id of localGameIds) memberships.add(id);
    for (const id of fsMembershipIds) memberships.add(id);
  }

  function rebuild() {
    const seasons: Season[] = [];
    for (const [id, docData] of seasonDocs) {
      const events = [...(eventsBySeason.get(id) ?? [])].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      seasons.push({ ...docData, id, events });
    }
    const ratings: Rating[] = [];
    for (const list of receiptsBySeason.values()) ratings.push(...list);
    state = { seasons, ratings, myClaims: { ...myClaims }, myMemberships: [...memberships] };
    listeners.forEach((l) => l());
  }

  // Subscribe to the current viewer's claim doc for a season (who they are).
  function subscribeClaim(seasonId: string) {
    claimSubs.get(seasonId)?.();
    claimSubs.delete(seasonId);
    delete myClaims[seasonId];
    if (!viewerUid) return;
    const unsub = onSnapshot(
      doc(fdb, "seasons", seasonId, "claims", viewerUid),
      (d) => {
        if (d.exists()) myClaims[seasonId] = (d.data() as { playerId: string }).playerId;
        else delete myClaims[seasonId];
        rebuild();
      },
      onError("claim")
    );
    claimSubs.set(seasonId, unsub);
  }

  function mapEvents(seasonId: string, snap: import("firebase/firestore").QuerySnapshot) {
    return snap.docs.map((d) => {
      const data = d.data() as Omit<DinnerEvent, "id" | "seasonId">;
      return { id: d.id, seasonId, ...data } satisfies DinnerEvent;
    });
  }

  function ensureSeason(seasonId: string) {
    if (subs.has(seasonId)) return;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(fdb, "seasons", seasonId),
        (d) => {
          if (d.exists()) seasonDocs.set(seasonId, d.data() as SeasonDoc);
          else seasonDocs.delete(seasonId);
          seasonDocLoaded.add(seasonId);
          rebuild();
        },
        onError("season")
      )
    );
    unsubs.push(
      onSnapshot(
        collection(fdb, "seasons", seasonId, "events"),
        (snap) => {
          eventsBySeason.set(seasonId, mapEvents(seasonId, snap));
          eventsLoaded.add(seasonId);
          rebuild();
        },
        onError("events")
      )
    );
    unsubs.push(
      onSnapshot(
        collection(fdb, "seasons", seasonId, "receipts"),
        (snap) => {
          receiptsBySeason.set(
            seasonId,
            snap.docs.map((d) => {
              const data = d.data() as { eventId: string; raterId: string; createdAt: number };
              return {
                id: d.id,
                eventId: data.eventId,
                raterId: data.raterId,
                scores: { food: 0, atmosphere: 0, entertainment: 0 },
                createdAt: data.createdAt,
              } satisfies Rating;
            })
          );
          rebuild();
        },
        onError("receipts")
      )
    );
    unsubs.push(
      onSnapshot(
        doc(fdb, "results", seasonId),
        (d) => {
          if (d.exists()) resultsById.set(seasonId, (d.data() as { board: HostResult[] }).board ?? []);
          else resultsById.delete(seasonId);
          rebuild();
        },
        onError("results")
      )
    );

    subs.set(seasonId, unsubs);
    subscribeClaim(seasonId);
  }

  function eventDoc(event: DinnerEvent) {
    const data: Record<string, unknown> = {
      hostId: event.hostId,
      date: event.date,
      code: event.code,
    };
    if (event.mealDescription != null) data.mealDescription = event.mealDescription;
    return data;
  }

  /**
   * Bind "this account = this player" for a season. The claim is the identity
   * that matters (auto-rating, editing your dinner) and is written on its own;
   * the membership record is a separate best-effort write so a permission issue
   * on it can never undo the claim.
   */
  function bindIdentity(seasonId: string, uid: string, playerId: string) {
    void setDoc(doc(fdb, "seasons", seasonId, "claims", uid), { playerId }).catch(
      onError("bindIdentity/claim")
    );
    void setDoc(doc(fdb, "users", uid, "memberships", seasonId), { seasonId }).catch(
      onError("bindIdentity/membership")
    );
    // Same-device record so the game shows up in "your seasons" immediately,
    // regardless of the memberships rule.
    saveLocalGame(uid, seasonId);
    if (uid === viewerUid) {
      localGameIds.add(seasonId);
      ensureSeason(seasonId);
      recomputeMemberships();
      rebuild();
    }
  }

  return {
    getState: () => state,
    isLoaded: () => ownerLoaded,
    isSeasonLoaded: (seasonId: string) =>
      seasonDocLoaded.has(seasonId) && eventsLoaded.has(seasonId),

    getCodeState(code: string): CodeState {
      const key = code.trim().toUpperCase();
      if (!codeToSeason.has(key)) return "loading";
      const sid = codeToSeason.get(key);
      if (sid == null) return "missing";
      return this.isSeasonLoaded(sid) ? "ready" : "loading";
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setViewer(uid: string | null) {
      if (uid === viewerUid) return;
      viewerUid = uid;
      // Re-point every loaded season's claim subscription at the new viewer.
      for (const seasonId of subs.keys()) subscribeClaim(seasonId);
      membershipUnsub?.();
      membershipUnsub = null;
      memberships.clear();
      localGameIds.clear();
      fsMembershipIds = [];
      ownerUnsub?.();
      ownerUnsub = null;
      ownerLoaded = false;
      if (!uid) {
        ownerLoaded = true;
        rebuild();
        return;
      }
      // Seed from same-device history first (no rule required).
      for (const sid of loadLocalGames(uid)) {
        localGameIds.add(sid);
        ensureSeason(sid);
      }
      recomputeMemberships();
      // Then merge in the Firestore list for cross-device participation.
      membershipUnsub = onSnapshot(
        collection(fdb, "users", uid, "memberships"),
        (snap) => {
          fsMembershipIds = snap.docs.map((d) => d.id);
          fsMembershipIds.forEach((id) => ensureSeason(id));
          recomputeMemberships();
          rebuild();
        },
        onError("memberships")
      );
      ownerUnsub = onSnapshot(
        query(collection(fdb, "seasons"), where("ownerId", "==", uid)),
        (snap) => {
          snap.docs.forEach((d) => {
            seasonDocs.set(d.id, d.data() as SeasonDoc);
            seasonDocLoaded.add(d.id);
            ensureSeason(d.id); // load events so the owner's dashboard is ready
          });
          ownerLoaded = true;
          rebuild();
        },
        onError("my-seasons")
      );
    },

    ensureSeason,

    resolveCode(code: string) {
      const key = code.trim().toUpperCase();
      if (codeToSeason.has(key)) return; // already resolving/resolved
      getDoc(doc(fdb, "codes", key))
        .then((d) => {
          if (!d.exists()) {
            codeToSeason.set(key, null);
          } else {
            const sid = (d.data() as { seasonId: string }).seasonId;
            codeToSeason.set(key, sid);
            ensureSeason(sid);
          }
          rebuild();
        })
        .catch((e) => {
          console.error("[firestore] resolveCode failed:", e);
          codeToSeason.set(key, null);
          rebuild();
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

    createSeason(season: Season) {
      const batch = writeBatch(fdb);
      const { events, ...meta } = season;
      const seasonData: Record<string, unknown> = {
        name: meta.name,
        ownerId: meta.ownerId,
        players: meta.players,
        createdAt: meta.createdAt,
      };
      if (meta.revealAt != null) seasonData.revealAt = meta.revealAt;
      batch.set(doc(fdb, "seasons", season.id), seasonData);
      for (const event of events) {
        // ownerId is denormalized onto the event so the create rule needs no
        // cross-doc read (the season isn't committed yet within this batch).
        batch.set(doc(fdb, "seasons", season.id, "events", event.id), {
          ...eventDoc(event),
          ownerId: meta.ownerId,
        });
        batch.set(doc(fdb, "codes", event.code), { seasonId: season.id, eventId: event.id });
      }
      batch.commit().catch(onError("createSeason"));
      ensureSeason(season.id);
    },

    updateEvent(seasonId: string, event: DinnerEvent) {
      void updateDoc(doc(fdb, "seasons", seasonId, "events", event.id), {
        date: event.date,
        mealDescription: event.mealDescription ?? null,
      }).catch(onError("updateEvent"));
    },

    claimPlayer(seasonId: string, uid: string, playerId: string) {
      bindIdentity(seasonId, uid, playerId);
    },

    deleteSeason(seasonId: string) {
      // Delete the season doc + its dinners. Code docs are left as harmless
      // orphans (a stale code just resolves to a missing season); the rules
      // keep codes immutable, so we don't touch them here.
      getDocs(collection(fdb, "seasons", seasonId, "events"))
        .then((snap) => {
          const batch = writeBatch(fdb);
          snap.docs.forEach((d) => batch.delete(d.ref));
          batch.delete(doc(fdb, "seasons", seasonId));
          return batch.commit();
        })
        .catch(onError("deleteSeason"));
      subs.get(seasonId)?.forEach((u) => u());
      subs.delete(seasonId);
      claimSubs.get(seasonId)?.();
      claimSubs.delete(seasonId);
      delete myClaims[seasonId];
      seasonDocs.delete(seasonId);
      eventsBySeason.delete(seasonId);
      seasonDocLoaded.delete(seasonId);
      eventsLoaded.delete(seasonId);
      rebuild();
    },

    addRating(rating: Rating) {
      const season = state.seasons.find((s) =>
        s.events.some((e) => e.id === rating.eventId)
      );
      if (!season) return;
      const batch = writeBatch(fdb);
      batch.set(doc(fdb, "seasons", season.id, "ratings", rating.id), {
        eventId: rating.eventId,
        raterId: rating.raterId,
        scores: rating.scores,
        comment: rating.comment ?? null,
        createdAt: rating.createdAt,
      });
      batch.set(doc(fdb, "seasons", season.id, "receipts", rating.id), {
        eventId: rating.eventId,
        raterId: rating.raterId,
        createdAt: rating.createdAt,
      });
      batch.commit().catch(onError("addRating"));
      // Once a signed-in person rates as a nickname, that nickname is them for
      // the season (and the season joins their list). Best-effort, separate
      // from the rating write so it can't break it.
      if (viewerUid) bindIdentity(season.id, viewerUid, rating.raterId);
    },

    getResults(seasonId: string) {
      return resultsById.get(seasonId) ?? null;
    },
  };
}
