import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { computeSeasonStats } from "../src/domain/scoring";
import type { DinnerEvent, Player, Rating, Season } from "../src/domain/types";

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
 * Requires env FIREBASE_SERVICE_ACCOUNT — the service-account JSON as a string.
 */

function ensureAdmin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  try {
    ensureAdmin();

    const seasonId = String((req.body?.seasonId ?? "")).trim();
    if (!seasonId) return res.status(400).json({ error: "seasonId required" });

    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "missing token" });
    const { uid } = await getAuth().verifyIdToken(token);

    const db = getFirestore();
    const seasonSnap = await db.doc(`seasons/${seasonId}`).get();
    if (!seasonSnap.exists) return res.status(404).json({ error: "season not found" });
    const seasonData = seasonSnap.data() as {
      name: string;
      ownerId: string;
      players: Player[];
      revealAt?: number;
      createdAt: number;
    };
    if (seasonData.ownerId !== uid) {
      return res.status(403).json({ error: "only the season owner can reveal" });
    }

    const [eventsSnap, ratingsSnap] = await Promise.all([
      db.collection(`seasons/${seasonId}/events`).get(),
      db.collection(`seasons/${seasonId}/ratings`).get(),
    ]);

    const events: DinnerEvent[] = eventsSnap.docs.map((d) => ({
      id: d.id,
      seasonId,
      ...(d.data() as Omit<DinnerEvent, "id" | "seasonId">),
    }));
    const ratings: Rating[] = ratingsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Rating, "id">),
    }));

    const season: Season = {
      id: seasonId,
      name: seasonData.name,
      ownerId: seasonData.ownerId,
      players: seasonData.players ?? [],
      events,
      revealAt: seasonData.revealAt,
      createdAt: seasonData.createdAt,
    };

    const stats = computeSeasonStats(season, ratings);

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
