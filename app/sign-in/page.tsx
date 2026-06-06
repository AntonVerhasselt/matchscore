"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000")
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyError = searchParams.get("error");

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const switchMode = (newMode: "sign-in" | "sign-up") => {
    setError(null);
    setInfo(null);
    setMode(newMode);
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    setResending(true);
    setError(null);
    setInfo(null);

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${getSiteUrl()}/app`,
      });

      if (result.error) {
        setError(result.error.message ?? "Could not resend verification email");
        return;
      }

      setInfo("Verification email sent. Check your inbox.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const callbackURL = `${getSiteUrl()}/app`;

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL,
        });
        if (result.error) {
          setError(result.error.message ?? "Sign up failed");
          return;
        }

        setInfo(
          "Account created. Check your email for a verification link before signing in.",
        );
        setMode("sign-in");
        setPassword("");
        return;
      }

      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL,
      });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          setError(
            "Please verify your email before signing in. A new verification link has been sent.",
          );
          return;
        }
        setError(result.error.message ?? "Sign in failed");
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

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 text-center">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
        Access the Matchscore app
      </p>

      {verifyError && (
        <div className="mt-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            Email verification failed. The link may be invalid or expired.
          </p>
        </div>
      )}

      {info && (
        <div className="mt-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
          <p className="text-sm text-green-800 dark:text-green-200">{info}</p>
        </div>
      )}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-8 flex flex-col gap-4"
      >
        {mode === "sign-up" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </label>
        )}
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
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
        </label>

        {mode === "sign-in" && (
          <p className="text-sm text-right -mt-2">
            <Link
              href="/forgot-password"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline"
            >
              Forgot password?
            </Link>
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-3 rounded-lg cursor-pointer transition-colors"
        >
          {loading
            ? "Please wait..."
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      {mode === "sign-in" && (
        <p className="mt-4 text-sm text-center text-slate-600 dark:text-slate-400">
          Didn&apos;t get a verification email?{" "}
          <button
            type="button"
            onClick={() => void handleResendVerification()}
            disabled={resending}
            className="text-slate-800 dark:text-slate-200 underline cursor-pointer disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend"}
          </button>
        </p>
      )}

      <p className="mt-6 text-sm text-center text-slate-600 dark:text-slate-400">
        {mode === "sign-in" ? (
          <>
            No account?{" "}
            <button
              type="button"
              onClick={() => switchMode("sign-up")}
              className="text-slate-800 dark:text-slate-200 underline cursor-pointer"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("sign-in")}
              className="text-slate-800 dark:text-slate-200 underline cursor-pointer"
            >
              Sign in
            </button>
          </>
        )}
      </p>

      <p className="mt-4 text-sm text-center">
        <Link
          href="/"
          className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Back to home
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <Suspense
        fallback={
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Loading...
          </p>
        }
      >
        <SignInForm />
      </Suspense>
    </main>
  );
}
