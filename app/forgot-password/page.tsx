"use client";

import { authClient } from "@/lib/auth-client";
import { getSiteUrl } from "@/lib/get-site-url";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${getSiteUrl()}/reset-password`,
      });

      if (result.error) {
        setError(result.error.message ?? "Could not send reset email");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 text-center">
          Forgot password
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {success ? (
          <div className="mt-8 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              If an account exists for that email, you&apos;ll receive a password
              reset link shortly.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
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
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-center text-slate-600 dark:text-slate-400">
          <Link
            href="/sign-in"
            className="text-slate-800 dark:text-slate-200 underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
