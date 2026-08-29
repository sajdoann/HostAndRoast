import { useI18n } from "../i18n";

export default function Host() {
  const { t } = useI18n();
  const benefits = ["earn", "tools", "community"] as const;

  return (
    <>
      <section className="hero hero-compact">
        <div className="container hero-inner">
          <p className="eyebrow">{t("host.eyebrow")}</p>
          <h1 className="hero-title">{t("host.title")}</h1>
          <p className="hero-subtitle">{t("host.subtitle")}</p>
          {/* TODO(auth): gate behind sign-in, then open the host onboarding flow. */}
          <button className="btn btn-primary">{t("host.cta")}</button>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">{t("host.benefitsTitle")}</h2>
          <div className="steps-grid">
            {benefits.map((benefit) => (
              <div key={benefit} className="step">
                <h3>{t(`host.benefits.${benefit}Title`)}</h3>
                <p className="muted">{t(`host.benefits.${benefit}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
