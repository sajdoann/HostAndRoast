import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";

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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(auth));

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      required: Boolean(auth),
      async signIn() {
        if (!auth) return;
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      async signOut() {
        if (!auth) return;
        await fbSignOut(auth);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
