import type { Rating, Season } from "./types";
import { categoryIdsFor, SCORE_MAX } from "./categories";
import { householdIdOf, hostNameOf } from "./households";
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

/** A rating and the share of its household's single vote that it carries. */
interface WeightedRating {
  rating: Rating;
  weight: number;
}

/**
 * Split each household's one vote between whoever in it actually rated: two
 * partners who both rated carry half each, and one who rates alone carries
 * the household's full vote rather than half of it. Ratings from people no
 * longer in the season are dropped.
 */
function weightedRatings(season: Season, eventRatings: Rating[]): WeightedRating[] {
  const byHousehold = new Map<string, Rating[]>();
  for (const rating of eventRatings) {
    const player = season.players.find((p) => p.id === rating.raterId);
    if (!player) continue; // a player who has since left the season
    const id = householdIdOf(player);
    const existing = byHousehold.get(id);
    if (existing) existing.push(rating);
    else byHousehold.set(id, [rating]);
  }

  const weighted: WeightedRating[] = [];
  for (const group of byHousehold.values()) {
    for (const rating of group) weighted.push({ rating, weight: 1 / group.length });
  }
  return weighted;
}

/** Weighted mean of one category, over the ratings that actually scored it. */
function weightedAverage(weighted: WeightedRating[], categoryId: string): number {
  let total = 0;
  let weight = 0;
  for (const { rating, weight: w } of weighted) {
    const score = rating.scores[categoryId];
    if (typeof score !== "number") continue; // rated before this category existed
    total += score * w;
    weight += w;
  }
  return weight === 0 ? 0 : total / weight;
}

/**
 * Leaderboard: for each dinner, average each of the season's categories across
 * the votes it received, then total those averages. Sorted high → low.
 *
 * Every household gets one vote, split between whichever of its members rated,
 * so a couple can't outvote a single guest. A rating missing a category (rated
 * before it was added) is skipped for that category, not counted as a zero.
 * Pure and side-effect free — the reveal server reuses this shape verbatim.
 */
export function computeLeaderboard(season: Season, ratings: Rating[]): HostResult[] {
  const categoryIds = categoryIdsFor(season);

  const results = season.events.map((event): HostResult => {
    const weighted = weightedRatings(season, ratingsForEvent(event, ratings));

    const perCategory = {} as Record<string, number>;
    for (const cat of categoryIds) {
      perCategory[cat] = round1(weightedAverage(weighted, cat));
    }
    const total = round1(categoryIds.reduce((sum, cat) => sum + perCategory[cat], 0));

    return {
      hostId: event.hostId,
      hostName: hostNameOf(season, event.hostId),
      perCategory,
      total,
      // Votes, not ratings: each household's weights sum to exactly 1, so the
      // total weight is the number of kitchens that voted.
      ratingsCount: Math.round(weighted.reduce((sum, w) => sum + w.weight, 0)),
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
  // Dinners belong to a kitchen, so they're labelled with the household name.
  const nameOf = (hostId: string) => hostNameOf(season, hostId);

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
