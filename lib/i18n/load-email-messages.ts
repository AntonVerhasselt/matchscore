import { isValidLocale, type Locale } from "../../i18n/config";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import nl from "../../messages/nl.json";

export type EmailMessages = {
  preview: string;
  body: string;
  expiresIn: string;
  footer: string;
  subject: string;
};

const emailMessagesByLocale: Record<Locale, EmailMessages> = {
  nl: nl.email,
  en: en.email,
  fr: fr.email,
  de: de.email,
};

export function loadEmailMessages(locale: string): EmailMessages {
  const resolvedLocale: Locale = isValidLocale(locale) ? locale : "nl";
  return emailMessagesByLocale[resolvedLocale];
}
