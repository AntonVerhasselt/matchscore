"use server";

import { api } from "@/convex/_generated/api";
import {
  fetchAuthMutation,
  fetchAuthQuery,
} from "@/lib/auth-server";
import { setLocale } from "@/lib/i18n/set-locale";
import { isValidLocale, type Locale } from "@/i18n/config";

export async function syncLocaleOnSignIn(
  currentLocale: string,
): Promise<void> {
  if (!isValidLocale(currentLocale)) {
    return;
  }

  const dbLocale = await fetchAuthQuery(api.users.settings.getUserLocale, {});

  if (dbLocale) {
    await setLocale(dbLocale);
    return;
  }

  await fetchAuthMutation(api.users.settings.updateUserLocale, {
    locale: currentLocale as Locale,
  });
}
