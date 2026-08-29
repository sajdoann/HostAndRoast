import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import DinnerCard from "../components/DinnerCard";
import { DINNERS } from "../data/dinners";

export default function Home() {
  const { t } = useI18n();
  const featured = DINNERS.slice(0, 3);

  const steps = ["browse", "book", "feast"] as const;

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1 className="hero-title">{t("home.title")}</h1>
          <p className="hero-subtitle">{t("home.subtitle")}</p>
          <div className="hero-actions">
            <Link to="/dinners" className="btn btn-primary">
              {t("home.ctaPrimary")}
            </Link>
            <Link to="/host" className="btn btn-ghost">
              {t("home.ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">{t("home.stepsTitle")}</h2>
          <div className="steps-grid">
            {steps.map((step) => (
              <div key={step} className="step">
                <h3>{t(`home.steps.${step}Title`)}</h3>
                <p className="muted">{t(`home.steps.${step}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title">{t("home.featuredTitle")}</h2>
          <div className="dinner-grid">
            {featured.map((dinner) => (
              <DinnerCard key={dinner.id} dinner={dinner} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
