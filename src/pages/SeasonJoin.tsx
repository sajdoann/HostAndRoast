import { Link, Navigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useSeasonByCode } from "../store/hooks";
import Loading from "../components/Loading";

/** Resolves a season's short join code and hands off to its schedule page. */
export default function SeasonJoin() {
  const { t } = useI18n();
  const { code } = useParams();
  const { season, codeState } = useSeasonByCode(code);

  if (codeState === "loading") return <Loading />;

  if (!season) {
    return (
      <section className="section">
        <div className="container center-narrow">
          <h1 className="section-title">{t("season.codeNotFoundTitle")}</h1>
          <p className="muted">{t("season.codeNotFoundBody")}</p>
          <Link to="/" className="btn btn-primary">
            {t("notFound.back")}
          </Link>
        </div>
      </section>
    );
  }

  return <Navigate to={`/season/${season.id}`} replace />;
}
