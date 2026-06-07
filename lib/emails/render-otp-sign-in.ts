import { render } from "@react-email/render";
import { OtpSignInEmail } from "../../emails/OtpSignInEmail";
import type { OtpSignInEmailProps } from "../../emails/types";

export const OTP_EXPIRES_IN_MINUTES = 5;

export async function renderOtpSignInEmail(
  props: OtpSignInEmailProps,
): Promise<{ html: string; subject: string }> {
  const html = await render(
    OtpSignInEmail({
      expiresInMinutes: props.expiresInMinutes,
      otp: props.otp,
    }),
  );

  return {
    html,
    subject: `${props.otp} is your Matchscore sign-in code`,
  };
}
