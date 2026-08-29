/**
 * Firebase initialization.
 *
 * Guarded so the app runs with no config at all (localStorage mode): `db` is
 * null until you fill in .env.local (see .env.example). We only pull in
 * Firestore here — organizer auth is a later phase (see ROADMAP).
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, firebaseEnabled } from "./config";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { app, db };
