import { renderEmailTemplate } from "../lib/emails/render";
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
) {
  const template = emailTemplates[slug];
  return renderForTemplate(template, template.previewProps);
}
