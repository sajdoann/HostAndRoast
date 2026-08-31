import type { DinnerEvent, Player } from "./types";
import { genCode, genId } from "./ids";

/** Add `days` to an ISO `YYYY-MM-DD` date, returning ISO. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Google Calendar-style recurrence: "repeat every {value} {unit}". */
export type RecurrenceUnit = "day" | "week" | "month";

export interface Recurrence {
  value: number;
  unit: RecurrenceUnit;
}

/**
 * Add `times` repetitions of `recurrence` to an ISO date, returning ISO.
 * Month arithmetic clamps into short months (e.g. Jan 31 + 1 month → Feb 28)
 * instead of overflowing into the next one.
 */
export function addRecurrence(isoDate: string, times: number, recurrence: Recurrence): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const n = times * Math.max(recurrence.value, 1);

  if (recurrence.unit === "day") {
    d.setDate(d.getDate() + n);
  } else if (recurrence.unit === "week") {
    d.setDate(d.getDate() + n * 7);
  } else {
    const day = d.getDate();
    d.setDate(1); // avoid rollover while stepping months
    d.setMonth(d.getMonth() + n);
    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDayOfMonth));
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Round-robin schedule: one host per dinner, in player order, starting on
 * `startDate` and repeating by `recurrence` (default: every 1 week) — like
 * Google Calendar's "starts on / repeats every" recurrence. Dates are
 * editable afterwards by the organizer, including clearing one to leave that
 * dinner unscheduled.
 */
export function buildSchedule(
  seasonId: string,
  players: Player[],
  startDate: string,
  recurrence: Recurrence = { value: 1, unit: "week" }
): DinnerEvent[] {
  return players.map((player, i) => ({
    id: genId(),
    seasonId,
    hostId: player.id,
    date: addRecurrence(startDate, i, recurrence),
    code: genCode(),
  }));
}

/**
 * Sort events by date, soonest first; events with no date yet (unscheduled)
 * always sort to the end.
 */
export function compareEventDates(a: DinnerEvent, b: DinnerEvent): number {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date);
}
