# Roadmap

The app is live on Firebase (Firestore + Google auth) with a full role model.
This file tracks what's done and the highest-value work left, roughly in
priority order.

## ✅ Done

- **Game core** — round-robin seasons, per-dinner QR/join codes, no-signup guest
  rating (3 categories + comment), sealed scores, reveal condition, per-host
  leaderboard. Pure logic in `src/domain`.
- **Firebase** — Firestore implementation of the `Store` seam with real-time
  listeners; auto-selected when configured, localStorage otherwise.
- **Accounts & roles** — Google sign-in; organizer owns a season; a **cook**
  claims a nickname and edits their own dinner (menu + time); guests stay
  signup-free; identity auto-fills when a signed-in person rates.
- **Access model** — schedule/QRs readable by anyone with the link; `list` and
  edits locked down in `firestore.rules`; scores are **read-never**.
- **Participation** — signed-in people see the seasons they own *or* joined.
- **Deployed** — Vercel (web) + Firebase (data/auth); bilingual EN/CS; account
  menu; brand logos.

## ⭐ Highest-value upgrades

### 1. `publishResults` Cloud Function  → `functions/`, `TODO(functions)`
**The biggest gap.** Because clients can't read raw scores, the leaderboard must
be computed server-side. Until this exists, a revealed season shows a
"tallying…" state in Firebase mode and never displays results.
1. Reuse `src/domain/reveal.ts` + `scoring.ts` inside `functions/`.
2. Implement `publishResults` (scheduled sweep and/or `onWrite` on ratings):
   when `revealStatus(...).revealed`, compute the board and write
   `results/{seasonId}` as `{ board, publishedAt }`.
3. Already wired: `Results.tsx` reads `store.getResults(seasonId)`.

### 2. Trustworthy rating flow  (correctness + integrity)
- The "thanks" screen shows even if the rating write fails — confirm only after
  the write resolves, and surface errors.
- **Receipt integrity:** `receipts` are currently open (`create: if true`), so
  progress and the reveal trigger could be faked. Write receipts server-side
  from the rating (a Function), or validate them, so "everyone rated" can't be
  spoofed.

### 3. Season management for the organizer
Seasons are create-once today. Add: rename, edit the deadline, add/remove a
player, add/remove or reorder a dinner — all owner-only, enforced by the same
event/season rules.

### 4. Richer reveal
Comments are collected but never shown. At reveal, surface per-category winners,
a comments digest, and tie-breakers (the Function can include these in the
`results` doc so no raw score leaks).

### 5. Tests for the domain logic
`schedule`, `reveal`, `scoring` are pure and easy to unit-test — a cheap safety
net against regressions as the app grows (Vitest).

### 6. Notifications
Email/push when results unlock, or a nudge to guests who haven't rated yet
(Function + a mail/push provider).

## Housekeeping

- Clean up orphaned `codes` / subcollections when a season is deleted (Function).
- `src/lib/stripe.ts` is an unused stub — keep only if a paid tier is ever added.
- Local end-to-end testing with the Firebase emulator suite
  (`firebase emulators:start`); config already in `firebase.json`.

## Deploy

```bash
npm run build
# Web is deployed via Vercel (vercel.json). Firebase pieces:
firebase deploy --only firestore:rules,functions
```
