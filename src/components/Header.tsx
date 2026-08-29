import { NavLink, Link } from "react-router-dom";
import { useI18n } from "../i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header() {
  const { t } = useI18n();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">H&amp;R</span>
          <span className="brand-name">{t("brand.name")}</span>
        </Link>

        <nav className="site-nav">
          <NavLink to="/dinners">{t("nav.dinners")}</NavLink>
          <NavLink to="/host">{t("nav.host")}</NavLink>
        </nav>

        <div className="header-actions">
          <LanguageSwitcher />
          {/* TODO(auth): wire to Firebase Auth. */}
          <button className="btn btn-ghost">{t("nav.signIn")}</button>
        </div>
      </div>
    </header>
  );
}
