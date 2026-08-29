import { useAuth } from "../auth/useAuth";
import { useI18n } from "../i18n";

/** Header sign-in / sign-out control. Hidden entirely in local (no-Firebase) mode. */
export default function AuthButton() {
  const { t } = useI18n();
  const { user, required, loading, signIn, signOut } = useAuth();

  if (!required || loading) return null;

  if (!user) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signIn()}>
        {t("auth.signIn")}
      </button>
    );
  }

  return (
    <div className="auth-me">
      {user.photoURL && <img className="auth-avatar" src={user.photoURL} alt="" />}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => void signOut()}
        title={user.displayName ?? user.email ?? ""}
      >
        {t("auth.signOut")}
      </button>
    </div>
  );
}
