import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200">
        Matchscore
      </h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400 text-center max-w-md">
        Your match scoring app. Sign in to access the app.
      </p>
      <Link
        href="/app"
        className="mt-8 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-medium px-6 py-3 rounded-lg transition-colors"
      >
        Go to App
      </Link>
    </main>
  );
}
