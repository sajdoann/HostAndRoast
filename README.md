# Host & Roast · Host je skvost 🍗

A take-turns-hosting dinner game for a group of friends. Everyone hosts one
dinner; guests rate each dinner on food, hospitality and entertainment; scores
stay **sealed** until the whole season is done — then the leaderboard is
revealed.

Minimalist, modular, bilingual (English 🇬🇧 / Čeština 🇨🇿). Runs on **localStorage
with no backend**, and auto-switches to **Firebase (Firestore + Google auth)**
when configured — behind a single `Store` seam, so the UI never changes.

## How it works

1. **Organizer signs in and creates a season** — adds the players and a
   round-robin schedule (one host per date).
2. **Each dinner is its own event** with a short join code + QR the host shows
   on the day, and a menu the cook can fill in.
3. **Anyone with the season link** can see the schedule; **guests rate with no
   signup** — open the link, pick their name, score food / hospitality /
   entertainment (1–10) with an optional comment. The host never rates their own
   dinner.
4. **Scores are hidden from everyone**, including the organizer, until the reveal
   condition is met: every dinner has passed *and* all ratings are in — or a
   deadline lapses, so one missing guest can't hold the game hostage.
5. **Reveal** shows a leaderboard of per-host averages and totals.

## Roles

| Role | Signs in? | Can |
| --- | --- | --- |
| **Organizer** (owner) | yes | Create the season; edit/delete anything; only they list their seasons |
| **Cook** | yes | Claim which player they are (once), then edit **their own** dinner's menu + time; auto-recognized when rating |
| **Guest** | no | Open a shared link, pick a name, rate — no account needed |

Identity for signed-in people is a **claim** (`uid → player`): set once per
season, it makes rating skip "who are you?" and unlocks editing your own dinner.
Any signed-in interaction (claim or rate) records a **membership**, so seasons
you take part in appear on your home page.

## Stack

- **Vite + React + TypeScript** — small, no framework lock-in.
- **react-router-dom** — the routes below.
- **Firebase** (Firestore + Auth) — real-time, auto-selected when configured.
- **Custom i18n** — dependency-free JSON locales (`src/i18n/locales`).
- **qrcode** — QR codes for join links. Plain CSS, brand tokens from the logo.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173  (localStorage mode)
npm run build        # tsc + vite build
npm run typecheck
```

**Enable Firebase** (multi-device, real QR joins, accounts): copy `.env.example`
→ `.env.local` and fill in your Firebase web config. The app then talks to
Firestore automatically. Deploy the rules in `firestore.rules`, and see
[ROADMAP.md](./ROADMAP.md) for the leaderboard Cloud Function.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | Landing, join-by-code, your seasons (owned + joined) |
| `/new` | organizer | Create a season (players, schedule, deadline) |
| `/season/:id` | anyone with link | Schedule, menus, per-cook editing, reveal banner |
| `/event/:seasonId/:eventId` | host | The QR + code + menu to show on the day |
| `/join/:code` | guest | Pick name (or auto) → rate → sealed |
| `/season/:id/results` | anyone | Leaderboard (locked until reveal) |

## Structure

```
src/
  domain/        Pure game logic (no React) — reused by future Cloud Functions
    types.ts       Season, DinnerEvent, Rating, Player, Claim
    schedule.ts    Round-robin schedule builder
    reveal.ts      Reveal condition + per-event completion
    scoring.ts     Leaderboard computation
    categories.ts  Rating categories + score bounds
  store/         Persistence seam (the one place that knows about Firestore)
    types.ts       Store interface
    localStore.ts  localStorage implementation
    firestoreStore.ts  On-demand Firestore implementation (real-time)
    hooks.ts       React hooks (useSeasonView, useJoinTarget, useMyClaim, …)
    index.ts       Auto-selects the active store
  auth/          Google sign-in context (useAuth)
  i18n/          Tiny provider + en.json / cs.json
  components/    Header, AuthButton (account menu), QRCode, ScoreSlider, …
  pages/         Home, NewSeason, Season, EventDay, Join, Results, NotFound
  lib/           config, firebase, voteGuard, stripe (optional stub)

functions/       Cloud Functions — compute & publish the leaderboard on reveal
firestore.rules  Access model + score-hiding (ratings are read-never)
```

## Data model (Firestore)

- `seasons/{id}` — `{ name, ownerId, players[], revealAt?, createdAt }` — `get` public, `list` owner-only
- `seasons/{id}/events/{eid}` — one dinner `{ ownerId, hostId, date, code, mealDescription? }` — public read; owner or claimed cook edits
- `seasons/{id}/claims/{uid}` — `{ playerId }` — a participant's identity
- `seasons/{id}/ratings/{eid_rid}` — `{ scores, comment, … }` — **read-never**
- `seasons/{id}/receipts/{eid_rid}` — `{ eventId, raterId }` — public, no scores; drives progress + reveal
- `codes/{CODE}` — `{ seasonId, eventId }` — join-link lookup
- `users/{uid}/memberships/{seasonId}` — private list of seasons you're in
- `results/{seasonId}` — `{ board, publishedAt }` — written by the reveal Function

## Reveal

The season owner triggers the reveal. A Vercel serverless function
(`api/reveal.ts`) reads the sealed scores with Firebase Admin credentials,
computes the stats, and publishes them — so raw scores are never exposed to
clients. It needs `FIREBASE_SERVICE_ACCOUNT` set in Vercel (see
[ROADMAP.md](./ROADMAP.md) → Setup).

## Next steps

See [ROADMAP.md](./ROADMAP.md).
