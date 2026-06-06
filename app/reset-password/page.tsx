"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing reset token. Request a new password reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message ?? "Could not reset password");
        return;
      }

      router.push("/sign-in");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (tokenError === "INVALID_TOKEN") {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
        <p className="text-sm text-red-800 dark:text-red-200">
          This reset link is invalid or has expired.
        </p>
        <p className="mt-4 text-sm text-center">
          <Link
            href="/forgot-password"
            className="text-slate-800 dark:text-slate-200 underline"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          No reset token found. Open the link from your email, or request a new
          one.
        </p>
        <p className="mt-4 text-sm text-center">
          <Link
            href="/forgot-password"
            className="text-slate-800 dark:text-slate-200 underline"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-8 flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-700 dark:text-slate-300">
          New password
        </span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-700 dark:text-slate-300">
          Confirm new password
        </span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
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
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 text-center">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
          Choose a new password for your account.
        </p>

        <Suspense
          fallback={
            <p className="mt-8 text-sm text-center text-slate-600 dark:text-slate-400">
              Loading...
            </p>
          }
        >
          <ResetPasswordForm />
        </Suspense>

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
