import type { CategoryId, Rating, Season } from "./types";
import { CATEGORIES } from "./categories";
import { ratingsForEvent } from "./reveal";

export interface HostResult {
  hostId: string;
  hostName: string;
  perCategory: Record<CategoryId, number>; // average per category
  total: number; // sum of the category averages (max = CATEGORIES.length * 10)
  ratingsCount: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Leaderboard: for each host, average each category across their dinner's
 * ratings, then total those averages. Sorted high → low.
 * Pure and side-effect free — the future Cloud Function can reuse it verbatim.
 */
export function computeLeaderboard(
  season: Season,
  ratings: Rating[]
): HostResult[] {
  const results = season.events.map((event): HostResult => {
    const host = season.players.find((p) => p.id === event.hostId);
    const eventRatings = ratingsForEvent(event, ratings);

    const perCategory = {} as Record<CategoryId, number>;
    for (const cat of CATEGORIES) {
      perCategory[cat] = round1(average(eventRatings.map((r) => r.scores[cat])));
    }
    const total = round1(
      CATEGORIES.reduce((sum, cat) => sum + perCategory[cat], 0)
    );

    return {
      hostId: event.hostId,
      hostName: host?.name ?? "—",
      perCategory,
      total,
      ratingsCount: eventRatings.length,
    };
  });

  return results.sort((a, b) => b.total - a.total);
}

export const MAX_TOTAL = CATEGORIES.length * 10;

/** One rater's own view: what they gave each dinner, and their average. */
export interface RaterStats {
  playerId: string;
  avg: number; // average total they handed out
  perDinner: { hostId: string; hostName: string; total: number }[];
}

/** The full reveal payload — leaderboard plus everything the results page shows. */
export interface SeasonStats {
  board: HostResult[];
  perCategoryWinner: Record<CategoryId, { hostId: string; hostName: string; avg: number } | null>;
  ratingsCount: number;
  /** hostId → the comments left on that dinner (anonymous). */
  feedbackByHost: Record<string, string[]>;
  /** playerId → that rater's own scores. */
  raterStats: Record<string, RaterStats>;
}

/**
 * Compute the entire reveal payload from a season and its raw ratings.
 * Pure and Node-safe — the reveal server calls this directly.
 */
export function computeSeasonStats(season: Season, ratings: Rating[]): SeasonStats {
  const board = computeLeaderboard(season, ratings);
  const nameOf = (id: string) => season.players.find((p) => p.id === id)?.name ?? "—";

  const perCategoryWinner = {} as SeasonStats["perCategoryWinner"];
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

  const raterStats: Record<string, RaterStats> = {};
  for (const rating of ratings) {
    const event = season.events.find((e) => e.id === rating.eventId);
    if (!event) continue;
    const total = round1(CATEGORIES.reduce((s, c) => s + (rating.scores[c] ?? 0), 0));
    const entry = (raterStats[rating.raterId] ??= {
      playerId: rating.raterId,
      avg: 0,
      perDinner: [],
    });
    entry.perDinner.push({ hostId: event.hostId, hostName: nameOf(event.hostId), total });
  }
  for (const stats of Object.values(raterStats)) {
    stats.avg = round1(average(stats.perDinner.map((d) => d.total)));
  }

  return {
    board,
    perCategoryWinner,
    ratingsCount: ratings.length,
    feedbackByHost,
    raterStats,
  };
}
