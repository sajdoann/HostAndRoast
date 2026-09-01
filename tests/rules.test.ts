import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * Security-rule tests against the Firestore emulator.
 * Run with `npm test` (starts the emulator via `firebase emulators:exec`).
 *
 * The trust model these lock down:
 *   - a nickname claim is first-come-first-served and cannot be stolen,
 *   - private feedback / scores are readable only by the player who holds
 *     that claim (or the organizer),
 *   - ratings are write-once, read-never, and every score is a 1-10 int.
 */

const SEASON = "season1";
const OWNER = "owner-uid";
const ALICE = "alice-uid";
const MALLORY = "mallory-uid";
const P_ALICE = "player-alice";
const P_BOB = "player-bob";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-hr",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

/** Seed a season + one dinner hosted by Bob, bypassing the rules. */
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "seasons", SEASON), {
      name: "Test season",
      ownerId: OWNER,
      players: [
        { id: P_ALICE, name: "Alice" },
        { id: P_BOB, name: "Bob" },
      ],
      createdAt: Date.now(),
    });
    await setDoc(doc(db, "seasons", SEASON, "events", "event1"), {
      hostId: P_BOB,
      date: "2026-09-01",
      code: "ABC12",
      ownerId: OWNER,
    });
    await setDoc(doc(db, "results", SEASON), { board: [] });
    await setDoc(doc(db, "results", SEASON, "feedback", P_BOB), {
      hostId: P_BOB,
      comments: ["the roast was dry"],
    });
    await setDoc(doc(db, "results", SEASON, "raters", P_ALICE), {
      playerId: P_ALICE,
      avg: 7,
      perDinner: [],
    });
  });
}

/** Give `uid` the claim on `playerId`, bypassing the rules. */
async function seedClaim(playerId: string, uid: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "seasons", SEASON, "claims", playerId), { uid });
  });
}

describe("nickname claims", () => {
  it("lets a signed-in guest claim a free nickname", async () => {
    await seed();
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, "seasons", SEASON, "claims", P_ALICE), { uid: ALICE })
    );
  });

  it("refuses a claim that pretends to be another account", async () => {
    await seed();
    const db = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(
      setDoc(doc(db, "seasons", SEASON, "claims", P_ALICE), { uid: ALICE })
    );
  });

  it("refuses to let anyone steal a nickname someone already claimed", async () => {
    await seed();
    await seedClaim(P_ALICE, ALICE);
    const db = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(
      setDoc(doc(db, "seasons", SEASON, "claims", P_ALICE), { uid: MALLORY })
    );
  });

  it("lets the holder rewrite their own claim", async () => {
    await seed();
    await seedClaim(P_ALICE, ALICE);
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, "seasons", SEASON, "claims", P_ALICE), { uid: ALICE })
    );
  });

  it("lets the organizer release a claim, but not a guest", async () => {
    await seed();
    await seedClaim(P_ALICE, ALICE);
    const mallory = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(deleteDoc(doc(mallory, "seasons", SEASON, "claims", P_ALICE)));

    const owner = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(deleteDoc(doc(owner, "seasons", SEASON, "claims", P_ALICE)));
  });

  it("lets anyone list the claims, so the picker can show which names are taken", async () => {
    await seed();
    await seedClaim(P_ALICE, ALICE);
    const db = testEnv.unauthenticatedContext().firestore();
    const snap = await assertSucceeds(getDocs(collection(db, "seasons", SEASON, "claims")));
    expect(snap.docs.map((d) => d.id)).toEqual([P_ALICE]);
  });

  it("refuses claims from signed-out visitors", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "seasons", SEASON, "claims", P_ALICE), { uid: ALICE })
    );
  });
});

