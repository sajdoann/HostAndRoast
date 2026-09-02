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
  // index → index of the player they cook with, or null for their own kitchen
  const [cooksWith, setCooksWith] = useState<(number | null)[]>([null, null]);
  const [categories, setCategories] = useState<string[]>(() => [t("categories.food")]);
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
    setCooksWith((prev) => [...prev, null]);
  }
  function removePlayer(i: number) {
    setNames((prev) => prev.filter((_, idx) => idx !== i));
    // Drop the row and re-point anyone who cooked with a now-shifted player.
    setCooksWith((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((w) => (w === i ? null : w != null && w > i ? w - 1 : w))
    );
  }
  function setCooksWithAt(i: number, value: number | null) {
    setCooksWith((prev) => prev.map((w, idx) => (idx === i ? value : w)));
  }

  function setCategoryAt(i: number, value: string) {
    setCategories((prev) => prev.map((c, idx) => (idx === i ? value : c)));
  }
  function addCategory() {
    setCategories((prev) => [...prev, ""]);
  }
  function removeCategory(i: number) {
    setCategories((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = names.map((n) => n.trim()).filter(Boolean);
    const cleanCategories = categories.map((c) => c.trim()).filter(Boolean);
    if (!name.trim()) return setError(t("new.needName"));
    if (clean.length < 2) return setError(t("new.needPlayers"));
    if (cleanCategories.length < 1) return setError(t("new.needCategory"));

    if (required && !user) return setError(t("auth.needSignIn"));

    // Keep only the rows that got a name, then turn "cooks with row N" into
    // the household lead's player id.
    const kept = names.map((n, i) => ({ name: n.trim(), i })).filter((row) => row.name);
    const players: Player[] = kept.map((row) => ({ id: genId(), name: row.name }));
    const rowToPlayer = new Map(kept.map((row, idx) => [row.i, players[idx]]));
    kept.forEach((row, idx) => {
      const lead = cooksWith[row.i] != null ? rowToPlayer.get(cooksWith[row.i]!) : undefined;
      if (lead && lead.id !== players[idx].id) players[idx].householdId = lead.id;
    });

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
      categories: cleanCategories.map((label) => ({ id: genId(), label })),
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
                <select
                  className="manage-household"
                  value={cooksWith[i] ?? ""}
                  aria-label={t("season.cooksWith")}
                  onChange={(e) =>
                    setCooksWithAt(i, e.target.value === "" ? null : Number(e.target.value))
                  }
                >
                  <option value="">{t("season.cooksAlone")}</option>
                  {names.map((other, j) =>
                    // Only offer people leading their own kitchen, so a couple
                    // can grow into a trio without tangling into a chain.
                    j === i || !other.trim() || cooksWith[j] != null ? null : (
                      <option key={j} value={j}>
                        {t("season.cooksWithName", { name: other.trim() })}
                      </option>
                    )
                  )}
                </select>
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
            <p className="muted small">{t("season.householdsHelp")}</p>
          </fieldset>

          <fieldset className="field">
            <legend>{t("new.categories")}</legend>
            <p className="muted small">{t("new.categoriesHelp")}</p>
            {categories.map((c, i) => (
              <div key={i} className="player-row">
                <input
                  value={c}
                  onChange={(e) => setCategoryAt(i, e.target.value)}
                  placeholder={t("new.categoryPlaceholder")}
                />
                {categories.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeCategory(i)}
                  >
                    {t("new.remove")}
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addCategory}>
              + {t("new.addCategory")}
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
