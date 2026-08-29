import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { store } from "../store";
import { useSeason, useSeasonRatings } from "../store/hooks";
import { todayISO } from "../domain/schedule";
import {
  expectedRatings,
  isEventComplete,
  ratingsForEvent,
  revealStatus,
} from "../domain/reveal";
import type { DinnerEvent, Season as SeasonModel } from "../domain/types";

function statusKey(event: DinnerEvent, season: SeasonModel, ratingsIn: number): string {
  if (ratingsIn >= expectedRatings(season)) return "complete";
  const today = todayISO();
  if (event.date === today) return "today";
  if (event.date < today) return "past";
  return "upcoming";
}

export default function Season() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const season = useSeason(id);
  const ratings = useSeasonRatings(season);

  if (!season) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">{t("notFound.body")}</p>
          <Link to="/" className="btn btn-primary">
            {t("notFound.back")}
          </Link>
        </div>
      </section>
    );
  }

  const reveal = revealStatus(season, ratings);
  const hostName = (hostId: string) =>
    season.players.find((p) => p.id === hostId)?.name ?? "—";
  const events = [...season.events].sort((a, b) => a.date.localeCompare(b.date));

  function editDate(eventId: string, date: string) {
    if (!season || !date) return;
    store.updateSeason({
      ...season,
      events: season.events.map((e) => (e.id === eventId ? { ...e, date } : e)),
    });
  }

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

        <div className={`reveal-banner ${reveal.revealed ? "is-open" : "is-locked"}`}>
          <strong>
            {reveal.revealed ? t("season.reveal.unlocked") : t("season.reveal.locked")}
          </strong>
          <span className="muted">
            {reveal.revealed
              ? t("season.reveal.unlockedBody")
              : t("season.reveal.lockedBody")}
          </span>
          {reveal.revealed && (
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
            const expected = expectedRatings(season);
            const key = statusKey(event, season, count);
            const complete = isEventComplete(event, season, ratings);
            return (
              <div key={event.id} className="schedule-row card">
                <div className="schedule-host">
                  <strong>{hostName(event.hostId)}</strong>
                  <span className={`pill pill-${key}`}>{t(`season.status.${key}`)}</span>
                </div>
                <input
                  className="schedule-date"
                  type="date"
                  value={event.date}
                  onChange={(e) => editDate(event.id, e.target.value)}
                />
                <div className="schedule-meta muted">
                  <code>{event.code}</code> · {t("season.rated", { done: count, total: expected })}
                </div>
                <div className="schedule-actions">
                  <Link
                    to={`/event/${event.id}`}
                    className="btn btn-ghost btn-sm"
                    aria-disabled={complete}
                  >
                    {t("season.openHost")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {season.revealAt && (
          <p className="muted small">
            {t("season.deadline")}:{" "}
            {new Date(season.revealAt).toLocaleDateString(
              lang === "cs" ? "cs-CZ" : "en-GB"
            )}
          </p>
        )}

        <div className="season-footer">
          <button className="btn btn-ghost btn-sm danger" onClick={remove}>
            {t("season.delete")}
          </button>
        </div>
      </div>
    </section>
  );
}
