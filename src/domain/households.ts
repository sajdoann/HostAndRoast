import type { DinnerEvent, Player, Season } from "./types";
import { genCode, genId } from "./ids";

/**
 * A household is one kitchen: the people who cook together. It hosts one
 * dinner and casts one vote on everyone else's, however many people are in it
 * — two partners who ate the same meal at the same table aren't two
 * independent opinions, so their scores average into a single vote.
 *
 * A player with no `householdId` is a household of one, keyed by their own id,
 * which is why seasons created before this existed behave exactly as before.
 */
export interface Household {
  /** The lead member's player id — a solo player's own id. */
  id: string;
  playerIds: string[];
  /** "Anna & Petr", or just "Anna" for someone cooking alone. */
  name: string;
}

/** The household a player belongs to: theirs, unless they cook with someone. */
export function householdIdOf(player: Player): string {
  return player.householdId ?? player.id;
}

/** The season's households, in player order. */
export function householdsOf(season: Pick<Season, "players">): Household[] {
  const members = new Map<string, Player[]>();
  for (const player of season.players) {
    const id = householdIdOf(player);
    const existing = members.get(id);
    if (existing) existing.push(player);
    else members.set(id, [player]);
  }
  return [...members].map(([id, group]) => ({
    id,
    playerIds: group.map((p) => p.id),
    name: group.map((p) => p.name).join(" & "),
  }));
}

/** How many kitchens are playing — the number of dinners and of votes each. */
export function householdCount(season: Pick<Season, "players">): number {
  return householdsOf(season).length;
}

/** The household a given player cooks in, if they're still in the season. */
export function householdOf(
  season: Pick<Season, "players">,
  playerId: string | undefined
): Household | undefined {
  if (!playerId) return undefined;
  const player = season.players.find((p) => p.id === playerId);
  if (!player) return undefined;
  const wanted = householdIdOf(player);
  return householdsOf(season).find((h) => h.id === wanted);
}

/** Everyone who shares a kitchen with this player, themselves included. */
export function householdMates(
  season: Pick<Season, "players">,
  playerId: string | undefined
): string[] {
  return householdOf(season, playerId)?.playerIds ?? [];
}

/** The name to show for a dinner: the whole kitchen, not just one cook. */
export function hostNameOf(
  season: Pick<Season, "players">,
  hostId: string,
  fallback = "—"
): string {
  return householdOf(season, hostId)?.name ?? fallback;
}

/** True when this player cooks in the household hosting that dinner. */
export function isHostHousehold(
  season: Pick<Season, "players">,
  hostId: string,
  playerId: string | undefined
): boolean {
  if (!playerId) return false;
  return householdMates(season, hostId).includes(playerId);
}

/** Players who may rate a dinner: everyone outside the hosting kitchen. */
export function ratersFor(season: Pick<Season, "players">, hostId: string): Player[] {
  const hosts = new Set(householdMates(season, hostId));
  return season.players.filter((p) => !hosts.has(p.id));
}

/**
 * How a roster edit lands: the new player list, plus what it means for the
 * schedule, since a dinner belongs to a kitchen rather than to one person.
 * Both stores apply this so the two backends can't drift apart.
 */
export interface RosterChange {
  players: Player[];
  /** Host ids whose dinner should go — that kitchen no longer exists. */
  dropDinnerFor: string[];
  /** Player ids who now need a dinner of their own, unscheduled. */
  addDinnerFor: string[];
  /** Old host id → the member taking over, when a dinner outlives its host. */
  rehost: Record<string, string>;
}

const noChange = (players: Player[]): RosterChange => ({
  players,
  dropDinnerFor: [],
  addDinnerFor: [],
  rehost: {},
});

/**
 * Move a player into `householdId`'s kitchen, or out into their own when it's
 * undefined. Joining folds their dinner into the household's; leaving hands
 * them a fresh, undated one.
 */
export function withHousehold(
  season: Pick<Season, "players">,
  playerId: string,
  householdId: string | undefined
): RosterChange {
  const player = season.players.find((p) => p.id === playerId);
  if (!player || householdId === playerId) return noChange(season.players);
  const wasIn = householdIdOf(player);
  if (wasIn === (householdId ?? playerId)) return noChange(season.players);

  if (!householdId) {
    // Cooking alone again: they lead their own kitchen and need a dinner.
    const leaving = season.players.map((p) =>
      p.id === playerId ? { ...p, householdId: undefined } : p
    );
    // If they led the old household, hand it to whoever is left.
    const mates = leaving.filter((p) => p.id !== playerId && householdIdOf(p) === wasIn);
    if (wasIn === playerId && mates.length > 0) {
      const leader = mates[0];
      return {
        players: leaving.map((p) =>
          p.id === playerId
            ? p
            : householdIdOf(p) === wasIn
              ? { ...p, householdId: p.id === leader.id ? undefined : leader.id }
              : p
        ),
        dropDinnerFor: [],
        addDinnerFor: [playerId],
        rehost: { [wasIn]: leader.id },
      };
    }
    return { players: leaving, dropDinnerFor: [], addDinnerFor: [playerId], rehost: {} };
  }

  // Joining a kitchen: anyone who cooked with this player comes along.
  const players = season.players.map((p) =>
    p.id === playerId || p.householdId === playerId ? { ...p, householdId } : p
  );
  return { players, dropDinnerFor: [wasIn], addDinnerFor: [], rehost: {} };
}

/**
 * Drop a player. Their kitchen's dinner only goes with them if they were the
 * last one in it; otherwise it carries on under whoever remains.
 */
export function withoutPlayer(
  season: Pick<Season, "players">,
  playerId: string
): RosterChange {
  const player = season.players.find((p) => p.id === playerId);
  if (!player) return noChange(season.players);

  const household = householdIdOf(player);
  const remaining = season.players.filter((p) => p.id !== playerId);
  const mates = remaining.filter((p) => householdIdOf(p) === household);

  if (mates.length === 0) {
    return { players: remaining, dropDinnerFor: [household], addDinnerFor: [], rehost: {} };
  }
  if (household !== playerId) {
    return noChange(remaining); // a mate left; the kitchen and its dinner stand
  }
  // The lead cook left a kitchen that still has people in it — promote one.
  const leader = mates[0];
  return {
    players: remaining.map((p) =>
      householdIdOf(p) === household
        ? { ...p, householdId: p.id === leader.id ? undefined : leader.id }
        : p
    ),
    dropDinnerFor: [],
    addDinnerFor: [],
    rehost: { [household]: leader.id },
  };
}

/**
 * Apply a roster change to the schedule: drop the dinners of kitchens that no
 * longer exist, hand a dinner to whoever took over hosting, and give anyone
 * newly cooking alone an undated dinner of their own.
 */
export function applyRosterChange(
  events: DinnerEvent[],
  change: RosterChange,
  seasonId: string
): DinnerEvent[] {
  const kept = events
    .filter((e) => !change.dropDinnerFor.includes(e.hostId))
    .map((e) => (change.rehost[e.hostId] ? { ...e, hostId: change.rehost[e.hostId] } : e));

  const added = change.addDinnerFor.map((hostId) => ({
    id: genId(),
    seasonId,
    hostId,
    code: genCode(),
  }));

  return [...kept, ...added];
}
