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

/**
 * Round-robin schedule: one host per day, in player order, spaced `intervalDays`
 * apart starting from `startDate`. Dates are editable afterwards by the organizer.
 */
export function buildSchedule(
  seasonId: string,
  players: Player[],
  startDate: string,
  intervalDays = 7
): DinnerEvent[] {
  return players.map((player, i) => ({
    id: genId(),
    seasonId,
    hostId: player.id,
    date: addDays(startDate, i * intervalDays),
    code: genCode(),
  }));
}
