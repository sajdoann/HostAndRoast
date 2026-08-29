import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./locales/en.json";
import cs from "./locales/cs.json";

/**
 * Minimal, dependency-free i18n.
 * Locales are flat-ish JSON; keys are addressed with dot paths, e.g. t("nav.home").
 * Add a language by dropping a new JSON file into ./locales and registering it here.
 */

export const LANGUAGES = ["en", "cs"] as const;
export type Lang = (typeof LANGUAGES)[number];

const DICTIONARIES: Record<Lang, Record<string, unknown>> = { en, cs };
const STORAGE_KEY = "hr.lang";
const DEFAULT_LANG: Lang = "en";

function resolve(dict: Record<string, unknown>, path: string): string | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict) as string | undefined;
}

function detectInitial(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && LANGUAGES.includes(stored)) return stored;
  const browser = window.navigator.language.slice(0, 2) as Lang;
  return LANGUAGES.includes(browser) ? browser : DEFAULT_LANG;
}

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    } catch {
      /* ignore storage failures */
    }
  }, []);

  const t = useCallback(
    (key: string) => resolve(DICTIONARIES[lang], key) ?? key,
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
