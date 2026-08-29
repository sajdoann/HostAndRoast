# Roadmap

The scaffold ships a working, bilingual front end with mock data. Each phase
below is self-contained — pick one up when you're ready. Grep for `TODO(...)`
to find the exact spot in the code.

## ✅ Phase 0 — Scaffold (done)

- Vite + React + TypeScript app, modular structure.
- Bilingual EN/CS with a tiny custom i18n.
- Brand styling from the logo (gold on ink & cream).
- Pages: Home, Dinners, Host, 404.
- Placeholders for Firebase, Stripe, Functions, and Firestore rules.

## Phase 1 — Firebase Auth & Firestore  → `TODO(firebase)`, `TODO(auth)`

1. `npm install firebase`.
2. Create a Firebase project; copy web config into `.env.local` (see `.env.example`).
3. Uncomment `src/lib/firebase.ts` to export `auth` and `db`.
4. Add an `AuthProvider` (context) exposing the current user; wire the
   **Sign in** button in `Header.tsx`.
5. Replace `src/data/dinners.ts` mock with a Firestore query on `dinners`.

**Model**

- `dinners/{id}` — `{ hostId, title, city, date, pricePerSeat, currency, seatsLeft, image }`
- `bookings/{id}` — `{ dinnerId, guestId, hostId, seats, status, createdAt }`
- `users/{uid}` — `{ displayName, isHost }`

## Phase 2 — Firestore security rules  → `firestore.rules`

- `firestore.rules` already encodes the model above (public dinners,
  host-owned writes, private bookings written server-side only).
- Test with the emulator, then `firebase deploy --only firestore:rules`.

## Phase 3 — Stripe payments  → `TODO(stripe)`

1. Client: `npm install @stripe/stripe-js`; uncomment `src/lib/stripe.ts`.
2. Booking flow: `DinnerCard` **Book** → call the `createCheckoutSession`
   Cloud Function → `redirectToCheckout`.
3. Put the publishable key in `.env.local`; the **secret** key stays in Functions.

## Phase 4 — Cloud Functions  → `TODO(functions)`, `functions/src/index.ts`

1. `cd functions && npm install stripe`.
2. `firebase functions:config:set stripe.secret="sk_..." stripe.webhook="whsec_..."`.
3. Implement:
   - `createCheckoutSession` — validate seats, create the Stripe session.
   - `stripeWebhook` — on `checkout.session.completed`, write the booking and
     decrement `seatsLeft` (this is why booking writes are denied in the rules).

## Phase 5 — Deploy

```bash
npm run build
firebase deploy   # hosting + rules + functions
```

Local end-to-end: `firebase emulators:start` (config already in `firebase.json`).
