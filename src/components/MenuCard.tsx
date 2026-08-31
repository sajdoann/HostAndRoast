import { useI18n } from "../i18n";

/**
 * The menu text itself. `white-space: pre-wrap` (see .menu-text) keeps the
 * cook's line breaks, indentation and emoji exactly as they typed them.
 */
export function MenuBody({ text }: { text?: string }) {
  const { t } = useI18n();
  const value = (text ?? "").trim();
  if (!value) return <p className="menu-empty">{t("menu.empty")}</p>;
  return <div className="menu-text">{value}</div>;
}

/** Fancy bordered menu card, shown inline under the QR on the host view. */
export default function MenuCard({ text }: { text?: string }) {
  const { t } = useI18n();
  return (
    <div className="menu-card">
      <div className="menu-heading">{t("menu.heading")}</div>
      <MenuBody text={text} />
    </div>
  );
}
