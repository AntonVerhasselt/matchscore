"use node";

import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { OTP_EXPIRES_IN_MINUTES } from "../emails/OtpSignInEmail";
import { renderEmail } from "../emails/registry";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

const fromAddress =
  process.env.AUTH_FROM_EMAIL ?? "Anton van Matchscore <info@mail.matchscore.be>";

const resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

export const sendOtpEmail = internalAction({
  args: {
    to: v.string(),
    otp: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const { html, subject } = await renderEmail("otp-sign-in", {
        otp: args.otp,
        expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
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
        error,
      });
      throw error;
    }

    return null;
  },
});
