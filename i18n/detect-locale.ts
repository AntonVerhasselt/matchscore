import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import {
  defaultLocale,
  isValidLocale,
  locales,
  unsupportedFallback,
  type Locale,
} from "./config";

function parseAcceptLanguage(header: string): string[] {
  const negotiator = new Negotiator({
    headers: { "accept-language": header },
  });
  return negotiator.languages();
}

export function detectFromAcceptLanguage(
  acceptLanguage: string | null,
): Locale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const requested = parseAcceptLanguage(acceptLanguage);
  if (requested.length === 0) {
    return defaultLocale;
  }

  try {
    const matched = match(requested, [...locales], defaultLocale);
    return isValidLocale(matched) ? matched : unsupportedFallback;
  } catch {
    return unsupportedFallback;
  }
}
