import { useEffect } from "react";
import { useI18n } from "../i18n";
import { MenuBody } from "./MenuCard";

/** Popup showing one dinner's menu. Closes on ✕, backdrop click, or Escape. */
export default function MenuModal({
  hostName,
  text,
  onClose,
}: {
  hostName: string;
  text?: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const title = t("menu.modalTitle", { host: hostName });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ✕
        </button>
        <h3 className="modal-title">{title}</h3>
        <MenuBody text={text} />
      </div>
    </div>
  );
}
