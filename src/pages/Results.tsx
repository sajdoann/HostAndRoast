import { Link, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { store } from "../store";
import { useSeason, useSeasonRatings } from "../store/hooks";
import { revealStatus } from "../domain/reveal";
import { MAX_TOTAL } from "../domain/scoring";
import { CATEGORIES } from "../domain/categories";

export default function Results() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const season = useSeason(id);
  const ratings = useSeasonRatings(season);

  if (!season) {
    return (
      <section className="section">
        <div className="container center-narrow">
          <p className="muted">{t("notFound.body")}</p>
          <Link to="/" className="btn btn-primary">
            {t("notFound.back")}
          </Link>
        </div>
      </section>
    );
  }

  const reveal = revealStatus(season, ratings);

  if (!reveal.revealed) {
    return (
      <section className="section">
        <div className="container center-narrow">
          <div className="lock-badge">🔒</div>
          <h1 className="section-title">{t("results.lockedTitle")}</h1>
          <p className="muted">{t("results.lockedBody")}</p>
          <ul className="pending-list">
            {!reveal.allDatesPassed && <li>{t("results.pendingDates")}</li>}
            {!reveal.allRatingsIn && reveal.missingRatings > 0 && (
              <li>{t("results.pendingRatings", { n: reveal.missingRatings })}</li>
            )}
            {season.revealAt && (
              <li>
                {t("results.deadlineNote", {
                  date: new Date(season.revealAt).toLocaleDateString(
                    lang === "cs" ? "cs-CZ" : "en-GB"
                  ),
                })}
              </li>
            )}
          </ul>
          <Link to={`/season/${season.id}`} className="btn btn-ghost btn-sm">
            {t("common.back")}
          </Link>
        </div>
      </section>
    );
  }

  const board = store.getResults(season.id);

  // Firestore mode: revealed, but the Cloud Function hasn't published yet.
  if (board === null) {
    return (
      <section className="section">
        <div className="container center-narrow">
          <div className="lock-badge">⏳</div>
          <h1 className="section-title">{t("results.title")}</h1>
          <p className="muted">{t("results.preparing")}</p>
          <Link to={`/season/${season.id}`} className="btn btn-ghost btn-sm">
            {t("common.back")}
          </Link>
        </div>
      </section>
    );
  }

  const topTotal = board[0]?.total ?? 0;

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">{t("results.title")}</h1>
        <p className="muted page-lead">{t("results.subtitle")}</p>

        {board.every((r) => r.ratingsCount === 0) ? (
          <p className="muted">{t("results.noRatings")}</p>
        ) : (
          <ol className="leaderboard">
            {board.map((row, i) => (
              <li key={row.hostId} className={`lb-row ${i === 0 && row.total === topTotal ? "lb-winner" : ""}`}>
                <span className="lb-rank">{i + 1}</span>
                <div className="lb-body">
                  <div className="lb-head">
                    <strong>{row.hostName}</strong>
                    {i === 0 && row.total === topTotal && (
                      <span className="pill pill-winner">🏆 {t("results.winner")}</span>
                    )}
                  </div>
                  <div className="lb-cats">
                    {CATEGORIES.map((cat) => (
                      <span key={cat} className="lb-cat">
                        <span className="muted small">{t(`categories.${cat}`)}</span>
                        <strong>{row.perCategory[cat].toFixed(1)}</strong>
                      </span>
                    ))}
                  </div>
                  <div className="muted small">{t("results.ratings", { n: row.ratingsCount })}</div>
                </div>
                <div className="lb-total">
                  <strong>{row.total.toFixed(1)}</strong>
                  <span className="muted small">
                    {t("results.of")} {MAX_TOTAL}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}

        <Link to={`/season/${season.id}`} className="btn btn-ghost btn-sm">
          {t("common.back")}
        </Link>
      </div>
    </section>
  );
}
