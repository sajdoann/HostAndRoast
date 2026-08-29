import { useState } from "react";
import { useI18n } from "../i18n";

/** Copies `value` to the clipboard, with a brief "Copied!" confirmation. */
export default function CopyLink({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
      {copied ? t("common.copied") : t("common.copy")}
    </button>
  );
}
