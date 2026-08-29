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
