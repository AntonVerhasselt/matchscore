import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { OtpSignInEmailProps } from "./types";

export function OtpSignInEmail({
  otp,
  expiresInMinutes,
}: OtpSignInEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Matchscore sign-in code is {otp}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Matchscore</Heading>
          <Text style={paragraph}>
            Use the code below to sign in to your account.
          </Text>
          <Section style={otpSection}>
            <Text style={otpCode}>{otp}</Text>
          </Section>
          <Text style={paragraph}>
            This code expires in {expiresInMinutes} minutes.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t request this code, you can safely ignore this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

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

const otpSection = {
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  margin: "24px 0",
  padding: "16px",
};

const otpCode = {
  color: "#1e293b",
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "8px",
  margin: "0",
  textAlign: "center" as const,
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

export default OtpSignInEmail;
