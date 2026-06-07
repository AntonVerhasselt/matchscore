import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { formatMessage } from "../lib/i18n/format-message";
import type { OrgInvitationEmailMessages } from "../lib/i18n/load-email-messages";
import { defineEmailTemplate } from "../lib/emails/types";

export type OrganizationInvitationEmailProps = {
  inviterName: string;
  organizationName: string;
  acceptUrl: string;
  expiresInDays: number;
  messages: OrgInvitationEmailMessages;
};

export const ORG_INVITATION_EXPIRES_IN_DAYS = 7;

export function OrganizationInvitationEmail({
  inviterName,
  organizationName,
  acceptUrl,
  expiresInDays,
  messages,
}: OrganizationInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {formatMessage(messages.preview, {
          inviterName,
          organizationName,
        })}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Matchscore</Heading>
          <Text style={paragraph}>
            {formatMessage(messages.body, {
              inviterName,
              organizationName,
            })}
          </Text>
          <Section style={buttonSection}>
            <Button href={acceptUrl} style={button}>
              {messages.cta}
            </Button>
          </Section>
          <Text style={paragraph}>
            {formatMessage(messages.expiresIn, {
              days: expiresInDays,
            })}
          </Text>
          <Hr style={hr} />
          <Text style={footer}>{messages.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const organizationInvitationEmail = defineEmailTemplate({
  slug: "org-invitation",
  name: "Organisation invitation",
  previewProps: {
    inviterName: "Alex",
    organizationName: "FC Example",
    acceptUrl: "https://matchscore.be/accept-invitation/example-token",
    expiresInDays: ORG_INVITATION_EXPIRES_IN_DAYS,
    messages: {
      preview: "{inviterName} invited you to join {organizationName}",
      body: "{inviterName} invited you to join {organizationName} on Matchscore.",
      cta: "Accept invitation",
      expiresIn: "This invitation expires in {days} days.",
      footer:
        "If you were not expecting this invitation, you can safely ignore this email.",
      subject: "Join {organizationName} on Matchscore",
    },
  },
  subject: ({ organizationName, messages }) =>
    formatMessage(messages.subject, { organizationName }),
  Component: OrganizationInvitationEmail,
});

const body = {
  backgroundColor: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  margin: "40px auto",
  padding: "32px",
  maxWidth: "480px",
};

const heading = {
  color: "#1e293b",
  fontSize: "24px",
  fontWeight: "700",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const paragraph = {
  color: "#475569",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
  textAlign: "center" as const,
};

const buttonSection = {
  margin: "24px 0",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#1e293b",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
};

const hr = {
  borderColor: "#e2e8f0",
  margin: "24px 0",
};

const footer = {
  color: "#94a3b8",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0",
  textAlign: "center" as const,
};

export default OrganizationInvitationEmail;
