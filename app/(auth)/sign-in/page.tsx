"use client";

import StatusAlert from "@/components/StatusAlert";
import { authClient } from "@/lib/auth-client";
import {
  consumeInvitationToken,
  storeInvitationToken,
} from "@/lib/auth/invitation-token";
import { completeSignInAfterOtp } from "@/lib/auth/complete-sign-in-server";
import { useSetEmailLocaleForAddress } from "@/lib/i18n/set-email-locale";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

type Step = "email" | "otp";

function SignInPageContent() {
  const t = useTranslations("signIn");
  const searchParams = useSearchParams();
  const currentLocale = useLocale();

  useEffect(() => {
    const invitationFromUrl = searchParams.get("invitation");
    if (invitationFromUrl) {
      storeInvitationToken(invitationFromUrl);
    }
  }, [searchParams]);
  const setEmailLocale = useSetEmailLocaleForAddress();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSendOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      await setEmailLocale(email);
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        setError(result.error.message ?? t("couldNotSend"));
        return;
      }

      setStep("otp");
      setOtp("");
      setInfo(t("otpSent"));
    } catch {
      setError(t("somethingWrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError(null);
    setInfo(null);

    try {
      await setEmailLocale(email);
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        setError(result.error.message ?? t("couldNotResend"));
        return;
      }

      setInfo(t("otpResent"));
    } catch {
      setError(t("somethingWrong"));
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      });

      if (result.error) {
        setError(result.error.message ?? t("invalidCode"));
        return;
      }

      const invitationToken = consumeInvitationToken() ?? undefined;
      await completeSignInAfterOtp(currentLocale, invitationToken);
    } catch (error) {
      unstable_rethrow(error);
      const message =
        error instanceof Error ? error.message : t("somethingWrong");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep("email");
    setOtp("");
    setError(null);
    setInfo(null);
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">{t("title")}</CardTitle>
          <CardDescription>
            {step === "email" ? t("emailStep") : t("otpStep", { email })}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {info && <StatusAlert variant="success">{info}</StatusAlert>}
          {error && <StatusAlert variant="error">{error}</StatusAlert>}

          {step === "email" ? (
            <form
              onSubmit={(event) => void handleSendOtp(event)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("pleaseWait") : t("continue")}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(event) => void handleVerifyOtp(event)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="otp">{t("otp")}</Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || otp.length !== 6}
              >
                {loading ? t("pleaseWait") : t("verify")}
              </Button>

              <div className="flex flex-col gap-2 text-center">
                <Button
                  type="button"
                  variant="link"
                  disabled={resending || loading}
                  onClick={() => void handleResendOtp()}
                >
                  {resending ? t("sending") : t("resendCode")}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleChangeEmail}
                >
                  {t("changeEmail")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Button variant="link" size="sm" asChild>
            <Link href="/">{t("backToHome")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

export default function SignInPage() {
  const t = useTranslations("signIn");

  return (
    <Suspense
      fallback={
        <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
          <p className="text-muted-foreground">{t("pleaseWait")}</p>
        </main>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}
