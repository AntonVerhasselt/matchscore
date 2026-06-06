import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const fromAddress =
  process.env.AUTH_FROM_EMAIL ?? "Matchscore <onboarding@resend.dev>";

const PASSWORD_RESET_TEMPLATE_ID = "caa1f777-b81d-4728-b75d-be1a19900776";
const EMAIL_VERIFICATION_TEMPLATE_ID = "6e021626-b718-46c4-9593-08e6ad66c378";

const resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

export const sendPasswordResetEmail = internalMutation({
  args: {
    to: v.string(),
    url: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await resend.sendEmail(ctx, {
        from: fromAddress,
        to: args.to,
        template: {
          id: PASSWORD_RESET_TEMPLATE_ID,
          variables: {
            name: args.name ?? "",
            password_reset_link: args.url,
          },
        },
      });
    } catch (error) {
      console.error("Failed to send password reset email", {
        to: args.to,
        error,
      });
    }
    return null;
  },
});

export const sendVerificationEmail = internalMutation({
  args: {
    to: v.string(),
    url: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await resend.sendEmail(ctx, {
        from: fromAddress,
        to: args.to,
        template: {
          id: EMAIL_VERIFICATION_TEMPLATE_ID,
          variables: {
            name: args.name ?? "",
            verification_link: args.url,
          },
        },
      });
    } catch (error) {
      console.error("Failed to send verification email", {
        to: args.to,
        error,
      });
    }
    return null;
  },
});
