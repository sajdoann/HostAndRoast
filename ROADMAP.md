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
- **Owner-triggered reveal + rich stats** — the season owner hits "Reveal"; a
  Vercel serverless function (`api/reveal.ts`) reads the sealed scores with
  admin credentials and publishes the leaderboard, per-category winners,
  each rater's own scores, and per-dinner feedback (a cook sees their dinner's
  comments; the owner sees all). Works with partial ratings.
- **Trustworthy rating flow** — the "thanks" screen only shows after the write
  lands; receipts require their matching rating to exist (no faked progress).
- **Deployed** — Vercel (web + reveal function) + Firebase (data/auth);
  bilingual EN/CS; account menu; brand logos.

## Setup for the reveal function

`api/reveal.ts` needs Firebase **Admin** credentials:
1. Firebase console → Project settings → **Service accounts** → **Generate new
   private key** → download the JSON.
2. Vercel → project → Settings → **Environment Variables** → add
   `FIREBASE_SERVICE_ACCOUNT` = the full JSON (Production + Preview).
3. Publish `firestore.rules` (adds the `results/*` read gating) and redeploy.

## ⭐ Highest-value upgrades

### 1. Season management for the organizer
Seasons are create-once today. Add: rename, edit the deadline, add/remove a
player, add/remove or reorder a dinner — all owner-only, enforced by the same
event/season rules.

### 2. Tests for the domain logic
`schedule`, `reveal`, `scoring` are pure and easy to unit-test — a cheap safety
net against regressions as the app grows (Vitest).

### 3. Re-reveal & notifications
Let the owner re-run the reveal after late ratings arrive (the function already
overwrites `results/*`). Email/push when results unlock, or a nudge to guests
who haven't rated yet.

### 4. Reveal-time extras
Tie-breakers, a "most generous / harshest rater" stat, best-dish highlights —
all computable in `computeSeasonStats` so no raw score leaks.

## Housekeeping

- Clean up orphaned `codes` / subcollections when a season is deleted.
- The `functions/` folder (Firebase Cloud Functions stub) is unused — reveal
  runs on Vercel (`api/reveal.ts`). Remove it unless you adopt Cloud Functions.
- `src/lib/stripe.ts` is an unused stub — keep only if a paid tier is ever added.

## Deploy

```bash
npm run build            # web (Vercel builds this + api/reveal.ts)
firebase deploy --only firestore:rules
```
Set `FIREBASE_SERVICE_ACCOUNT` in Vercel (see Setup above) for reveal to work.
