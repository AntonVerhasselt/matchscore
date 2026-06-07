export const locales = ["nl", "fr", "en", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "nl";

export const unsupportedFallback: Locale = "en";

export const LOCALE_COOKIE_NAME = "MATCHSCORE_LOCALE";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isValidLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}

export const localeLabels: Record<Locale, string> = {
  nl: "Nederlands",
  fr: "Français",
  en: "English",
  de: "Deutsch",
};
