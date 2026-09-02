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

// Legacy fixed set — only for seasons created before categories were
// owner-editable (mirrors src/domain/categories.ts's LEGACY_CATEGORY_IDS).
const LEGACY_CATEGORY_IDS = ["food", "atmosphere", "entertainment"];

interface Player {
  id: string;
  name: string;
  /** Set when this player cooks with another: one dinner, one shared vote. */
  householdId?: string;
}
interface Category {
  id: string;
  label: string;
}
interface DinnerEvent {
  id: string;
  hostId: string;
  date?: string;
  code: string;
  mealDescription?: string;
}
interface Rating {
  id: string;
  eventId: string;
  raterId: string;
  scores: Record<string, number>;
  comment?: string | null;
  createdAt: number;
}
interface Season {
  id: string;
  name: string;
  ownerId: string;
  players: Player[];
  events: DinnerEvent[];
  categories?: Category[];
}

function categoryIdsFor(season: Season): string[] {
  return season.categories?.length ? season.categories.map((c) => c.id) : LEGACY_CATEGORY_IDS;
}

const householdIdOf = (p: Player) => p.householdId ?? p.id;

/** "Anna & Petr" — a dinner belongs to the kitchen, not to one cook. */
function hostNameOf(season: Season, hostId: string): string {
  const host = season.players.find((p) => p.id === hostId);
  if (!host) return "—";
  const id = householdIdOf(host);
  const members = season.players.filter((p) => householdIdOf(p) === id);
  return members.map((p) => p.name).join(" & ") || "—";
}

/**
 * Split each household's single vote between whoever in it rated: partners who
 * both rated carry half each, one rating alone carries the full vote. Ratings
 * from people no longer in the season are dropped.
 */
function weightRatings(season: Season, eventRatings: Rating[]) {
  const byHousehold = new Map<string, Rating[]>();
  for (const rating of eventRatings) {
    const player = season.players.find((p) => p.id === rating.raterId);
    if (!player) continue;
    const id = householdIdOf(player);
    const group = byHousehold.get(id);
    if (group) group.push(rating);
    else byHousehold.set(id, [rating]);
  }
  const weighted: { rating: Rating; weight: number }[] = [];
  for (const group of byHousehold.values()) {
    for (const rating of group) weighted.push({ rating, weight: 1 / group.length });
  }
  return weighted;
}

function weightedAverage(weighted: { rating: Rating; weight: number }[], cat: string): number {
  let total = 0;
  let weight = 0;
  for (const { rating, weight: w } of weighted) {
    const score = rating.scores[cat];
    if (typeof score !== "number") continue;
    total += score * w;
    weight += w;
  }
  return weight === 0 ? 0 : total / weight;
}

const average = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const ratingsForEvent = (event: DinnerEvent, ratings: Rating[]) =>
  ratings.filter((r) => r.eventId === event.id);

export function computeStats(season: Season, ratings: Rating[]) {
  const categoryIds = categoryIdsFor(season);
  const nameOf = (hostId: string) => hostNameOf(season, hostId);

  const board = season.events
    .map((event) => {
      const weighted = weightRatings(season, ratingsForEvent(event, ratings));
      const perCategory: Record<string, number> = {};
      for (const cat of categoryIds) {
        perCategory[cat] = round1(weightedAverage(weighted, cat));
      }
      const total = round1(categoryIds.reduce((s, c) => s + perCategory[c], 0));
      return {
        hostId: event.hostId,
        hostName: nameOf(event.hostId),
        perCategory,
        total,
        // Each household's weights sum to 1, so this is kitchens, not heads.
        ratingsCount: Math.round(weighted.reduce((sum, w) => sum + w.weight, 0)),
      };
    })
    .sort((a, b) => b.total - a.total);

  const perCategoryWinner: Record<string, { hostId: string; hostName: string; avg: number } | null> = {};
  for (const cat of categoryIds) {
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
    const total = round1(categoryIds.reduce((s, c) => s + (rating.scores[c] ?? 0), 0));
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
    const seasonData = seasonSnap.data() as {
      name: string;
      ownerId: string;
      players: Player[];
      categories?: Category[];
    };
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
      categories: seasonData.categories,
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
