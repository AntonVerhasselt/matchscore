"use node";

import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { OTP_EXPIRES_IN_MINUTES } from "../emails/OtpSignInEmail";
import { renderEmail } from "../emails/registry";
import { loadEmailMessages } from "../lib/i18n/load-email-messages";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { defaultEmailLocale, localeValidator } from "./locales";

const fromAddress =
  process.env.AUTH_FROM_EMAIL ?? "Anton van Matchscore <info@mail.matchscore.be>";

const resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

export const sendOtpEmail = internalAction({
  args: {
    to: v.string(),
    otp: v.string(),
    locale: localeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale = args.locale ?? defaultEmailLocale;
    const messages = loadEmailMessages(locale);

    try {
      const { html, subject } = await renderEmail("otp-sign-in", {
        otp: args.otp,
        expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
        messages,
      });

      await resend.sendEmail(ctx, {
        from: fromAddress,
        to: args.to,
        subject,
        html,
      });
    } catch (error) {
      console.error("Failed to send OTP email", {
        to: args.to,
        locale,
        error,
      });
      throw error;
    }

    return null;
  },
});
