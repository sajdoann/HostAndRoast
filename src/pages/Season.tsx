import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/useAuth";
import { store } from "../store";
import { useDB, useMyClaim, useSeasonView } from "../store/hooks";
import Loading from "../components/Loading";
import MenuModal from "../components/MenuModal";
import LocationLine from "../components/LocationLine";
import QRCode from "../components/QRCode";
import CopyLink from "../components/CopyLink";
import { compareEventDates, todayISO } from "../domain/schedule";
import { expectedRatings, householdVotes, revealStatus } from "../domain/reveal";
import { categoriesFor } from "../domain/categories";
import { hostNameOf, isHostHousehold } from "../domain/households";
import { safeLocationUrl } from "../domain/location";
import { genId } from "../domain/ids";
import type { DinnerEvent, Player, Season as SeasonModel } from "../domain/types";

function statusKey(event: DinnerEvent, season: SeasonModel, ratingsIn: number): string {
  if (ratingsIn >= expectedRatings(season)) return "complete";
  if (!event.date) return "unscheduled";
  const today = todayISO();
  if (event.date === today) return "today";
  if (event.date < today) return "past";
  return "upcoming";
}

/** One dinner row: editable (owner or its cook) or read-only. */
function DinnerRow({
  season,
  event,
  ratingsCount,
  canEdit,
  isCook,
}: {
  season: SeasonModel;
  event: DinnerEvent;
  ratingsCount: number;
  canEdit: boolean;
  isCook: boolean;
}) {
  const { t } = useI18n();
  const [meal, setMeal] = useState(event.mealDescription ?? "");
  const [locationUrl, setLocationUrl] = useState(event.locationUrl ?? "");
  const [locationNote, setLocationNote] = useState(event.locationNote ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const hostName = hostNameOf(season, event.hostId);
  const key = statusKey(event, season, ratingsCount);

  function saveMeal() {
    if ((event.mealDescription ?? "") !== meal.trim()) {
      store.updateEvent(season.id, { ...event, mealDescription: meal.trim() });
    }
  }

  function saveLocation() {
    // Keep whatever they typed, but only store a link we'd be willing to open.
    const url = safeLocationUrl(locationUrl);
    const note = locationNote.trim();
    if ((event.locationUrl ?? "") === (url ?? "") && (event.locationNote ?? "") === note) return;
    setLocationUrl(url ?? "");
    store.updateEvent(season.id, {
      ...event,
      locationUrl: url,
      locationNote: note || undefined,
    });
  }

  return (
    <div className="schedule-row card">
      <div className="schedule-host">
        <strong>{hostName}</strong>
        <span className={`pill pill-${key}`}>{t(`season.status.${key}`)}</span>
      </div>

      {canEdit ? (
        <input
          className="schedule-date"
          type="date"
          value={event.date ?? ""}
          onChange={(e) =>
            store.updateEvent(season.id, { ...event, date: e.target.value || undefined })
          }
        />
      ) : (
        <span className="schedule-date muted">
          {event.date || t("season.status.unscheduled")}
        </span>
      )}

      {canEdit ? (
        <div className="dinner-details">
          <textarea
            className="meal-input"
            rows={3}
            value={meal}
            placeholder={t("season.mealPlaceholder")}
            onChange={(e) => setMeal(e.target.value)}
            onBlur={saveMeal}
          />
          <input
            className="location-input"
            type="url"
            inputMode="url"
            value={locationUrl}
            placeholder={t("season.locationUrlPlaceholder")}
            onChange={(e) => setLocationUrl(e.target.value)}
            onBlur={saveLocation}
          />
          <input
            className="location-input"
            value={locationNote}
            placeholder={t("season.locationNotePlaceholder")}
            onChange={(e) => setLocationNote(e.target.value)}
            onBlur={saveLocation}
          />
        </div>
      ) : (
        <LocationLine event={event} />
      )}

      <div className="schedule-meta muted">
        <code>{event.code}</code> ·{" "}
        {t("season.rated", { done: ratingsCount, total: expectedRatings(season) })}
      </div>

      <div className="schedule-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(true)}>
          {t("menu.view")}
        </button>
        {isCook ? (
          // The cook can't rate their own dinner — they get the QR to present.
          <Link to={`/event/${season.id}/${event.id}`} className="btn btn-ghost btn-sm">
            {t("season.showQr")}
          </Link>
        ) : (
          // Everyone else goes straight to rating (QR is one tap away from there).
          <Link to={`/join/${event.code}`} className="btn btn-primary btn-sm">
            {t("season.rate")}
          </Link>
        )}
      </div>
      {menuOpen && (
        <MenuModal
          hostName={hostName}
          text={event.mealDescription}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

/** One player's name in the owner's manage panel: editable inline, save on blur. */
function PlayerRow({
  season,
  player,
  canRemove,
  onRemove,
}: {
  season: SeasonModel;
  player: Player;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(player.name);

  function save() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== player.name) {
      store.renamePlayer(season.id, player.id, trimmed);
    } else {
      setName(player.name);
    }
  }

  // Who this player could cook with: anyone leading their own kitchen. Someone
  // already cooking with this player isn't offered — that's the same kitchen.
  const canCookWith = season.players.filter(
    (p) => p.id !== player.id && !p.householdId && p.householdId !== player.id
  );
  const cooksWith = player.householdId ?? "";

  return (
    <div className="manage-row">
      <input className="manage-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
      <select
        className="manage-household"
        value={cooksWith}
        aria-label={t("season.cooksWith")}
        onChange={(e) => store.setHousehold(season.id, player.id, e.target.value || undefined)}
      >
        <option value="">{t("season.cooksAlone")}</option>
        {canCookWith.map((p) => (
          <option key={p.id} value={p.id}>
            {t("season.cooksWithName", { name: p.name })}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-ghost btn-sm danger"
        disabled={!canRemove}
        title={canRemove ? undefined : t("new.needPlayers")}
        onClick={onRemove}
      >
        {t("new.remove")}
      </button>
    </div>
  );
}

/** Owner-only: add/remove players and rating categories. Collapsed by default. */
function SeasonManage({ season }: { season: SeasonModel }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const categories = categoriesFor(season, (id) => t(`categories.${id}`));

  function addPlayer(e: FormEvent) {
    e.preventDefault();
    const name = newPlayerName.trim();
    if (!name) return;
    store.addPlayer(season.id, name);
    setNewPlayerName("");
  }

  function removePlayer(playerId: string, name: string) {
    if (confirm(t("season.removePlayerConfirm", { name }))) {
      store.removePlayer(season.id, playerId);
    }
  }

  function addCategory(e: FormEvent) {
    e.preventDefault();
    const label = newCategoryLabel.trim();
    if (!label) return;
    store.updateCategories(season.id, [...categories, { id: genId(), label }]);
    setNewCategoryLabel("");
  }

  function removeCategory(categoryId: string) {
    store.updateCategories(
      season.id,
      categories.filter((c) => c.id !== categoryId)
    );
  }

  return (
    <div className="manage-panel card">
      <button type="button" className="manage-toggle" onClick={() => setOpen((o) => !o)}>
        <strong>{t("season.manage")}</strong>
        <span className="muted small">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="manage-body">
          <div className="manage-section">
            <h3 className="manage-heading">{t("season.players")}</h3>
            <div className="manage-list">
              {season.players.map((p) => (
                <PlayerRow
                  key={p.id}
                  season={season}
                  player={p}
                  canRemove={season.players.length > 2}
                  onRemove={() => removePlayer(p.id, p.name)}
                />
              ))}
            </div>
            <p className="muted small">{t("season.householdsHelp")}</p>
            <form className="manage-add-row" onSubmit={addPlayer}>
              <input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder={t("new.playerPlaceholder")}
              />
              <button type="submit" className="btn btn-ghost btn-sm">
                + {t("new.addPlayer")}
              </button>
            </form>
          </div>

          <div className="manage-section">
            <h3 className="manage-heading">{t("new.categories")}</h3>
            <div className="manage-chips">
              {categories.map((c) => (
                <span key={c.id} className="manage-chip">
                  {c.label}
                  <button
                    type="button"
                    className="chip-remove"
                    disabled={categories.length <= 1}
                    title={categories.length > 1 ? undefined : t("new.needCategory")}
                    aria-label={t("new.remove")}
                    onClick={() => removeCategory(c.id)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <form className="manage-add-row" onSubmit={addCategory}>
              <input
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                placeholder={t("new.categoryPlaceholder")}
              />
              <button type="submit" className="btn btn-ghost btn-sm">
                + {t("new.addCategory")}
              </button>
            </form>
            <p className="muted small">{t("season.categoriesNote")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Season() {
  const { t, lang } = useI18n();
  const { user, required } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { season, ratings, loaded } = useSeasonView(id);
  const myClaim = useMyClaim(id);
  const { revealed } = useDB();
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  if (!loaded) return <Loading />;

  if (!season) {
    return (
      <section className="section">
        <div className="container center-narrow">
          <p className="muted">{t("notFound.body")}</p>
          <Link to="/" className="btn btn-primary">
            {t("notFound.back")}
          </Link>
        </div>
      </section>
    );
  }

  const isOwner = !required || (!!user && season.ownerId === user.uid);
  const events = [...season.events].sort(compareEventDates);
  const myName = myClaim ? season.players.find((p) => p.id === myClaim)?.name : undefined;
  const isRevealed = revealed.includes(season.id);
  const rstatus = revealStatus(season, ratings);
  const claimedPlayers = store.claimedPlayers(season.id);
  const seasonJoinUrl = season.code
    ? `${window.location.origin}/s/${season.code}`
    : `${window.location.origin}/season/${season.id}`;

  function remove() {
    if (season && confirm(t("season.deleteConfirm"))) {
      store.deleteSeason(season.id);
      navigate("/");
    }
  }

  async function reveal() {
    if (!season || revealing) return;
    if (!rstatus.allRatingsIn && !confirm(t("season.revealPartialConfirm"))) return;
    setRevealing(true);
    setRevealError(null);
    try {
      await store.revealSeason(season.id);
      navigate(`/season/${season.id}/results`);
    } catch (e) {
      console.error("[reveal] failed:", e);
      setRevealError(t("season.revealError"));
    } finally {
      setRevealing(false);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">{season.name}</h1>

        {/* Identity: claim your nickname once (signed-in participants). */}
        {required &&
          (user ? (
            myName ? (
              <p className="muted small">{t("season.youAre", { name: myName })}</p>
            ) : (
              <div className="claim-box card">
                <strong>{t("season.claimTitle")}</strong>
                <p className="muted small">{t("season.claimHelp")}</p>
                <div className="claim-names">
                  {season.players.map((p) => {
                    // Nicknames are first-come-first-served, so the ones
                    // already spoken for are shown as such rather than failing
                    // on click.
                    const taken = claimedPlayers.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="name-btn"
                        disabled={taken}
                        onClick={() => {
                          setClaimError(null);
                          store
                            .claimPlayer(season.id, user.uid, p.id)
                            .catch(() => setClaimError(t("season.claimError")));
                        }}
                      >
                        {p.name}
                        {taken && (
                          <span className="muted small"> · {t("season.claimTakenBadge")}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {claimError && <p className="form-error">{claimError}</p>}
              </div>
            )
          ) : null)}

        <div className={`reveal-banner ${isRevealed ? "is-open" : "is-locked"}`}>
          <strong>
            {isRevealed ? t("season.reveal.unlocked") : t("season.reveal.locked")}
          </strong>
          <span className="muted">
            {isRevealed
              ? t("season.reveal.unlockedBody")
              : isOwner
                ? // Dinners with no date block the auto-reveal silently, so
                  // name that before the ratings count.
                  rstatus.unscheduled > 0
                  ? t("season.revealUnscheduled", { n: rstatus.unscheduled })
                  : rstatus.allRatingsIn
                    ? t("season.revealReady")
                    : t("season.revealMissing", { n: rstatus.missingRatings })
                : t("season.reveal.lockedBody")}
          </span>
          {isRevealed ? (
            <Link to={`/season/${season.id}/results`} className="btn btn-primary btn-sm">
              {t("season.results")}
            </Link>
          ) : isOwner ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={reveal}
              disabled={revealing}
            >
              {revealing ? t("common.loading") : t("season.revealNow")}
            </button>
          ) : null}
        </div>
        {revealError && <p className="form-error">{revealError}</p>}

        {isOwner && <SeasonManage season={season} />}

        <h2 className="subhead">{t("season.schedule")}</h2>
        <p className="muted small">{t("season.shareHint")}</p>

        <div className="season-share">
          <p className="muted small">{t("season.scanToJoin")}</p>
          <div className="qr-wrap">
            <QRCode value={seasonJoinUrl} size={180} />
          </div>
          {season.code && (
            <p className="join-code">
              {t("season.orEnterCode")} <strong>{window.location.host}</strong>
              <br />
              <span className="code-big">{season.code}</span>
            </p>
          )}
          <CopyLink value={seasonJoinUrl} />
        </div>

        <div className="schedule">
          {events.map((event) => {
            const count = householdVotes(event, season, ratings);
            const isCook = isHostHousehold(season, event.hostId, myClaim);
            const canEdit = isOwner || isCook;
            return (
              <DinnerRow
                key={event.id}
                season={season}
                event={event}
                ratingsCount={count}
                canEdit={canEdit}
                isCook={isCook}
              />
            );
          })}
        </div>

        {season.revealAt && (
          <p className="muted small">
            {t("season.deadline")}:{" "}
            {new Date(season.revealAt).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-GB")}
          </p>
        )}

        {isOwner && (
          <div className="season-footer">
            <button className="btn btn-ghost btn-sm danger" onClick={remove}>
              {t("season.delete")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
