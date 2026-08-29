/**
 * Reads public runtime config from Vite env vars.
 * Only VITE_-prefixed values are exposed to the client — never put secrets here.
 * Copy .env.example to .env.local and fill in your own values.
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

/**
 * Whether Firebase is configured. When true the app talks to Firestore
 * (multi-device, real QR joins); when false it falls back to localStorage.
 * VITE_ env vars are inlined at build time, so this is statically known.
 */
export const firebaseEnabled = Boolean(firebaseConfig.projectId);
