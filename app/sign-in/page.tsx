"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Step = "email" | "otp";

export default function SignInPage() {
  const router = useRouter();
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
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        setError(result.error.message ?? "Could not send sign-in code");
        return;
      }

      setStep("otp");
      setOtp("");
      setInfo("We sent a sign-in code to your email.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError(null);
    setInfo(null);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        setError(result.error.message ?? "Could not resend sign-in code");
        return;
      }

      setInfo("A new sign-in code has been sent.");
    } catch {
      setError("Something went wrong. Please try again.");
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
        setError(result.error.message ?? "Invalid or expired code");
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
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
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 text-center">
          Sign in to Matchscore
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
          {step === "email"
            ? "Enter your email to receive a sign-in code"
            : `Enter the code sent to ${email}`}
        </p>

        {info && (
          <div className="mt-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
            <p className="text-sm text-green-800 dark:text-green-200">{info}</p>
          </div>
        )}

        {step === "email" ? (
          <form
            onSubmit={(event) => void handleSendOtp(event)}
            className="mt-8 flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </label>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-3 rounded-lg cursor-pointer transition-colors"
            >
              {loading ? "Please wait..." : "Continue"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(event) => void handleVerifyOtp(event)}
            className="mt-8 flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Sign-in code
              </span>
              <input
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
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-center text-lg tracking-widest"
              />
            </label>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-3 rounded-lg cursor-pointer transition-colors"
            >
              {loading ? "Please wait..." : "Verify and sign in"}
            </button>

            <div className="flex flex-col gap-2 text-sm text-center text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={() => void handleResendOtp()}
                disabled={resending}
                className="text-slate-800 dark:text-slate-200 underline cursor-pointer disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend code"}
              </button>
              <button
                type="button"
                onClick={handleChangeEmail}
                className="text-slate-800 dark:text-slate-200 underline cursor-pointer"
              >
                Change email
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-sm text-center">
          <Link
            href="/"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
