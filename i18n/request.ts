import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  isValidLocale,
  LOCALE_COOKIE_NAME,
  type Locale,
} from "./config";
import { detectFromAcceptLanguage } from "./detect-locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  let locale: Locale;
  if (isValidLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const headerStore = await headers();
    locale = detectFromAcceptLanguage(headerStore.get("accept-language"));
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
