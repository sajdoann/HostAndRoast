import type { Category, Season } from "./types";

/**
 * Fixed set used only for seasons created before rating categories became
 * owner-editable — keeps them working exactly as before, unchanged.
 */
export const LEGACY_CATEGORY_IDS = ["food", "atmosphere", "entertainment"] as const;

/** New seasons start rating on just food; the owner can add more. */
export const DEFAULT_CATEGORY_IDS = ["food"] as const;

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export function isValidScore(n: number): boolean {
  return Number.isInteger(n) && n >= SCORE_MIN && n <= SCORE_MAX;
}

export function isValidScoreSet(scores: Record<string, number>, categoryIds: string[]): boolean {
  return categoryIds.every((id) => isValidScore(scores[id]));
}

/** The category ids a season rates on. */
export function categoryIdsFor(season: Pick<Season, "categories">): string[] {
  return season.categories?.length
    ? season.categories.map((c) => c.id)
    : [...LEGACY_CATEGORY_IDS];
}

/**
 * Display list (id + label) for UI. A season without its own categories
 * (created before this existed) falls back to the legacy three, translated
 * via `translateLegacyLabel` (e.g. `id => t(\`categories.${id}\`)`).
 */
export function categoriesFor(
  season: Pick<Season, "categories">,
  translateLegacyLabel: (id: string) => string
): Category[] {
  if (season.categories?.length) return season.categories;
  return LEGACY_CATEGORY_IDS.map((id) => ({ id, label: translateLegacyLabel(id) }));
}