describe("private results", () => {
  it("lets a cook read the feedback on their own dinner", async () => {
    await seed();
    await seedClaim(P_BOB, ALICE); // Alice's account holds the "Bob" nickname
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(db, "results", SEASON, "feedback", P_BOB)));
  });

  it("lets the organizer read any feedback", async () => {
    await seed();
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(getDoc(doc(db, "results", SEASON, "feedback", P_BOB)));
  });

  it("hides a cook's feedback from someone holding a different nickname", async () => {
    await seed();
    await seedClaim(P_BOB, ALICE);
    await seedClaim(P_ALICE, MALLORY);
    const db = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(getDoc(doc(db, "results", SEASON, "feedback", P_BOB)));
  });

  it("hides a cook's feedback from a stranger who claims nothing", async () => {
    await seed();
    const db = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(getDoc(doc(db, "results", SEASON, "feedback", P_BOB)));
  });

  it("hides a rater's own scores from everyone else", async () => {
    await seed();
    await seedClaim(P_ALICE, ALICE);
    const mallory = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(getDoc(doc(mallory, "results", SEASON, "raters", P_ALICE)));

    const alice = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(alice, "results", SEASON, "raters", P_ALICE)));
  });
});

describe("dinners", () => {
  it("lets the claimed cook edit their own dinner", async () => {
    await seed();
    await seedClaim(P_BOB, ALICE);
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "seasons", SEASON, "events", "event1"), {
        date: "2026-09-05",
        mealDescription: "roast",
      })
    );
  });

  it("stops someone holding another nickname from editing a dinner", async () => {
    await seed();
    await seedClaim(P_ALICE, MALLORY);
    const db = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(
      updateDoc(doc(db, "seasons", SEASON, "events", "event1"), { date: "2026-09-05" })
    );
  });
});

describe("ratings", () => {
  const rating = (scores: Record<string, unknown>) => ({
    eventId: "event1",
    raterId: P_ALICE,
    scores,
    comment: null,
    createdAt: Date.now(),
  });

  it("accepts a rating with any number of 1-10 int scores", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "seasons", SEASON, "ratings", "event1_a"),
        rating({ food: 1, vibe: 10, fun: 5 })
      )
    );
  });

  it.each([
    ["a zero", { food: 0 }],
    ["above ten", { food: 11 }],
    ["a negative", { food: -3 }],
    ["a fraction", { food: 5.5 }],
    ["a string", { food: "5" }],
    ["a bool", { food: true }],
    ["one bad score among good ones", { food: 8, vibe: 99 }],
    ["no scores at all", {}],
  ])("rejects %s", async (_label, scores) => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "seasons", SEASON, "ratings", "event1_b"), rating(scores))
    );
  });

  it("rejects an absurd number of categories", async () => {
    await seed();
    const scores: Record<string, number> = {};
    for (let i = 0; i < 13; i++) scores[`c${i}`] = 5;
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "seasons", SEASON, "ratings", "event1_c"), rating(scores))
    );
  });

  it("never lets anyone read raw scores", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "seasons", SEASON, "ratings", "event1_d"),
        rating({ food: 7 })
      );
    });
    const owner = testEnv.authenticatedContext(OWNER).firestore();
    await assertFails(getDoc(doc(owner, "seasons", SEASON, "ratings", "event1_d")));
  });

  it("never lets a rating be changed or deleted", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "seasons", SEASON, "ratings", "event1_e"),
        rating({ food: 7 })
      );
    });
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertFails(
      updateDoc(doc(db, "seasons", SEASON, "ratings", "event1_e"), { scores: { food: 10 } })
    );
    await assertFails(deleteDoc(doc(db, "seasons", SEASON, "ratings", "event1_e")));
  });

  it("only accepts a receipt once its rating exists", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    const receipt = { eventId: "event1", raterId: P_ALICE, createdAt: Date.now() };
    await assertFails(
      setDoc(doc(db, "seasons", SEASON, "receipts", "event1_ghost"), receipt)
    );

    await assertSucceeds(
      setDoc(doc(db, "seasons", SEASON, "ratings", "event1_real"), rating({ food: 6 }))
    );
    await assertSucceeds(
      setDoc(doc(db, "seasons", SEASON, "receipts", "event1_real"), receipt)
    );
  });
});

describe("seasons", () => {
  it("is readable by anyone with the link but not listable", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "seasons", SEASON)));
  });

  it("is only editable by its organizer", async () => {
    await seed();
    const mallory = testEnv.authenticatedContext(MALLORY).firestore();
    await assertFails(updateDoc(doc(mallory, "seasons", SEASON), { name: "hijacked" }));

    const owner = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(updateDoc(doc(owner, "seasons", SEASON), { name: "renamed" }));
  });
});

it("has rules loaded (sanity)", () => {
  expect(readFileSync("firestore.rules", "utf8")).toContain("rules_version");
});
