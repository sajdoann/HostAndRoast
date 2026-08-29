import { Link, NavLink } from "react-router-dom";
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

        <div className="header-actions">
          <NavLink to="/new" className="btn btn-primary btn-sm">
            + {t("nav.new")}
          </NavLink>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
