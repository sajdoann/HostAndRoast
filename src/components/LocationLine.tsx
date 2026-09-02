import { useI18n } from "../i18n";
import { safeLocationUrl } from "../domain/location";
import type { DinnerEvent } from "../domain/types";

/**
 * Where a dinner is: the directions in words, linked to the map when the host
 * gave one. The link is only rendered once `safeLocationUrl` has vetted its
 * scheme, since this href comes from whatever the host pasted.
 */
export default function LocationLine({
  event,
  className = "location-line",
}: {
  event: Pick<DinnerEvent, "locationUrl" | "locationNote">;
  className?: string;
}) {
  const { t } = useI18n();
  const url = safeLocationUrl(event.locationUrl);
  const note = event.locationNote?.trim();

  if (!url && !note) return <span className={className} />;

  const label = note || t("season.locationOpenMap");

  return (
    <span className={className}>
      📍{" "}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}
