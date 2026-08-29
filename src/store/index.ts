import { localStore } from "./localStore";
import { createFirestoreStore } from "./firestoreStore";
import { firebaseEnabled } from "../lib/config";
import type { Store } from "./types";

/**
 * The active store. Auto-selects Firestore when Firebase is configured
 * (.env.local), otherwise falls back to localStorage so the app always runs.
 */
export const store: Store = firebaseEnabled ? createFirestoreStore() : localStore;

export type { Store, DB } from "./types";
