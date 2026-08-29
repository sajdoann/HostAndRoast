import { Link, NavLink } from "react-router-dom";
import { useI18n } from "../i18n";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import AuthButton from "./AuthButton";

export default function Header() {
  const { t } = useI18n();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label={t("brand.name")}>
          <Logo className="brand-logo" />
        </Link>

        <div className="header-actions">
          <NavLink to="/new" className="btn btn-primary btn-sm">
            + {t("nav.new")}
          </NavLink>
          <AuthButton />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
