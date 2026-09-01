import type { Rating, Season } from "./types";
import { categoryIdsFor, SCORE_MAX } from "./categories";
import { ratingsForEvent } from "./reveal";

export interface HostResult {
  hostId: string;
  hostName: string;
  perCategory: Record<string, number>; // average per category
  total: number; // sum of the category averages
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
 * Leaderboard: for each host, average each of the season's categories across
 * their dinner's ratings, then total those averages. Sorted high → low.
 * A rating missing a category (rated before it was added) is simply skipped
 * for that category's average, not counted as a zero.
 * Pure and side-effect free — the future Cloud Function can reuse it verbatim.
 */
export function computeLeaderboard(season: Season, ratings: Rating[]): HostResult[] {
  const categoryIds = categoryIdsFor(season);

  const results = season.events.map((event): HostResult => {
    const host = season.players.find((p) => p.id === event.hostId);
    const eventRatings = ratingsForEvent(event, ratings);

    const perCategory = {} as Record<string, number>;
    for (const cat of categoryIds) {
      const values = eventRatings
        .map((r) => r.scores[cat])
        .filter((v): v is number => typeof v === "number");
      perCategory[cat] = round1(average(values));
    }
    const total = round1(categoryIds.reduce((sum, cat) => sum + perCategory[cat], 0));

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

/** Max possible total for a season: SCORE_MAX per category it rates on. */
export function maxTotalFor(season: Season): number {
  return categoryIdsFor(season).length * SCORE_MAX;
}

/** One rater's own view: what they gave each dinner, and their average. */
export interface RaterStats {
  playerId: string;
  avg: number; // average total they handed out
  perDinner: { hostId: string; hostName: string; total: number }[];
}

/** The full reveal payload — leaderboard plus everything the results page shows. */
export interface SeasonStats {
  board: HostResult[];
  perCategoryWinner: Record<string, { hostId: string; hostName: string; avg: number } | null>;
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
  const categoryIds = categoryIdsFor(season);
  const board = computeLeaderboard(season, ratings);
  const nameOf = (id: string) => season.players.find((p) => p.id === id)?.name ?? "—";

  const perCategoryWinner = {} as SeasonStats["perCategoryWinner"];
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

  const raterStats: Record<string, RaterStats> = {};
  for (const rating of ratings) {
    const event = season.events.find((e) => e.id === rating.eventId);
    if (!event) continue;
    const total = round1(categoryIds.reduce((s, c) => s + (rating.scores[c] ?? 0), 0));
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
