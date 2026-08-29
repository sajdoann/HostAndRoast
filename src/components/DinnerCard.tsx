import { useI18n } from "../i18n";
import { formatPrice, type Dinner } from "../data/dinners";

export default function DinnerCard({ dinner }: { dinner: Dinner }) {
  const { t, lang } = useI18n();

  const dateLabel = new Date(dinner.date).toLocaleDateString(
    lang === "cs" ? "cs-CZ" : "en-GB",
    { day: "numeric", month: "long" }
  );

  return (
    <article className="card dinner-card">
      <div className="dinner-image" aria-hidden="true">
        {dinner.image}
      </div>
      <div className="dinner-body">
        <h3 className="dinner-title">{dinner.title}</h3>
        <p className="muted dinner-meta">
          {dinner.host} · {dinner.city} · {dateLabel}
        </p>
        <div className="dinner-footer">
          <div>
            <strong>{formatPrice(dinner)}</strong>{" "}
            <span className="muted">{t("dinners.perSeat")}</span>
            <div className="seats-left">
              {t("dinners.seatsLeft").replace("{count}", String(dinner.seatsLeft))}
            </div>
          </div>
          {/* TODO(stripe): open checkout for this dinner. */}
          <button className="btn btn-primary">{t("dinners.book")}</button>
        </div>
      </div>
    </article>
  );
}
