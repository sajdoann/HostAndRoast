import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/useAuth";
import { store } from "../store";
import { useDB, useMyClaim, useSeasonView } from "../store/hooks";
import Loading from "../components/Loading";
import MenuModal from "../components/MenuModal";
import QRCode from "../components/QRCode";
import CopyLink from "../components/CopyLink";
import { compareEventDates, todayISO } from "../domain/schedule";
import { expectedRatings, ratingsForEvent, revealStatus } from "../domain/reveal";
import type { DinnerEvent, Season as SeasonModel } from "../domain/types";

function statusKey(event: DinnerEvent, season: SeasonModel, ratingsIn: number): string {
  if (ratingsIn >= expectedRatings(season)) return "complete";
  if (!event.date) return "unscheduled";
  const today = todayISO();
  if (event.date === today) return "today";
  if (event.date < today) return "past";
  return "upcoming";
}

/** One dinner row: editable (owner or its cook) or read-only. */
function DinnerRow({
  season,
  event,
  ratingsCount,
  canEdit,
  isCook,
}: {
  season: SeasonModel;
  event: DinnerEvent;
  ratingsCount: number;
  canEdit: boolean;
  isCook: boolean;
}) {
  const { t } = useI18n();
  const [meal, setMeal] = useState(event.mealDescription ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const hostName = season.players.find((p) => p.id === event.hostId)?.name ?? "—";
  const key = statusKey(event, season, ratingsCount);

  function saveMeal() {
    if ((event.mealDescription ?? "") !== meal.trim()) {
      store.updateEvent(season.id, { ...event, mealDescription: meal.trim() });
    }
  }

  return (
    <div className="schedule-row card">
      <div className="schedule-host">
        <strong>{hostName}</strong>
        <span className={`pill pill-${key}`}>{t(`season.status.${key}`)}</span>
      </div>

      {canEdit ? (
        <input
          className="schedule-date"
          type="date"
          value={event.date ?? ""}
          onChange={(e) =>
            store.updateEvent(season.id, { ...event, date: e.target.value || undefined })
          }
        />
      ) : (
        <span className="schedule-date muted">
          {event.date || t("season.status.unscheduled")}
        </span>
      )}

      {canEdit ? (
        <textarea
          className="meal-input"
          rows={3}
          value={meal}
          placeholder={t("season.mealPlaceholder")}
          onChange={(e) => setMeal(e.target.value)}
          onBlur={saveMeal}
        />
      ) : (
        <span className="meal-text muted">
          {(event.mealDescription || t("season.noMeal")).split("\n")[0]}
        </span>
      )}

      <div className="schedule-meta muted">
        <code>{event.code}</code> ·{" "}
        {t("season.rated", { done: ratingsCount, total: expectedRatings(season) })}
      </div>

      <div className="schedule-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(true)}>
          {t("menu.view")}
        </button>
        {isCook ? (
          // The cook can't rate their own dinner — they get the QR to present.
          <Link to={`/event/${season.id}/${event.id}`} className="btn btn-ghost btn-sm">
            {t("season.showQr")}
          </Link>
        ) : (
          // Everyone else goes straight to rating (QR is one tap away from there).
          <Link to={`/join/${event.code}`} className="btn btn-primary btn-sm">
            {t("season.rate")}
          </Link>
        )}
      </div>
      {menuOpen && (
        <MenuModal
          hostName={hostName}
          text={event.mealDescription}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

export default function Season() {
  const { t, lang } = useI18n();
  const { user, required } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { season, ratings, loaded } = useSeasonView(id);
  const myClaim = useMyClaim(id);
  const { revealed } = useDB();
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

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

  const isOwner = !required || (!!user && season.ownerId === user.uid);
  const events = [...season.events].sort(compareEventDates);
  const myName = myClaim ? season.players.find((p) => p.id === myClaim)?.name : undefined;
  const isRevealed = revealed.includes(season.id);
  const rstatus = revealStatus(season, ratings);
  const seasonJoinUrl = season.code
    ? `${window.location.origin}/s/${season.code}`
    : `${window.location.origin}/season/${season.id}`;

  function remove() {
    if (season && confirm(t("season.deleteConfirm"))) {
      store.deleteSeason(season.id);
      navigate("/");
    }
  }

  async function reveal() {
    if (!season || revealing) return;
    if (!rstatus.allRatingsIn && !confirm(t("season.revealPartialConfirm"))) return;
    setRevealing(true);
    setRevealError(null);
    try {
      await store.revealSeason(season.id);
      navigate(`/season/${season.id}/results`);
    } catch (e) {
      console.error("[reveal] failed:", e);
      setRevealError(t("season.revealError"));
    } finally {
      setRevealing(false);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">{season.name}</h1>

        {/* Identity: claim your nickname once (signed-in participants). */}
        {required &&
          (user ? (
            myName ? (
              <p className="muted small">{t("season.youAre", { name: myName })}</p>
            ) : (
              <div className="claim-box card">
                <strong>{t("season.claimTitle")}</strong>
                <p className="muted small">{t("season.claimHelp")}</p>
                <div className="claim-names">
                  {season.players.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="name-btn"
                      onClick={() => store.claimPlayer(season.id, user.uid, p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : null)}

        <div className={`reveal-banner ${isRevealed ? "is-open" : "is-locked"}`}>
          <strong>
            {isRevealed ? t("season.reveal.unlocked") : t("season.reveal.locked")}
          </strong>
          <span className="muted">
            {isRevealed
              ? t("season.reveal.unlockedBody")
              : isOwner
                ? rstatus.allRatingsIn
                  ? t("season.revealReady")
                  : t("season.revealMissing", { n: rstatus.missingRatings })
                : t("season.reveal.lockedBody")}
          </span>
          {isRevealed ? (
            <Link to={`/season/${season.id}/results`} className="btn btn-primary btn-sm">
              {t("season.results")}
            </Link>
          ) : isOwner ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={reveal}
              disabled={revealing}
            >
              {revealing ? t("common.loading") : t("season.revealNow")}
            </button>
          ) : null}
        </div>
        {revealError && <p className="form-error">{revealError}</p>}

        <h2 className="subhead">{t("season.schedule")}</h2>
        <p className="muted small">{t("season.shareHint")}</p>

        <div className="season-share">
          <p className="muted small">{t("season.scanToJoin")}</p>
          <div className="qr-wrap">
            <QRCode value={seasonJoinUrl} size={180} />
          </div>
          {season.code && (
            <p className="join-code">
              {t("season.orEnterCode")} <strong>{window.location.host}</strong>
              <br />
              <span className="code-big">{season.code}</span>
            </p>
          )}
          <CopyLink value={seasonJoinUrl} />
        </div>

        <div className="schedule">
          {events.map((event) => {
            const count = ratingsForEvent(event, ratings).length;
            const isCook = !!myClaim && myClaim === event.hostId;
            const canEdit = isOwner || isCook;
            return (
              <DinnerRow
                key={event.id}
                season={season}
                event={event}
                ratingsCount={count}
                canEdit={canEdit}
                isCook={isCook}
              />
            );
          })}
        </div>

        {season.revealAt && (
          <p className="muted small">
            {t("season.deadline")}:{" "}
            {new Date(season.revealAt).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-GB")}
          </p>
        )}

        {isOwner && (
          <div className="season-footer">
            <button className="btn btn-ghost btn-sm danger" onClick={remove}>
              {t("season.delete")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
