"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AppPage() {
  const user = useQuery(api.auth.getCurrentUser);
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen p-8">
      <header className="flex items-center justify-between max-w-2xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
          Matchscore App
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Home
          </Link>
          <button
            onClick={() => void handleSignOut()}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="max-w-2xl mx-auto">
        {user === undefined ? (
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        ) : user ? (
          <p className="text-slate-700 dark:text-slate-300">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-slate-600 dark:text-slate-400">
              You are not signed in.
            </p>
            <Link
              href="/sign-in"
              className="text-sm text-slate-700 dark:text-slate-300 underline"
            >
              Sign in again
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
