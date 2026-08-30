import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * POST /api/reveal  { seasonId }   Authorization: Bearer <Firebase ID token>
 *
 * The trusted reveal engine. Only the season owner may call it. It reads the
 * read-never ratings with admin credentials, computes the full stats, and
 * publishes:
 *   results/{sid}                       public leaderboard + per-category winners
 *   results/{sid}/feedback/{hostId}     that dinner's comments (cook/owner only)
 *   results/{sid}/raters/{playerId}     that rater's own scores (self/owner only)
 *
 * Self-contained on purpose (no imports from ../src) so Vercel bundles it
 * cleanly. The scoring below mirrors src/domain/scoring.ts — keep them in sync.
 * Requires env FIREBASE_SERVICE_ACCOUNT — the service-account JSON as a string.
 */

type CategoryId = "food" | "atmosphere" | "entertainment";
const CATEGORIES: CategoryId[] = ["food", "atmosphere", "entertainment"];

interface Player {
  id: string;
  name: string;
}
interface DinnerEvent {
  id: string;
  hostId: string;
  date: string;
  code: string;
  mealDescription?: string;
}
interface Rating {
  id: string;
  eventId: string;
  raterId: string;
  scores: Record<CategoryId, number>;
  comment?: string | null;
  createdAt: number;
}
interface Season {
  id: string;
  name: string;
  ownerId: string;
  players: Player[];
  events: DinnerEvent[];
}

const average = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const ratingsForEvent = (event: DinnerEvent, ratings: Rating[]) =>
  ratings.filter((r) => r.eventId === event.id);

function computeStats(season: Season, ratings: Rating[]) {
  const nameOf = (id: string) => season.players.find((p) => p.id === id)?.name ?? "—";

  const board = season.events
    .map((event) => {
      const eventRatings = ratingsForEvent(event, ratings);
      const perCategory = {} as Record<CategoryId, number>;
      for (const cat of CATEGORIES) {
        perCategory[cat] = round1(average(eventRatings.map((r) => r.scores[cat])));
      }
      const total = round1(CATEGORIES.reduce((s, c) => s + perCategory[c], 0));
      return {
        hostId: event.hostId,
        hostName: nameOf(event.hostId),
        perCategory,
        total,
        ratingsCount: eventRatings.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const perCategoryWinner: Record<CategoryId, { hostId: string; hostName: string; avg: number } | null> =
    {} as never;
  for (const cat of CATEGORIES) {
    let best: { hostId: string; hostName: string; avg: number } | null = null;
    for (const row of board) {
      if (row.ratingsCount > 0 && (!best || row.perCategory[cat] > best.avg)) {
        best = { hostId: row.hostId, hostName: row.hostName, avg: row.perCategory[cat] };
      }
    }
    perCategoryWinner[cat] = best;
  }

  const feedbackByHost: Record<string, string[]> = {};
  for (const event of season.events) {
    feedbackByHost[event.hostId] = ratingsForEvent(event, ratings)
      .map((r) => (r.comment ?? "").trim())
      .filter(Boolean);
  }

  const raterStats: Record<string, { playerId: string; avg: number; perDinner: { hostId: string; hostName: string; total: number }[] }> = {};
  for (const rating of ratings) {
    const event = season.events.find((e) => e.id === rating.eventId);
    if (!event) continue;
    const total = round1(CATEGORIES.reduce((s, c) => s + (rating.scores[c] ?? 0), 0));
    const entry = (raterStats[rating.raterId] ??= { playerId: rating.raterId, avg: 0, perDinner: [] });
    entry.perDinner.push({ hostId: event.hostId, hostName: nameOf(event.hostId), total });
  }
  for (const s of Object.values(raterStats)) s.avg = round1(average(s.perDinner.map((d) => d.total)));

  return { board, perCategoryWinner, ratingsCount: ratings.length, feedbackByHost, raterStats };
}

function ensureAdmin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    ensureAdmin();

    const seasonId = String(req.body?.seasonId ?? "").trim();
    if (!seasonId) return res.status(400).json({ error: "seasonId required" });

    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "missing token" });
    const { uid } = await getAuth().verifyIdToken(token);

    const db = getFirestore();
    const seasonSnap = await db.doc(`seasons/${seasonId}`).get();
    if (!seasonSnap.exists) return res.status(404).json({ error: "season not found" });
    const seasonData = seasonSnap.data() as { name: string; ownerId: string; players: Player[] };
    if (seasonData.ownerId !== uid) {
      return res.status(403).json({ error: "only the season owner can reveal" });
    }

    const [eventsSnap, ratingsSnap] = await Promise.all([
      db.collection(`seasons/${seasonId}/events`).get(),
      db.collection(`seasons/${seasonId}/ratings`).get(),
    ]);

    const events: DinnerEvent[] = eventsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DinnerEvent, "id">) }));
    const ratings: Rating[] = ratingsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Rating, "id">) }));

    const season: Season = {
      id: seasonId,
      name: seasonData.name,
      ownerId: seasonData.ownerId,
      players: seasonData.players ?? [],
      events,
    };

    const stats = computeStats(season, ratings);

    const batch = db.batch();
    batch.set(db.doc(`results/${seasonId}`), {
      board: stats.board,
      perCategoryWinner: stats.perCategoryWinner,
      ratingsCount: stats.ratingsCount,
      players: season.players,
      revealedAt: Date.now(),
    });
    for (const [hostId, comments] of Object.entries(stats.feedbackByHost)) {
      batch.set(db.doc(`results/${seasonId}/feedback/${hostId}`), { hostId, comments });
    }
    for (const [playerId, rater] of Object.entries(stats.raterStats)) {
      batch.set(db.doc(`results/${seasonId}/raters/${playerId}`), rater);
    }
    await batch.commit();

    return res.status(200).json({ ok: true, revealed: stats.ratingsCount });
  } catch (err) {
    console.error("[reveal] failed:", err);
    return res.status(500).json({ error: (err as Error).message ?? "reveal failed" });
  }
}
