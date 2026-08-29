import { Link, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useDB } from "../store/hooks";
import QRCode from "../components/QRCode";
import CopyLink from "../components/CopyLink";
import { expectedRatings, isEventComplete, ratingsForEvent } from "../domain/reveal";

export default function EventDay() {
  const { t } = useI18n();
  const { id } = useParams();
  const { seasons, ratings } = useDB();

  const season = seasons.find((s) => s.events.some((e) => e.id === id));
  const event = season?.events.find((e) => e.id === id);

  if (!season || !event) {
    return (
      <section className="section">
        <div className="container center-narrow">
          <h1 className="section-title">{t("join.notFoundTitle")}</h1>
          <Link to="/" className="btn btn-primary">
            {t("notFound.back")}
          </Link>
        </div>
      </section>
    );
  }

  const host = season.players.find((p) => p.id === event.hostId);
  const done = ratingsForEvent(event, ratings).length;
  const expected = expectedRatings(season);
  const closed = isEventComplete(event, season, ratings);
  const joinUrl = `${window.location.origin}/join/${event.code}`;

  return (
    <section className="section">
      <div className="container center-narrow event-day">
        <p className="eyebrow">{t("event.title")}</p>
        <h1 className="section-title">{t("event.hostedBy", { host: host?.name ?? "—" })}</h1>

        {closed ? (
          <p className="event-closed">{t("event.closed")}</p>
        ) : (
          <>
            <p className="muted">{t("event.scanToRate")}</p>
            <div className="qr-wrap">
              <QRCode value={joinUrl} />
            </div>
            <p className="join-code">
              {t("event.orEnterCode")} <strong>{window.location.host}</strong>
              <br />
              <span className="code-big">{event.code}</span>
            </p>
            <CopyLink value={joinUrl} />
          </>
        )}

        <p className="muted progress">
          {t("event.rated", { done, total: expected })}
        </p>

        <Link to={`/season/${season.id}`} className="btn btn-ghost btn-sm">
          {t("event.backToSeason")}
        </Link>
      </div>
    </section>
  );
}
