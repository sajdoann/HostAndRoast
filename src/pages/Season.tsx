import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/useAuth";
import { store } from "../store";
import { useMyClaim, useSeasonView } from "../store/hooks";
import Loading from "../components/Loading";
import { todayISO } from "../domain/schedule";
import { expectedRatings, ratingsForEvent, revealStatus } from "../domain/reveal";
import type { DinnerEvent, Season as SeasonModel } from "../domain/types";

function statusKey(event: DinnerEvent, season: SeasonModel, ratingsIn: number): string {
  if (ratingsIn >= expectedRatings(season)) return "complete";
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
}: {
  season: SeasonModel;
  event: DinnerEvent;
  ratingsCount: number;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const [meal, setMeal] = useState(event.mealDescription ?? "");
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
          value={event.date}
          onChange={(e) => store.updateEvent(season.id, { ...event, date: e.target.value })}
        />
      ) : (
        <span className="schedule-date muted">{event.date}</span>
      )}

      {canEdit ? (
        <input
          className="meal-input"
          value={meal}
          placeholder={t("season.mealPlaceholder")}
          onChange={(e) => setMeal(e.target.value)}
          onBlur={saveMeal}
        />
      ) : (
        <span className="meal-text muted">
          {event.mealDescription || t("season.noMeal")}
        </span>
      )}

      <div className="schedule-meta muted">
        <code>{event.code}</code> ·{" "}
        {t("season.rated", { done: ratingsCount, total: expectedRatings(season) })}
      </div>

      <div className="schedule-actions">
        <Link to={`/event/${season.id}/${event.id}`} className="btn btn-ghost btn-sm">
          {t("season.openHost")}
        </Link>
      </div>
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
  const events = [...season.events].sort((a, b) => a.date.localeCompare(b.date));
  const myName = myClaim ? season.players.find((p) => p.id === myClaim)?.name : undefined;

  function remove() {
    if (season && confirm(t("season.deleteConfirm"))) {
      store.deleteSeason(season.id);
      navigate("/");
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

        <div className={`reveal-banner ${revealStatus(season, ratings).revealed ? "is-open" : "is-locked"}`}>
          <strong>
            {revealStatus(season, ratings).revealed
              ? t("season.reveal.unlocked")
              : t("season.reveal.locked")}
          </strong>
          <span className="muted">
            {revealStatus(season, ratings).revealed
              ? t("season.reveal.unlockedBody")
              : t("season.reveal.lockedBody")}
          </span>
          {revealStatus(season, ratings).revealed && (
            <Link to={`/season/${season.id}/results`} className="btn btn-primary btn-sm">
              {t("season.results")}
            </Link>
          )}
        </div>

        <h2 className="subhead">{t("season.schedule")}</h2>
        <p className="muted small">{t("season.shareHint")}</p>

        <div className="schedule">
          {events.map((event) => {
            const count = ratingsForEvent(event, ratings).length;
            const canEdit = isOwner || (!!myClaim && myClaim === event.hostId);
            return (
              <DinnerRow
                key={event.id}
                season={season}
                event={event}
                ratingsCount={count}
                canEdit={canEdit}
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
