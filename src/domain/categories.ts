import type { CategoryId } from "./types";

/** Rating categories, in display order. Labels live in i18n (`categories.*`). */
export const CATEGORIES: readonly CategoryId[] = [
  "food",
  "atmosphere",
  "entertainment",
] as const;

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export function isValidScore(n: number): boolean {
  return Number.isInteger(n) && n >= SCORE_MIN && n <= SCORE_MAX;
}

export function isValidScoreSet(scores: Record<CategoryId, number>): boolean {
  return CATEGORIES.every((c) => isValidScore(scores[c]));
}
