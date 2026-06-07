import { OTP_EXPIRES_IN_MINUTES } from "./OtpSignInEmail";
import { renderEmailTemplate } from "../lib/emails/render";
import { loadEmailMessages } from "../lib/i18n/load-email-messages";
import { defaultLocale, isValidLocale } from "../i18n/config";
import type { EmailTemplateDefinition } from "../lib/emails/types";
import { otpSignInEmail } from "./OtpSignInEmail";

const templateList = [otpSignInEmail] as const;

export const emailTemplates = Object.fromEntries(
  templateList.map((template) => [template.slug, template]),
) as Record<
  (typeof templateList)[number]["slug"],
  (typeof templateList)[number]
>;

export type EmailTemplateSlug = keyof typeof emailTemplates;

export type EmailTemplatePropsMap = {
  [K in EmailTemplateSlug]: Parameters<
    (typeof emailTemplates)[K]["subject"]
  >[0];
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

export async function renderEmail<Slug extends EmailTemplateSlug>(
  slug: Slug,
  props: EmailTemplatePropsMap[Slug],
) {
  const template = emailTemplates[slug];
  return renderForTemplate(template, props);
}

export async function renderEmailPreview<Slug extends EmailTemplateSlug>(
  slug: Slug,
  locale: string = defaultLocale,
) {
  const template = emailTemplates[slug];
  const resolvedLocale = isValidLocale(locale) ? locale : defaultLocale;

  const props =
    slug === "otp-sign-in"
      ? {
          otp: "123456",
          expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
          messages: loadEmailMessages(resolvedLocale),
        }
      : template.previewProps;

  return renderForTemplate(template, props as EmailTemplatePropsMap[Slug]);
}
