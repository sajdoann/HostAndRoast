import { LANGUAGES, useI18n, type Lang } from "../i18n";

const LABELS: Record<Lang, string> = { en: "EN", cs: "CZ" };

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          className={code === lang ? "lang-active" : ""}
          aria-pressed={code === lang}
          onClick={() => setLang(code)}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
