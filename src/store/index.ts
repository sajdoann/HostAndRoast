import { localStore } from "./localStore";
import type { Store } from "./types";

/**
 * The active store. To move to Firebase, implement a firestoreStore that
 * satisfies Store and swap the line below — nothing else in the app changes.
 * TODO(firebase): const store: Store = firestoreStore;
 */
export const store: Store = localStore;

export type { Store, DB } from "./types";
