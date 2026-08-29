import { useI18n } from "../i18n";

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span className="brand-name">{t("brand.name")}</span>
        <span className="muted">
          © {year} · {t("footer.rights")} · {t("footer.madeWith")}
        </span>
      </div>
    </footer>
  );
}
