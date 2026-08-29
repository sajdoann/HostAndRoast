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

## Phase 1 — Firebase (make it multi-device)  → `store/`, `TODO(firebase)`

Right now each browser has its own localStorage. To let a host's QR reach real
guests' phones, data must be shared.

1. `npm install firebase`; fill `.env.local` from `.env.example`; uncomment
   `src/lib/firebase.ts`.
2. Write `src/store/firestoreStore.ts` implementing `Store` against Firestore:
   - `seasons/{id}` — season doc (players, events, revealAt).
   - `seasons/{id}/ratings/{eventId_raterId}` — one doc per submission.
3. Point `src/store/index.ts` at it. **Nothing else changes** — pages use hooks,
   hooks use the store.

**Data model** (mirrors `src/domain/types.ts`)

- `seasons/{id}` → `{ name, players[], events[], revealAt, createdAt }`
- `seasons/{id}/ratings/{eventId_raterId}` → `{ eventId, raterId, scores, comment, createdAt }`

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
   `results/{seasonId}` (the one doc clients may read).
3. Point `Results.tsx` at `results/{seasonId}` instead of computing locally.

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
