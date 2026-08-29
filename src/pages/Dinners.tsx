import { useI18n } from "../i18n";
import DinnerCard from "../components/DinnerCard";
import { DINNERS } from "../data/dinners";

export default function Dinners() {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="container">
        <p className="eyebrow">{t("brand.tagline")}</p>
        <h1 className="section-title">{t("dinners.title")}</h1>
        <p className="muted page-lead">{t("dinners.subtitle")}</p>

        {DINNERS.length === 0 ? (
          <p className="muted">{t("dinners.empty")}</p>
        ) : (
          <div className="dinner-grid">
            {DINNERS.map((dinner) => (
              <DinnerCard key={dinner.id} dinner={dinner} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
