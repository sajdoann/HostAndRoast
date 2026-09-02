import { describe, expect, it } from "vitest";
import {
  applyRosterChange,
  hostIdsFor,
  householdsOf,
  hostNameOf,
  isHostHousehold,
  ratersFor,
  withHousehold,
  withoutPlayer,
} from "../src/domain/households";
import { buildSchedule } from "../src/domain/schedule";
import { expectedRatings, householdVotes, isEventComplete } from "../src/domain/reveal";
import { computeLeaderboard } from "../src/domain/scoring";
import type { DinnerEvent, Rating, Season } from "../src/domain/types";

/**
 * A household is one kitchen: it hosts one dinner and casts one vote, so a
 * couple can neither host twice, outvote a single guest, nor score itself.
 */
const players = [
  { id: "anna", name: "Anna" },
  { id: "petr", name: "Petr", householdId: "anna" }, // Anna & Petr cook together
  { id: "bara", name: "Bára" },
  { id: "cyril", name: "Cyril" },
];

function season(events: DinnerEvent[] = []): Season {
  return { id: "s", name: "S", ownerId: "o", players, events, createdAt: 0 };
}

const dinner = (id: string, hostId: string): DinnerEvent => ({
  id,
  seasonId: "s",
  hostId,
  code: "X",
  date: "2020-01-01",
});

const rate = (eventId: string, raterId: string, food: number): Rating => ({
  id: `${eventId}_${raterId}`,
  eventId,
  raterId,
  scores: { food },
  createdAt: 0,
});

