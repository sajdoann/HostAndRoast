# Host & Roast · Host je skvost 🍗

A **Prostřeno! / "Come Dine With Me"** style dinner game for a group of friends.
Everyone takes a turn hosting; guests rate each dinner on food, hospitality and
entertainment; scores stay **sealed** until the whole season is done — then the
leaderboard is revealed.

Minimalist, modular, bilingual (English 🇬🇧 / Čeština 🇨🇿). It runs **end-to-end
today on localStorage** with no backend, and is wired for Firebase to drop in
behind a single seam.

## How the game works

1. **Organizer creates a season** — adds the players and a round-robin schedule
   (one host per date).
2. **Each dinner is an event** with a short join code + QR the host shows on the day.
3. **Guests join with no signup** — scan the QR, pick their name, score
   food / hospitality / entertainment (1–10) with an optional comment.
   The host never rates their own dinner.
4. **Scores are hidden from everyone**, including the organizer, until the reveal
   condition is met: every dinner has passed *and* all ratings are in — or a
   deadline lapses, so one missing guest can't hold the game hostage.
5. **Reveal** shows a leaderboard of per-host averages and totals.

**No duplicate votes without login:** one submission per name per device
(localStorage flag) *and* one rating per name per dinner (deterministic id), and
a dinner's QR closes once every expected guest has voted.

## Stack

- **Vite + React + TypeScript** — small, no framework lock-in.
- **react-router-dom** — the flows below.
- **Custom i18n** — dependency-free JSON locales (`src/i18n/locales`).
- **qrcode** — QR codes for join links. Plain CSS, brand tokens from the logo.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Try it: create a season, open a dinner's host view (`/event/:id`), scan or open
its `/join/:code` link in another tab to rate. Also: `npm run build`,
`npm run typecheck`.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | Landing + join-by-code |
| `/new` | organizer | Create a season (players, schedule, deadline) |
| `/season/:id` | organizer | Schedule, per-dinner status, reveal banner |
| `/event/:id` | host | The QR + code to show on the day |
| `/join/:code` | guest | Pick name → rate → sealed |
| `/season/:id/results` | anyone | Leaderboard (locked until reveal) |

## Structure

```
src/
  domain/        Pure game logic (no React) — reused by future Cloud Functions
    types.ts       Season, DinnerEvent, Rating, Player
    schedule.ts    Round-robin schedule builder
    reveal.ts      Reveal condition + per-event completion
    scoring.ts     Leaderboard computation
    categories.ts  Rating categories + score bounds
  store/         Persistence seam
    types.ts       Store interface
    localStore.ts  localStorage implementation (pub/sub)
    hooks.ts       React hooks (useSeason, useSeasonRatings, …)
    index.ts       The active store — swap here for Firestore
  i18n/          Tiny provider + en.json / cs.json
  components/    Header, Footer, QRCode, ScoreSlider, CopyLink, …
  pages/         Home, NewSeason, Season, EventDay, Join, Results, NotFound
  lib/           config, voteGuard, firebase (stub), stripe (optional stub)

functions/       Cloud Functions — compute & publish the leaderboard on reveal
firestore.rules  Ratings are write-once, read-never (this is the score-hiding)
```

## Next steps

See [ROADMAP.md](./ROADMAP.md). The move to Firebase touches only `store/` and
the `lib/firebase.ts` stub — the domain logic and UI stay as they are.
