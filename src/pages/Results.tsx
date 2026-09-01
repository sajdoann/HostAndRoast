import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/useAuth";
import { store } from "../store";
import { useMyClaim, useSeasonView } from "../store/hooks";
import Loading from "../components/Loading";
import { maxTotalFor, type RaterStats } from "../domain/scoring";
import { categoriesFor } from "../domain/categories";

export default function Results() {
  const { t } = useI18n();
  const { user, required } = useAuth();
  const { id } = useParams();
  const { season, loaded } = useSeasonView(id);
  const myClaim = useMyClaim(id);

  const board = season ? store.getResults(season.id) : null;
  const isOwner = season ? !required || (!!user && season.ownerId === user.uid) : false;

  const [myStats, setMyStats] = useState<RaterStats | null>(null);
  const [myFeedback, setMyFeedback] = useState<string[] | null>(null);
  const [allFeedback, setAllFeedback] = useState<{ hostName: string; comments: string[] }[] | null>(null);

  const hasBoard = board !== null;
  useEffect(() => {
    if (!season || !hasBoard) return;
    const sid = season.id;
    const nameOf = (hid: string) => season.players.find((p) => p.id === hid)?.name ?? "—";

    if (myClaim) {
      store.getRaterStats(sid, myClaim).then(setMyStats).catch(() => {});
      if (season.events.some((e) => e.hostId === myClaim)) {
        store.getFeedback(sid, myClaim).then(setMyFeedback).catch(() => {});
      }
    }
    if (isOwner) {
      Promise.all(
        season.events.map((e) =>
          store.getFeedback(sid, e.hostId).then((c) => ({ hostName: nameOf(e.hostId), comments: c ?? [] }))
        )
      )
        .then(setAllFeedback)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.id, hasBoard, myClaim, isOwner]);

  if (!loaded) return <Loading />;

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

  if (!board) {
    return (
      <section className="section">
        <div className="container center-narrow">
          <div className="lock-badge">🔒</div>
          <h1 className="section-title">{t("results.lockedTitle")}</h1>
          <p className="muted">{t("results.notRevealedBody")}</p>
          <Link to={`/season/${season.id}`} className="btn btn-ghost btn-sm">
            {t("common.back")}
          </Link>
        </div>
      </section>
    );
  }

  const topTotal = board[0]?.total ?? 0;
  const noRatings = board.every((r) => r.ratingsCount === 0);
  const categories = categoriesFor(season, (id) => t(`categories.${id}`));
  const maxTotal = maxTotalFor(season);

  // Per-category winner, computed from the public board.
  const catWinner = (catId: string) =>
    board
      .filter((r) => r.ratingsCount > 0)
      .reduce<(typeof board)[number] | null>(
        (best, r) => (!best || (r.perCategory[catId] ?? 0) > (best.perCategory[catId] ?? 0) ? r : best),
        null
      );

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">{t("results.title")}</h1>
        <p className="muted page-lead">{t("results.subtitle")}</p>

        {noRatings ? (
          <p className="muted">{t("results.noRatings")}</p>
        ) : (
          <>
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
                      {categories.map((cat) => (
                        <span key={cat.id} className="lb-cat">
                          <span className="muted small">{cat.label}</span>
                          <strong>{(row.perCategory[cat.id] ?? 0).toFixed(1)}</strong>
                        </span>
                      ))}
                    </div>
                    <div className="muted small">{t("results.ratings", { n: row.ratingsCount })}</div>
                  </div>
                  <div className="lb-total">
                    <strong>{row.total.toFixed(1)}</strong>
                    <span className="muted small">
                      {t("results.of")} {maxTotal}
                    </span>
                  </div>
                </li>
              ))}
            </ol>

            {/* Category winners */}
            <h2 className="subhead">{t("results.categoryWinners")}</h2>
            <div className="cat-winners">
              {categories.map((cat) => {
                const w = catWinner(cat.id);
                return (
                  <div key={cat.id} className="card cat-winner">
                    <span className="muted small">{cat.label}</span>
                    <strong>{w ? w.hostName : "—"}</strong>
                    {w && <span className="muted small">{(w.perCategory[cat.id] ?? 0).toFixed(1)}</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Your own ratings */}
        {myStats && myStats.perDinner.length > 0 && (
          <>
            <h2 className="subhead">{t("results.yourRatings")}</h2>
            <p className="muted small">{t("results.yourAvg", { avg: myStats.avg.toFixed(1) })}</p>
            <ul className="stat-list">
              {myStats.perDinner.map((d, i) => (
                <li key={i} className="stat-row">
                  <span>{d.hostName}</span>
                  <strong>{d.total.toFixed(1)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* A cook's feedback on their own dinner */}
        {myFeedback && (
          <>
            <h2 className="subhead">{t("results.yourFeedback")}</h2>
            {myFeedback.length === 0 ? (
              <p className="muted small">{t("results.noComments")}</p>
            ) : (
              <ul className="comment-list">
                {myFeedback.map((c, i) => (
                  <li key={i} className="comment">“{c}”</li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* Owner sees all feedback */}
        {isOwner && allFeedback && (
          <>
            <h2 className="subhead">{t("results.allFeedback")}</h2>
            {allFeedback.map((f, i) => (
              <div key={i} className="feedback-group">
                <strong>{f.hostName}</strong>
                {f.comments.length === 0 ? (
                  <p className="muted small">{t("results.noComments")}</p>
                ) : (
                  <ul className="comment-list">
                    {f.comments.map((c, j) => (
                      <li key={j} className="comment">“{c}”</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}

        <div className="results-footer">
          <Link to={`/season/${season.id}`} className="btn btn-ghost btn-sm">
            {t("common.back")}
          </Link>
        </div>
      </div>
    </section>
  );
}
