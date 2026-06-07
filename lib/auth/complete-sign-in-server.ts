"use server";

import { isValidLocale } from "@/i18n/config";
import { syncLocaleOnSignIn } from "@/lib/i18n/sync-locale-on-sign-in-server";
import { redirect } from "next/navigation";
import { resolvePostSignInRedirect } from "./post-sign-in-redirect-server";

/**
 * Sync locale, resolve the post-sign-in destination, and hard-redirect.
 * Must be a server action so redirect() navigates reliably after OTP sign-in.
 */
export async function completeSignInAfterOtp(
  currentLocale: string,
  invitationToken?: string,
): Promise<never> {
  if (isValidLocale(currentLocale)) {
    try {
      await syncLocaleOnSignIn(currentLocale);
    } catch (error) {
      console.error("Failed to sync locale on sign-in:", error);
    }
  }

  const redirectPath = await resolvePostSignInRedirect(invitationToken);
  redirect(redirectPath);
}
