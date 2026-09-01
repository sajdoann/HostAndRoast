import { afterAll, describe, expect, it } from "vitest";
import { addDays, addRecurrence, buildSchedule, compareEventDates, todayISO } from "../src/domain/schedule";
import { revealStatus } from "../src/domain/reveal";
import type { DinnerEvent, Player, Season } from "../src/domain/types";

/**
 * These dates are calendar days, not instants: "Sept 1" must stay Sept 1 for
 * everyone. The regression this guards is formatting via `toISOString()`,
 * which converts to UTC first and lands on the previous day at any positive
 * offset — a season started on Sept 1 in Prague came out starting Aug 31.
 */
const ZONES = ["UTC", "Europe/Prague", "Asia/Tokyo", "America/New_York", "Pacific/Kiritimati"];
const originalTZ = process.env.TZ;

afterAll(() => {
  process.env.TZ = originalTZ;
});

function inZone<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = originalTZ;
  }
}

describe.each(ZONES)("date maths in %s", (tz) => {
  it("keeps the date you picked as the first dinner", () => {
    expect(inZone(tz, () => addRecurrence("2026-09-01", 0, { value: 1, unit: "week" }))).toBe(
      "2026-09-01"
    );
  });

  it("steps whole weeks onto the same weekday", () => {
    const dates = inZone(tz, () =>
      [0, 1, 2].map((i) => addRecurrence("2026-09-01", i, { value: 1, unit: "week" }))
    );
    expect(dates).toEqual(["2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("steps months by calendar month", () => {
    const dates = inZone(tz, () =>
      [0, 1, 2].map((i) => addRecurrence("2026-09-01", i, { value: 2, unit: "month" }))
    );
    expect(dates).toEqual(["2026-09-01", "2026-11-01", "2027-01-01"]);
  });

  it("clamps into short months instead of overflowing", () => {
    expect(inZone(tz, () => addRecurrence("2026-01-31", 1, { value: 1, unit: "month" }))).toBe(
      "2026-02-28"
    );
  });

  it("adds days across a month boundary", () => {
    expect(inZone(tz, () => addDays("2026-08-30", 3))).toBe("2026-09-02");
  });

  it("reports today as the local calendar day", () => {
    const [iso, local] = inZone(tz, () => [
      todayISO(),
      new Date().toLocaleDateString("sv-SE"), // sv-SE renders as YYYY-MM-DD
    ]);
    expect(iso).toBe(local);
  });

  it("builds a schedule starting on the chosen date", () => {
    const players: Player[] = [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ];
    const events = inZone(tz, () =>
      buildSchedule("s1", players, "2026-09-01", { value: 1, unit: "week" })
    );
    expect(events.map((e) => e.date)).toEqual(["2026-09-01", "2026-09-08"]);
  });
});

describe("schedule ordering", () => {
  const ev = (date?: string): DinnerEvent =>
    ({ id: date ?? "none", seasonId: "s", hostId: "h", code: "X", date }) as DinnerEvent;

  it("sorts by date and pushes undated dinners to the end", () => {
    const sorted = [ev(), ev("2026-09-08"), ev("2026-09-01"), ev()].sort(compareEventDates);
    expect(sorted.map((e) => e.date)).toEqual([
      "2026-09-01",
      "2026-09-08",
      undefined,
      undefined,
    ]);
  });
});

describe("reveal status", () => {
  const season = (events: DinnerEvent[]): Season => ({
    id: "s",
    name: "S",
    ownerId: "o",
    players: [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ],
    events,
    createdAt: 0,
  });
  const ev = (id: string, date?: string): DinnerEvent =>
    ({ id, seasonId: "s", hostId: "p1", code: "X", date }) as DinnerEvent;

  it("counts dinners with no date so the organizer can be told", () => {
    const status = revealStatus(season([ev("a", "2020-01-01"), ev("b"), ev("c")]), []);
    expect(status.unscheduled).toBe(2);
    expect(status.allDatesPassed).toBe(false);
    expect(status.revealed).toBe(false);
  });

  it("has nothing to flag once every dinner has a date", () => {
    const status = revealStatus(season([ev("a", "2020-01-01")]), []);
    expect(status.unscheduled).toBe(0);
    expect(status.allDatesPassed).toBe(true);
  });
});
