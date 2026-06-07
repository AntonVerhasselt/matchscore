import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { requireActionCtx, requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import authConfig from "../auth.config";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    plugins: [
      convex({ authConfig }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in") {
            return;
          }

          const locale = await requireRunMutationCtx(ctx).runQuery(
            internal.users.emailLocales.getLocaleForEmail,
            { email },
          );

          await requireActionCtx(ctx).runAction(
            internal.emails.actions.sendOtpEmail,
            {
              to: email,
              otp,
              locale,
            },
          );
        },
      }),
    ],
  });
};
