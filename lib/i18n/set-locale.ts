"use server";

import { api } from "@/convex/_generated/api";
import {
  isValidLocale,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  type Locale,
} from "@/i18n/config";
import {
  fetchAuthMutation,
  isAuthenticated,
} from "@/lib/auth-server";
import { cookies } from "next/headers";

export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isValidLocale(locale)) {
    return { ok: false };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });

  if (await isAuthenticated()) {
    await fetchAuthMutation(api.userSettings.updateUserLocale, {
      locale: locale as Locale,
    });
  }

  return { ok: true };
}
