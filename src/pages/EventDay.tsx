import { Link, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useMyClaim, useSeasonView } from "../store/hooks";
import Loading from "../components/Loading";
import QRCode from "../components/QRCode";
import CopyLink from "../components/CopyLink";
import MenuCard from "../components/MenuCard";
import { expectedRatings, isEventComplete, ratingsForEvent } from "../domain/reveal";

export default function EventDay() {
  const { t } = useI18n();
  const { seasonId, eventId } = useParams();
  const { season, ratings, loaded } = useSeasonView(seasonId);
  const myClaim = useMyClaim(seasonId);

  if (!loaded) return <Loading />;

  const event = season?.events.find((e) => e.id === eventId);

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
  // The cook can't rate their own dinner; everyone else gets a direct rate link.
  const isCook = !!myClaim && myClaim === event.hostId;

  return (
    <section className="section">
      <div className="container center-narrow event-day">
        <p className="eyebrow">{t("event.title")}</p>
        <h1 className="section-title">{t("event.hostedBy", { host: host?.name ?? "—" })}</h1>

        {closed ? (
          <p className="event-closed">{t("event.closed")}</p>
        ) : (
          <>
            {!isCook && (
              <Link to={`/join/${event.code}`} className="btn btn-primary rate-cta">
                {t("event.rateThis")}
              </Link>
            )}
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

        <MenuCard text={event.mealDescription} />

        <p className="muted progress">{t("event.rated", { done, total: expected })}</p>

        <Link to={`/season/${season.id}`} className="btn btn-ghost btn-sm">
          {t("event.backToSeason")}
        </Link>
      </div>
    </section>
  );
}
