# Host & Roast · Host je skvost 🍗

Book a seat at a real roast dinner. Local hosts open their tables; guests bring
their appetite. A minimalist, modular scaffold — bilingual (English 🇬🇧 /
Čeština 🇨🇿) and ready for Firebase, Stripe, and Cloud Functions.

## Stack

- **Vite + React + TypeScript** — fast, small, no framework lock-in.
- **react-router-dom** — a handful of pages.
- **Custom i18n** — dependency-free, JSON locale files (`src/i18n/locales`).
- **Plain CSS** — brand tokens in `src/theme.css` (gold on ink & cream, from the logo).

Integrations (Firebase / Stripe / Functions) are **stubbed but wired up** —
drop in keys and uncomment. See [ROADMAP.md](./ROADMAP.md).

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

## Project structure

```
src/
  main.tsx            App bootstrap (router + i18n providers)
  App.tsx             Routes
  theme.css           Brand tokens
  index.css           Base styles + primitives (.btn, .card, .container)
  App.css             Layout & component styles
  i18n/
    index.tsx         Tiny i18n provider + useI18n() hook
    locales/          en.json, cs.json
  components/         Header, Footer, Layout, LanguageSwitcher, DinnerCard
  pages/              Home, Dinners, Host, NotFound
  data/dinners.ts     Mock data (→ Firestore later)
  lib/
    config.ts         Reads VITE_ env vars
    firebase.ts       Firebase init (placeholder)
    stripe.ts         Stripe client (placeholder)

functions/            Cloud Functions (Stripe checkout & webhooks) — placeholder
firestore.rules       Starter security rules
firebase.json         Hosting + Firestore + Functions + emulators config
.env.example          Copy to .env.local
```

## Adding a language

1. Add `src/i18n/locales/<code>.json` (copy `en.json`, translate).
2. Register it in `src/i18n/index.tsx` (`LANGUAGES` + `DICTIONARIES`).
3. Add a label in `LanguageSwitcher.tsx`.

## Next steps

See [ROADMAP.md](./ROADMAP.md) for the Firebase, Stripe, rules, and Functions plan.
Every integration point is marked with a `TODO(...)` comment in the code.
