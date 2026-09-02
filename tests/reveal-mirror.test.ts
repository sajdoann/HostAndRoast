import { describe, expect, it } from "vitest";
import { computeStats } from "../api/reveal";
import { computeSeasonStats } from "../src/domain/scoring";
import type { Rating, Season } from "../src/domain/types";

/**
 * api/reveal.ts is deliberately self-contained (Vercel bundles it alone), so
 * its scoring is a hand-kept copy of src/domain/scoring.ts. This is the thing
 * that stops the two drifting: Firestore seasons are scored by the server,
 * local ones by the domain, and they must agree.
 */
const season: Season = {
  id: "s",
  name: "S",
  ownerId: "o",
  players: [
    { id: "anna", name: "Anna" },
    { id: "petr", name: "Petr", householdId: "anna" },
    { id: "bara", name: "Bára" },
    { id: "cyril", name: "Cyril" },
  ],
  events: [
    { id: "e1", seasonId: "s", hostId: "bara", code: "A", date: "2026-01-01" },
    { id: "e2", seasonId: "s", hostId: "anna", code: "B", date: "2026-01-08" },
  ],
  categories: [
    { id: "food", label: "Food" },
    { id: "vibe", label: "Vibe" },
  ],
  createdAt: 0,
};

const ratings: Rating[] = [
  { id: "1", eventId: "e1", raterId: "anna", scores: { food: 10, vibe: 8 }, createdAt: 0 },
  { id: "2", eventId: "e1", raterId: "petr", scores: { food: 6, vibe: 4 }, createdAt: 0 },
  { id: "3", eventId: "e1", raterId: "cyril", scores: { food: 2, vibe: 6 }, comment: "ok", createdAt: 0 },
  { id: "4", eventId: "e2", raterId: "bara", scores: { food: 7, vibe: 7 }, createdAt: 0 },
  { id: "5", eventId: "e2", raterId: "ghost", scores: { food: 1, vibe: 1 }, createdAt: 0 },
];

describe("reveal server mirrors the domain", () => {
  it("produces the same leaderboard, winners and feedback", () => {
    const mine = computeSeasonStats(season, ratings);
    const theirs = computeStats(season as never, ratings as never);

    expect(theirs.board).toEqual(mine.board);
    expect(theirs.perCategoryWinner).toEqual(mine.perCategoryWinner);
    expect(theirs.feedbackByHost).toEqual(mine.feedbackByHost);
    expect(theirs.raterStats).toEqual(mine.raterStats);
  });

  it("weights the couple as one kitchen on both sides", () => {
    const board = computeStats(season as never, ratings as never).board;
    const bara = board.find((r) => r.hostId === "bara")!;
    // Anna 10 + Petr 6 -> 8, averaged with Cyril's 2 -> 5. Per head it'd be 6.
    expect(bara.perCategory.food).toBe(5);
    expect(bara.hostName).toBe("Bára");
    expect(board.find((r) => r.hostId === "anna")!.hostName).toBe("Anna & Petr");
  });
});
