import { useI18n } from "../i18n";
import logoEn from "../assets/logo-en.png";
import logoCs from "../assets/logo-cs.png";

/** The brand emblem, swapped for the active language (EN / CS wordmark). */
export default function Logo({ className }: { className?: string }) {
  const { lang, t } = useI18n();
  const src = lang === "cs" ? logoCs : logoEn;
  return <img className={className} src={src} alt={t("brand.name")} />;
}
