import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/useAuth";
import { store } from "../store";
import { genCode, genId } from "../domain/ids";
import { buildSchedule, todayISO, type RecurrenceUnit } from "../domain/schedule";
import type { Player, Season } from "../domain/types";

const LOCAL_OWNER = "local";

export default function NewSeason() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, required, signIn, error: authError } = useAuth();

  const [name, setName] = useState("");
  const [names, setNames] = useState<string[]>(["", ""]);
  const [startDate, setStartDate] = useState(todayISO());
  const [repeatValue, setRepeatValue] = useState(1);
  const [repeatUnit, setRepeatUnit] = useState<RecurrenceUnit>("week");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");

  function setNameAt(i: number, value: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }
  function addPlayer() {
    setNames((prev) => [...prev, ""]);
  }
  function removePlayer(i: number) {
    setNames((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (!name.trim()) return setError(t("new.needName"));
    if (clean.length < 2) return setError(t("new.needPlayers"));

    if (required && !user) return setError(t("auth.needSignIn"));

    const players: Player[] = clean.map((n) => ({ id: genId(), name: n }));
    const seasonId = genId();
    const season: Season = {
      id: seasonId,
      name: name.trim(),
      ownerId: user?.uid ?? LOCAL_OWNER,
      players,
      events: buildSchedule(seasonId, players, startDate, {
        value: repeatValue,
        unit: repeatUnit,
      }),
      code: genCode(),
      revealAt: deadline ? new Date(`${deadline}T23:59:59`).getTime() : undefined,
      createdAt: Date.now(),
    };

    store.createSeason(season);
    navigate(`/season/${seasonId}`);
  }

  if (required && !user) {
    return (
      <section className="section">
        <div className="container narrow center-narrow">
          <h1 className="section-title">{t("new.title")}</h1>
          <p className="muted">{t("auth.signInToCreate")}</p>
          <button className="btn btn-primary" onClick={() => void signIn()}>
            {t("auth.signInGoogle")}
          </button>
          {authError && <p className="form-error">{authError}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container narrow">
        <h1 className="section-title">{t("new.title")}</h1>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>{t("new.seasonName")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("new.seasonNamePlaceholder")}
            />
          </label>

          <fieldset className="field">
            <legend>{t("new.players")}</legend>
            <p className="muted small">{t("new.playersHelp")}</p>
            {names.map((n, i) => (
              <div key={i} className="player-row">
                <input
                  value={n}
                  onChange={(e) => setNameAt(i, e.target.value)}
                  placeholder={t("new.playerPlaceholder")}
                />
                {names.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removePlayer(i)}
                  >
                    {t("new.remove")}
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addPlayer}>
              + {t("new.addPlayer")}
            </button>
          </fieldset>

          <div className="field-grid">
            <label className="field">
              <span>{t("new.startDate")}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("new.interval")}</span>
              <div className="repeat-row">
                <input
                  type="number"
                  min={1}
                  value={repeatValue}
                  onChange={(e) => setRepeatValue(Math.max(1, Number(e.target.value)))}
                />
                <select
                  value={repeatUnit}
                  onChange={(e) => setRepeatUnit(e.target.value as RecurrenceUnit)}
                >
                  <option value="day">{t("new.intervalUnit.day")}</option>
                  <option value="week">{t("new.intervalUnit.week")}</option>
                  <option value="month">{t("new.intervalUnit.month")}</option>
                </select>
              </div>
            </label>
          </div>

          <label className="field">
            <span>{t("new.deadline")}</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <span className="muted small">{t("new.deadlineHelp")}</span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary">
            {t("new.create")}
          </button>
        </form>
      </div>
    </section>
  );
}
