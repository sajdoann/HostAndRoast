import { useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/useAuth";
import { store } from "../store";
import { useDB, useJoinTarget, useMyClaim, useSeasonByCode } from "../store/hooks";
import Loading from "../components/Loading";
import ScoreSlider from "../components/ScoreSlider";
import { categoriesFor } from "../domain/categories";
import { isEventComplete, ratingsForEvent } from "../domain/reveal";
import { hasVoted, markVoted } from "../lib/voteGuard";

function centre(children: ReactNode) {
  return (
    <section className="section">
      <div className="container center-narrow">{children}</div>
    </section>
  );
}

export default function Join() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { code } = useParams();
  const { target, codeState } = useJoinTarget(code);
  // The same box accepts a season code, so fall back to that before giving up.
  const { season: seasonByCode } = useSeasonByCode(code);
  const myClaim = useMyClaim(target?.season.id);
  const { ratings: allRatings } = useDB();

  const [manualRaterId, setManualRaterId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (codeState === "loading") return <Loading />;

  if (!target) {
    // A season code lands on that season's schedule instead of a rating form.
    if (seasonByCode) return <Navigate to={`/season/${seasonByCode.id}`} replace />;
    return centre(
      <>
        <h1 className="section-title">{t("join.notFoundTitle")}</h1>
        <p className="muted">{t("join.notFoundBody")}</p>
        <Link to="/" className="btn btn-primary">
          {t("notFound.back")}
        </Link>
      </>
    );
  }

  const { season, event } = target;
  const host = season.players.find((p) => p.id === event.hostId);
  const categories = categoriesFor(season, (id) => t(`categories.${id}`));

  if (submitted) {
    return centre(
      <>
        <h1 className="section-title">{t("join.thanksTitle")}</h1>
        <p className="muted">{t("join.thanksBody")}</p>
      </>
    );
  }

  const liveRatings = ratingsForEvent(event, allRatings);

  if (isEventComplete(event, season, liveRatings)) {
    return centre(
      <>
        <h1 className="section-title">{t("join.closedTitle")}</h1>
        <p className="muted">{t("join.closedBody")}</p>
      </>
    );
  }

  if (hasVoted(event.id)) {
    return centre(
      <>
        <h1 className="section-title">{t("join.thanksTitle")}</h1>
        <p className="muted">{t("join.alreadyVotedDevice")}</p>
      </>
    );
  }

  // If you're the host tonight, you don't rate your own dinner.
  if (myClaim && myClaim === event.hostId) {
    return centre(
      <>
        <h1 className="section-title">{t("event.hostedBy", { host: host?.name ?? "—" })}</h1>
        <p className="muted">{t("join.youAreHost")}</p>
      </>
    );
  }

  const ratedIds = new Set(liveRatings.map((r) => r.raterId));
  // Auto-identity from a claimed nickname, else whatever the guest picks.
  const raterId = manualRaterId ?? (myClaim && myClaim !== event.hostId ? myClaim : null);

  if (!raterId) {
    return centre(
      <>
        <p className="eyebrow">{t("event.hostedBy", { host: host?.name ?? "—" })}</p>
        <h1 className="section-title">{t("join.pickName")}</h1>
        <p className="muted">{t("join.pickHelp")}</p>
        <p className="muted small">{t("join.hostNote", { host: host?.name ?? "—" })}</p>
        <div className="name-list">
          {season.players
            .filter((p) => p.id !== event.hostId)
            .map((p) => {
              const already = ratedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="name-btn"
                  disabled={already}
                  onClick={() => {
                    setManualRaterId(p.id);
                    // Signed in? Remember this identity for the whole season.
                    // Best-effort: if that nickname is already held by another
                    // account, rating still works — they just stay unclaimed.
                    if (user && !myClaim) {
                      void store.claimPlayer(season.id, user.uid, p.id).catch(() => {});
                    }
                  }}
                >
                  {p.name}
                  {already && <span className="muted small"> · {t("join.alreadyVotedName")}</span>}
                </button>
              );
            })}
        </div>
        <Link
          to={`/event/${season.id}/${event.id}`}
          className="btn btn-ghost btn-sm show-qr-link"
        >
          {t("event.showQr")}
        </Link>
      </>
    );
  }

  async function submit() {
    if (!raterId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const finalScores = Object.fromEntries(
        categories.map((cat) => [cat.id, scores[cat.id] ?? 5])
      );
      await store.addRating({
        id: `${event.id}_${raterId}`,
        eventId: event.id,
        raterId,
        scores: finalScores,
        comment: comment.trim() || undefined,
        createdAt: Date.now(),
      });
      // Only lock this device and show thanks once the rating actually landed.
      markVoted(event.id, season.players.find((p) => p.id === raterId)?.name ?? "");
      setSubmitted(true);
    } catch (e) {
      console.error("[join] rating failed:", e);
      setSubmitError(t("join.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  const raterName = season.players.find((p) => p.id === raterId)?.name;

  return centre(
    <>
      <h1 className="section-title">{t("join.rateTitle", { host: host?.name ?? "—" })}</h1>
      {raterName && <p className="muted small">{t("join.ratingAs", { name: raterName })}</p>}
      <p className="muted small">{t("join.scoreHelp")}</p>

      <div className="rate-form">
        {categories.map((cat) => (
          <ScoreSlider
            key={cat.id}
            label={cat.label}
            value={scores[cat.id] ?? 5}
            onChange={(v) => setScores((s) => ({ ...s, [cat.id]: v }))}
          />
        ))}

        <label className="field">
          <span>{t("join.commentLabel")}</span>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("join.commentPlaceholder")}
          />
        </label>

        <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? t("common.loading") : t("join.submit")}
        </button>
        {submitError && <p className="form-error">{submitError}</p>}
      </div>
      <Link
        to={`/event/${season.id}/${event.id}`}
        className="btn btn-ghost btn-sm show-qr-link"
      >
        {t("event.showQr")}
      </Link>
    </>
  );
}