describe("grouping", () => {
  it("puts partners in one household and everyone else in their own", () => {
    expect(householdsOf(season()).map((h) => h.name)).toEqual(["Anna & Petr", "Bára", "Cyril"]);
  });

  it("names a dinner after the whole kitchen", () => {
    expect(hostNameOf(season(), "anna")).toBe("Anna & Petr");
    expect(hostNameOf(season(), "bara")).toBe("Bára");
  });

  it("treats a season with no households as everyone cooking alone", () => {
    const solo = { ...season(), players: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
    expect(householdsOf(solo).map((h) => h.name)).toEqual(["A", "B"]);
  });
});

describe("hosting", () => {
  it("gives a couple one dinner, not two", () => {
    const events = buildSchedule("s", players, "2026-09-01", { value: 1, unit: "week" });
    expect(events).toHaveLength(3);
    expect(events.map((e) => hostNameOf(season(), e.hostId))).toEqual([
      "Anna & Petr",
      "Bára",
      "Cyril",
    ]);
    expect(events.map((e) => e.date)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("stops both partners from rating their own kitchen's dinner", () => {
    const s = season();
    expect(isHostHousehold(s, "anna", "anna")).toBe(true);
    expect(isHostHousehold(s, "anna", "petr")).toBe(true); // the bug this closes
    expect(isHostHousehold(s, "anna", "bara")).toBe(false);
  });

  it("offers a dinner only to guests outside the hosting kitchen", () => {
    expect(ratersFor(season(), "anna").map((p) => p.name)).toEqual(["Bára", "Cyril"]);
    expect(ratersFor(season(), "bara").map((p) => p.name)).toEqual(["Anna", "Petr", "Cyril"]);
  });
});

describe("votes", () => {
  const s = season([dinner("e1", "bara")]);

  it("expects one vote per kitchen, not per head", () => {
    expect(expectedRatings(s)).toBe(2); // Anna&Petr and Cyril — not 3 people
  });

  it("counts both partners as their household's single vote", () => {
    const both = [rate("e1", "anna", 8), rate("e1", "petr", 6)];
    expect(householdVotes(s.events[0], s, both)).toBe(1);
    expect(isEventComplete(s.events[0], s, both)).toBe(false); // Cyril still owes

    const all = [...both, rate("e1", "cyril", 4)];
    expect(householdVotes(s.events[0], s, all)).toBe(2);
    expect(isEventComplete(s.events[0], s, all)).toBe(true);
  });
});

describe("weighted scoring", () => {
  const s = season([dinner("e1", "bara")]);

  it("averages a couple's two scores into one vote", () => {
    // Anna 10 + Petr 6 average to 8, which then ties with Cyril's 4 → 6.
    const board = computeLeaderboard(s, [
      rate("e1", "anna", 10),
      rate("e1", "petr", 6),
      rate("e1", "cyril", 4),
    ]);
    const bara = board.find((r) => r.hostId === "bara")!;
    expect(bara.perCategory.food).toBe(6);
    expect(bara.ratingsCount).toBe(2); // two kitchens voted
  });

  it("stops a couple from outvoting a single guest", () => {
    const weighted = computeLeaderboard(s, [
      rate("e1", "anna", 10),
      rate("e1", "petr", 10),
      rate("e1", "cyril", 2),
    ]);
    // One vote each: (10 + 2) / 2 = 6. Counting heads would have given 7.3.
    expect(weighted.find((r) => r.hostId === "bara")!.perCategory.food).toBe(6);
  });

  it("gives a household its full vote when only one partner rates", () => {
    const board = computeLeaderboard(s, [rate("e1", "anna", 10), rate("e1", "cyril", 2)]);
    expect(board.find((r) => r.hostId === "bara")!.perCategory.food).toBe(6);
    expect(board.find((r) => r.hostId === "bara")!.ratingsCount).toBe(2);
  });

  it("ignores ratings from players who have left the season", () => {
    const board = computeLeaderboard(s, [
      rate("e1", "cyril", 4),
      rate("e1", "ghost", 10), // removed player's lingering vote
    ]);
    expect(board.find((r) => r.hostId === "bara")!.perCategory.food).toBe(4);
    expect(board.find((r) => r.hostId === "bara")!.ratingsCount).toBe(1);
  });

  it("scores solo seasons exactly as before", () => {
    const solo: Season = {
      ...season([dinner("e1", "a")]),
      players: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
    };
    const board = computeLeaderboard(solo, [rate("e1", "b", 8), rate("e1", "c", 4)]);
    expect(board.find((r) => r.hostId === "a")!.perCategory.food).toBe(6);
    expect(board.find((r) => r.hostId === "a")!.ratingsCount).toBe(2);
  });
});

describe("roster edits", () => {
  it("folds a dinner away when someone joins a kitchen", () => {
    const solo = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
    const change = withHousehold(solo, "b", "a");
    expect(change.players[1].householdId).toBe("a");
    expect(change.dropDinnerFor).toEqual(["b"]); // B's own dinner goes
    expect(householdsOf(change).map((h) => h.name)).toEqual(["A & B"]);
  });

  it("hands back a dinner when someone leaves a kitchen", () => {
    const change = withHousehold(season(), "petr", undefined);
    expect(change.players.find((p) => p.id === "petr")!.householdId).toBeUndefined();
    expect(change.addDinnerFor).toEqual(["petr"]);
    expect(householdsOf(change).map((h) => h.name)).toEqual(["Anna", "Petr", "Bára", "Cyril"]);
  });

  it("brings a whole kitchen along when its lead joins another", () => {
    const change = withHousehold(season(), "anna", "bara");
    expect(householdsOf(change).map((h) => h.name)).toEqual(["Anna & Petr & Bára", "Cyril"]);
    expect(change.dropDinnerFor).toEqual(["anna"]);
  });

  it("keeps a kitchen's dinner when only one of a couple leaves the season", () => {
    const change = withoutPlayer(season(), "petr");
    expect(change.dropDinnerFor).toEqual([]);
    expect(householdsOf(change).map((h) => h.name)).toEqual(["Anna", "Bára", "Cyril"]);
  });

  it("promotes the partner when the lead cook leaves the season", () => {
    const change = withoutPlayer(season(), "anna");
    expect(change.dropDinnerFor).toEqual([]);
    expect(change.rehost).toEqual({ anna: "petr" }); // Petr keeps the dinner
    expect(change.players.find((p) => p.id === "petr")!.householdId).toBeUndefined();
    expect(householdsOf(change).map((h) => h.name)).toEqual(["Petr", "Bára", "Cyril"]);
  });

  it("takes the dinner away when the last person in a kitchen leaves", () => {
    const change = withoutPlayer(season(), "bara");
    expect(change.dropDinnerFor).toEqual(["bara"]);
    expect(householdsOf(change).map((h) => h.name)).toEqual(["Anna & Petr", "Cyril"]);
  });
});

/**
 * `hostIds` is what the security rules read to decide whether the account
 * editing a dinner cooks it. If a roster edit leaves it stale, a partner's
 * perfectly legitimate save is rejected by the server — so it has to track
 * every pairing change, not just the ones that move a dinner.
 */
describe("hostIds stays in step with the kitchen", () => {
  it("lists both cooks once a couple pairs up", () => {
    const solo = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
    const change = withHousehold(solo, "b", "a");
    const events = applyRosterChange([dinner("e_a", "a"), dinner("e_b", "b")], change, "s");

    expect(events).toHaveLength(1); // B's dinner folded into A's kitchen
    expect(events[0].hostIds!.slice().sort()).toEqual(["a", "b"]);
  });

  it("drops the departed partner when a couple splits", () => {
    const change = withHousehold(season(), "petr", undefined);
    const events = applyRosterChange([dinner("e_anna", "anna")], change, "s");

    const annas = events.find((e) => e.hostId === "anna")!;
    expect(annas.hostIds).toEqual(["anna"]); // Petr can no longer edit it
    const petrs = events.find((e) => e.hostId === "petr")!;
    expect(petrs.hostIds).toEqual(["petr"]); // and gets his own back
  });

  it("follows the dinner when the lead cook leaves the season", () => {
    const change = withoutPlayer(season(), "anna");
    const events = applyRosterChange([dinner("e_anna", "anna")], change, "s");

    expect(events[0].hostId).toBe("petr");
    expect(events[0].hostIds).toEqual(["petr"]); // Anna is gone, Petr cooks alone
  });

  it("agrees with the schedule builder for a brand-new season", () => {
    const built = buildSchedule("s", season().players, "2026-01-01", { value: 1, unit: "week" });
    for (const e of built) {
      expect(e.hostIds!.slice().sort()).toEqual(hostIdsFor(season(), e.hostId).slice().sort());
    }
  });
});
