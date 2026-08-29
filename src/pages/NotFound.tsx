import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="container center-narrow">
        <h1 className="section-title">{t("notFound.title")}</h1>
        <p className="muted">{t("notFound.body")}</p>
        <Link to="/" className="btn btn-primary">
          {t("notFound.back")}
        </Link>
      </div>
    </section>
  );
}
