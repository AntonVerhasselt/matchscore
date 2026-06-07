import { renderEmailTemplate } from "../lib/emails/render";
import { otpSignInEmail } from "./OtpSignInEmail";

const templateList = [otpSignInEmail] as const;

export const emailTemplates = Object.fromEntries(
  templateList.map((template) => [template.slug, template]),
) as Record<
  (typeof templateList)[number]["slug"],
  (typeof templateList)[number]
>;

export type EmailTemplateSlug = keyof typeof emailTemplates;

export function listEmailTemplates() {
  return Object.values(emailTemplates);
}

export function getEmailTemplate(slug: string) {
  return emailTemplates[slug as EmailTemplateSlug] ?? null;
}

export async function renderEmail(
  slug: EmailTemplateSlug,
  props: Record<string, unknown>,
) {
  const template = emailTemplates[slug];
  return renderEmailTemplate(
    template.Component(props as never),
    template.subject(props as never),
  );
}

export async function renderEmailPreview(slug: EmailTemplateSlug) {
  const template = emailTemplates[slug];
  return renderEmailTemplate(
    template.Component(template.previewProps as never),
    template.subject(template.previewProps as never),
  );
}
