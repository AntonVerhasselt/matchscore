import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function PublicFooter() {
  const t = await getTranslations("landing.footer");

  return (
    <footer className="border-t border-border bg-muted/40 pb-[max(2rem,env(safe-area-inset-bottom))] dark:bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 py-8 sm:flex-row sm:gap-6 sm:px-6 lg:px-8">
        <p className="max-w-xs text-center text-xs text-muted-foreground sm:max-w-none sm:text-left sm:text-sm">
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
          Matchscore. {t("rights")}
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link
            href="/#pricing"
            className="inline-flex min-h-11 items-center hover:text-foreground"
          >
            {t("pricing")}
          </Link>
          <Link
            href="/#faq"
            className="inline-flex min-h-11 items-center hover:text-foreground"
          >
            {t("faq")}
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center hover:text-foreground"
          >
            {t("signIn")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
