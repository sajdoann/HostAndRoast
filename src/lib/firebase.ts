/**
 * Firebase initialization.
 *
 * Guarded so the app runs with no config at all (localStorage mode): `db` is
 * null until you fill in .env.local (see .env.example). We only pull in
 * Firestore here — organizer auth is a later phase (see ROADMAP).
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { firebaseConfig, firebaseEnabled } from "./config";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  // Analytics is optional and browser-only; load it lazily so it never bloats
  // the bundle or breaks non-browser environments.
  if (firebaseConfig.measurementId && typeof window !== "undefined") {
    import("firebase/analytics")
      .then(({ getAnalytics, isSupported }) =>
        isSupported().then((ok) => {
          if (ok && app) getAnalytics(app);
        })
      )
      .catch(() => {
        /* analytics unavailable — ignore */
      });
  }
}

export { app, db, auth };
