import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useI18n } from "../i18n";

/**
 * Account control for the header.
 * - Signed out: a compact "Sign in" button.
 * - Signed in: an avatar that opens a small menu (New season, Sign out).
 * Hidden entirely in local (no-Firebase) mode.
 */
export default function AuthButton() {
  const { t } = useI18n();
  const { user, required, loading, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!required || loading) return null;

  if (!user) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signIn()}>
        {t("auth.signIn")}
      </button>
    );
  }

  const initial = (user.displayName ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="account">
      <button
        type="button"
        className="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.displayName ?? user.email ?? "Account"}
        onClick={() => setOpen((o) => !o)}
      >
        {user.photoURL ? (
          <img className="auth-avatar" src={user.photoURL} alt="" />
        ) : (
          <span className="avatar-fallback">{initial}</span>
        )}
      </button>

      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="account-menu" role="menu">
            <div className="account-name">{user.displayName ?? user.email}</div>
            <Link to="/new" role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
              + {t("nav.new")}
            </Link>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              {t("auth.signOut")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
