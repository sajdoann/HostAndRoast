/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Firebase (see .env.example) — TODO(firebase): fill in from your project.
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;

  // Stripe — TODO(stripe): publishable key only on the client.
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
