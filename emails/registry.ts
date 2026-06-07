import { OTP_EXPIRES_IN_MINUTES } from "./OtpSignInEmail";
import { renderEmailTemplate } from "../lib/emails/render";
import { loadEmailMessages } from "../lib/i18n/load-email-messages";
import { defaultLocale, isValidLocale } from "../i18n/config";
import type { EmailTemplateDefinition } from "../lib/emails/types";
import {
  ORG_INVITATION_EXPIRES_IN_DAYS,
  organizationInvitationEmail,
  type OrganizationInvitationEmailProps,
} from "./OrganizationInvitationEmail";
import { otpSignInEmail, type OtpSignInEmailProps } from "./OtpSignInEmail";

const templateList = [otpSignInEmail, organizationInvitationEmail] as const;

export const emailTemplates = Object.fromEntries(
  templateList.map((template) => [template.slug, template]),
) as Record<
  (typeof templateList)[number]["slug"],
  (typeof templateList)[number]
>;

export type EmailTemplateSlug = keyof typeof emailTemplates;

export type EmailTemplatePropsMap = {
  "otp-sign-in": OtpSignInEmailProps;
  "org-invitation": OrganizationInvitationEmailProps;
};

function renderForTemplate<TProps extends Record<string, unknown>>(
  template: EmailTemplateDefinition<TProps>,
  props: TProps,
) {
  return renderEmailTemplate(
    template.Component(props),
    template.subject(props),
  );
}

export function listEmailTemplates() {
  return Object.values(emailTemplates);
}

export function getEmailTemplate(slug: string) {
  return emailTemplates[slug as EmailTemplateSlug] ?? null;
}

export async function renderEmail(
  slug: "otp-sign-in",
  props: OtpSignInEmailProps,
): Promise<{ html: string; subject: string }>;
export async function renderEmail(
  slug: "org-invitation",
  props: OrganizationInvitationEmailProps,
): Promise<{ html: string; subject: string }>;
export async function renderEmail(
  slug: EmailTemplateSlug,
  props: OtpSignInEmailProps | OrganizationInvitationEmailProps,
) {
  if (slug === "otp-sign-in") {
    const otpProps = props as OtpSignInEmailProps;
    return renderEmailTemplate(
      otpSignInEmail.Component(otpProps),
      otpSignInEmail.subject(otpProps),
    );
  }

  const invitationProps = props as OrganizationInvitationEmailProps;
  return renderEmailTemplate(
    organizationInvitationEmail.Component(invitationProps),
    organizationInvitationEmail.subject(invitationProps),
  );
}

export async function renderEmailPreview(
  slug: EmailTemplateSlug,
  locale: string = defaultLocale,
) {
  const resolvedLocale = isValidLocale(locale) ? locale : defaultLocale;
  const messages = loadEmailMessages(resolvedLocale);

  if (slug === "otp-sign-in") {
    return renderForTemplate(otpSignInEmail, {
      otp: "123456",
      expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
      messages,
    });
  }

  return renderForTemplate(organizationInvitationEmail, {
    inviterName: "Alex",
    organizationName: "FC Example",
    acceptUrl: "https://matchscore.be/accept-invitation/example-token",
    expiresInDays: ORG_INVITATION_EXPIRES_IN_DAYS,
    messages: messages.orgInvitation,
  });
}
