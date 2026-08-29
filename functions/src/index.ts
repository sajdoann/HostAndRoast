/**
 * Cloud Functions for Host & Roast — placeholder.
 *
 * Because raw ratings are never client-readable (see firestore.rules), the
 * leaderboard is computed server-side and published only once the season's
 * reveal condition is met. Reuse the pure logic from the web app's
 * src/domain/{reveal,scoring}.ts here — it has no browser dependencies.
 *
 *   publishResults  — callable/scheduled: if revealStatus(...).revealed, compute
 *                     the leaderboard and write /results/{seasonId} as
 *                     { board: HostResult[], publishedAt } — the exact shape
 *                     the web app's Firestore store reads back (see
 *                     src/store/firestoreStore.ts).
 *
 * Reveal counting can use the public /receipts (no scores); the board itself
 * is computed from /ratings, which only admin (this Function) can read.
 *
 * TODO(functions):
 *   1. Share the domain logic (copy src/domain or extract a small package).
 *   2. Implement publishResults (a scheduled sweep and/or an onWrite trigger
 *      on ratings that checks the reveal condition).
 *   3. Optional: notify the organizer when results unlock; clean up
 *      subcollections when a season is deleted.
 */

import * as admin from "firebase-admin";

admin.initializeApp();

// import { onSchedule } from "firebase-functions/v2/scheduler";
// import { revealStatus } from "./domain/reveal";
// import { computeLeaderboard } from "./domain/scoring";
//
// export const publishResults = onSchedule("every 6 hours", async () => {
//   const db = admin.firestore();
//   const seasons = await db.collection("seasons").get();
//   for (const doc of seasons.docs) {
//     // load ratings, check revealStatus, and write /results/{id} when revealed.
//   }
// });

export {};
