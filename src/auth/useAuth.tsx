import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { store } from "../store";

/**
 * Auth for organizers (Google sign-in). Guests never need this — they rate
 * without an account. When Firebase isn't configured (local/demo mode),
 * `required` is false and there is no user: the app runs without login.
 */
type AuthValue = {
  user: User | null;
  loading: boolean;
  /** True when Firebase is on and actions like "create season" need a login. */
  required: boolean;
  /** Last sign-in error message, if any (surfaced in the UI). */
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const provider = new GoogleAuthProvider();

// Popup can silently fail on mobile / with strict popup isolation — fall back
// to a full-page redirect in those cases.
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(auth));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    // Complete any redirect-based sign-in and surface its errors.
    getRedirectResult(auth).catch((e) => {
      console.error("[auth] redirect result failed:", e);
      setError(e?.code ?? String(e));
    });
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      store.setViewer(u?.uid ?? null); // drives the owner's season list
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      required: Boolean(auth),
      error,
      async signIn() {
        if (!auth) return;
        setError(null);
        try {
          await signInWithPopup(auth, provider);
        } catch (e) {
          const code = (e as { code?: string })?.code ?? "";
          console.error("[auth] popup sign-in failed:", e);
          if (POPUP_FALLBACK_CODES.has(code)) {
            // Redirect flow: leaves the page and returns signed in.
            await signInWithRedirect(auth, provider);
            return;
          }
          setError(code || "sign-in failed");
        }
      },
      async signOut() {
        if (!auth) return;
        await fbSignOut(auth);
      },
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
