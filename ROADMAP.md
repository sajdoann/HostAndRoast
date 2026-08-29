# Roadmap

The scaffold is a fully working, bilingual game backed by localStorage. Moving
to a shared backend is additive and isolated — grep for `TODO(...)`.

## ✅ Phase 0 — Playable prototype (done)

- Season creation, round-robin schedule, per-dinner QR/join codes.
- No-signup guest rating (name pick + 3 categories + comment).
- Duplicate-vote guards (per device + one per name per dinner).
- Sealed scores with the reveal condition (all dinners done + all ratings, or a
  deadline) and a per-host leaderboard.
- Pure domain logic in `src/domain`, persistence behind a `Store` interface.

## ✅ Phase 1 — Firebase wiring (done; needs your keys to switch on)

`firebase` is installed and `src/store/firestoreStore.ts` implements the same
`Store` interface as localStorage, using real-time `onSnapshot` listeners.
`src/store/index.ts` **auto-selects** it when Firebase is configured, else falls
back to localStorage — so the app always runs.

**To switch it on:** create a Firebase project, enable Firestore, then copy the
web config into `.env.local` (see `.env.example`). That's it — no code change.
Each browser has its own localStorage today; once Firebase is on, a host's QR
reaches real guests' phones.

**Data model** (mirrors `src/domain/types.ts`)

- `seasons/{id}` → `{ name, players[], events[], revealAt?, createdAt }`
- `seasons/{id}/ratings/{eventId_raterId}` → `{ eventId, raterId, scores, comment, createdAt }` — **read-never**
- `seasons/{id}/receipts/{eventId_raterId}` → `{ eventId, raterId, createdAt }` — public, no scores; drives progress + reveal
- `results/{seasonId}` → `{ board: HostResult[], publishedAt }` — written by the Function on reveal

Ratings + receipts are written together in one batch (deterministic id →
write-once). The client can count who rated and show the final board without
ever reading a raw score.

## Phase 2 — Security rules (keep scores sealed)  → `firestore.rules`

Already written. The important property: **ratings are `read: false`** for all
clients, and write-once via the deterministic id. Test with the emulator, then
`firebase deploy --only firestore:rules`. Tighten `seasons` writes once
organizer auth exists.

## Phase 3 — Reveal & leaderboard function  → `functions/`, `TODO(functions)`

Because clients can't read ratings, the leaderboard is computed server-side.

1. Reuse `src/domain/reveal.ts` + `scoring.ts` inside `functions/`.
2. Implement `publishResults` (scheduled sweep and/or `onWrite` on ratings):
   when `revealStatus(season, ratings).revealed`, compute the board and write
   `results/{seasonId}` as `{ board, publishedAt }`.
3. **Already wired:** `Results.tsx` reads `store.getResults(seasonId)`, which in
   Firestore mode returns that published doc (and shows a "tallying…" state
   until the Function writes it). Local mode computes it directly.

## Phase 4 — Optional extras

- **Organizer auth** (Firebase Auth) so only the creator edits a season.
- **Notifications** when results unlock (email / push via a Function).
- **QR invalidation** server-side once a dinner is complete (already reflected
  in the UI; enforce in rules/functions).
- **Stripe** (`src/lib/stripe.ts`) — only if you add a paid tier; otherwise delete it.
- Richer stats: per-category winners, comments digest, tie-breakers.

## Phase 5 — Deploy

```bash
npm run build
firebase deploy   # hosting + rules + functions
```

Local end-to-end with the emulator suite: `firebase emulators:start`.
