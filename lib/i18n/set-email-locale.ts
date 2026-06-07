"use client";

import { useMutation } from "convex/react";
import { useLocale } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/config";

export function useSetEmailLocaleForAddress() {
  const setEmailLocale = useMutation(api.userSettings.setEmailLocaleForAddress);
  const locale = useLocale() as Locale;

  return async (email: string) => {
    await setEmailLocale({ email, locale });
  };
}
