import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import Logo from "../components/Logo";
import { useDB } from "../store/hooks";
import { revealStatus } from "../domain/reveal";

export default function Home() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const { seasons, ratings } = useDB();

  const steps = ["create", "host", "reveal"] as const;

  function join(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) navigate(`/join/${trimmed}`);
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <Logo className="hero-logo" />
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1 className="hero-title">{t("home.title")}</h1>
          <p className="hero-subtitle">{t("home.subtitle")}</p>
          <div className="hero-actions">
            <Link to="/new" className="btn btn-primary">
              {t("home.ctaPrimary")}
            </Link>
            <form className="join-inline" onSubmit={join}>
              <input
                aria-label={t("home.codePlaceholder")}
                placeholder={t("home.codePlaceholder")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
              />
              <button className="btn btn-ghost" type="submit">
                {t("home.codeGo")}
              </button>
            </form>
          </div>
        </div>
      </section>

      {seasons.length > 0 && (
        <section className="section section-alt">
          <div className="container">
            <h2 className="section-title">{t("home.yourSeasons")}</h2>
            <div className="season-list">
              {[...seasons]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((season) => {
                  const ready = revealStatus(season, ratings).revealed;
                  return (
                    <Link key={season.id} to={`/season/${season.id}`} className="card season-tile">
                      <div>
                        <strong>{season.name}</strong>
                        <span className="muted small">
                          {" · "}
                          {t("home.playerCount", { n: season.players.length })}
                        </span>
                      </div>
                      <span className={`pill ${ready ? "pill-complete" : ""}`}>
                        {ready ? `✅ ${t("home.ready")}` : `🔒 ${t("home.sealed")}`}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>
      )}

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
    </>
  );
}
